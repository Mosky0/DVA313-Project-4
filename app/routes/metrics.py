import datetime
from app.utils.containerUptime import container_uptime_info
import time
from app.utils.loggerConfig import InitializeLogger
from docker.errors import NotFound
import psutil
from flask import Blueprint, jsonify, request
from app.utils.ringBuffer import addContainerMetrics, getStoredMetrics, getLatestContainerMetrics, addSystemMetrics
from app.utils.containerCache import container_stats_cache, container_stats_lock
from app.utils.dockerClient import DockerClientProvider

#config file functions
from app.app_config import (
    get_log_tail_lines,
    get_max_processes,
    get_stop_timeout,
    get_bytes_precision,
    get_cpu_precision,
    is_stop_allowed,
    is_feature_enabled,
)

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")

docker_client = DockerClientProvider.get_docker_client()
logger = InitializeLogger(__name__)

def format_bytes(num: int) -> str:
    """Format bytes into a human-readable string."""
    try:
        precision = get_bytes_precision()
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if num < 1024:
                return f"{num:.{precision}f} {unit}"
            num /= 1024
        return f"{num:.2f} TB"
    except Exception as e:
        logger.error(f"Error formatting bytes: {e}")
        raise


def compute_container_usage(container):
    """Compute CPU% and memory usage for a single container."""
    try:
        container.reload()
        status = container.status

        cpu_precision = get_cpu_precision()

        cpu_percent = 0.0
        mem_usage = 0
        mem_limit = 0

        if status == "running":
            try:
                stats = container.stats(stream=False)
            except docker.errors.APIError:
                stats = {}

            cpu_stats = stats.get("cpu_stats", {})
            precpu_stats = stats.get("precpu_stats", {})

            cpu_usage_stats = cpu_stats.get("cpu_usage", {})
            precpu_usage_stats = precpu_stats.get("cpu_usage", {})

            cpu_total = cpu_usage_stats.get("total_usage", 0)
            cpu_total_prev = precpu_usage_stats.get("total_usage", 0)

            system_total = cpu_stats.get("system_cpu_usage", 0)
            system_total_prev = precpu_stats.get("system_cpu_usage", 0)

            cpu_delta = cpu_total - cpu_total_prev
            system_delta = system_total - system_total_prev

            online_cpus = cpu_stats.get("online_cpus", 1) or 1

            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0
            elif cpu_total > 0 and system_total > 0:
                cpu_percent = (cpu_total / system_total) * online_cpus * 100.0

            mem_stats = stats.get("memory_stats", {})
            mem_usage = (
                mem_stats.get("usage")
                or mem_stats.get("usage_bytes")
                or 0
            )
            mem_limit = (
                mem_stats.get("limit")
                or mem_stats.get("limit_bytes")
                or 0
            )

        return {
            "status": status,
            "cpu_percent": round(cpu_percent, cpu_precision),
            "mem_usage_bytes": mem_usage,
            "mem_limit_bytes": mem_limit,
            "mem_usage": format_bytes(mem_usage),
            "mem_limit": format_bytes(mem_limit),
        }
    except Exception as e:
        logger.error(f"Error computing usage for container {container.id}: {e}")
        raise

# ---------------- CONTAINER STATS WITH CACHE ----------------
@metrics_bp.route("/containers/all/stats")
def fast_container_stats():
    try:
        with container_stats_lock:
            data = list(container_stats_cache.values())
        return jsonify(data)
    except Exception as e:
        logger.error(f"Error retrieving fast container stats: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to retrieve fast container stats",
        }), 500


# ---------------- SYSTEM METRICS ----------------
@metrics_bp.route("/system")
def system_metrics():
    """Return host-level system metrics (CPU, memory, load, uptime, processes)."""
    # Check if the feature for collecting metrics is enabled
    if not is_feature_enabled('system_metrics'):
        return jsonify({
            "error": "Feature disabled",
            "message": "System metrics are disabled in configuration"
        }), 403
    
    try:
        try:
            load1, load5, load15 = psutil.getloadavg()
        except (AttributeError, OSError):
            load1 = load5 = load15 = 0.0

        boot_ts = psutil.boot_time()
        uptime_seconds = time.time() - boot_ts
        uptime_str = str(datetime.timedelta(seconds=int(uptime_seconds)))

        total_procs = len(psutil.pids())
        running = 0
        for p in psutil.process_iter(attrs=["status"]):
            if p.info["status"] == psutil.STATUS_RUNNING:
                running += 1

        total_cpu = psutil.cpu_percent(interval=0.1)
        per_core = psutil.cpu_percent(interval=0.1, percpu=True)

        mem = psutil.virtual_memory()
        used_bytes = mem.used
        limit_bytes = mem.total

        system_data = {
            "load": [load1, load5, load15],
            "uptime": uptime_str,
            "total_processes": total_procs,
            "running": running,
            "cpu": {
                "total_percent": total_cpu,
                "per_core": per_core,
            },
            "memory": {
                "used_bytes": used_bytes,
                "limit_bytes": limit_bytes,
            },
        }

        addSystemMetrics(system_data)

        return jsonify(system_data)
    except Exception as e:
        logger.error(f"Error fetching system metrics: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to retrieve system metrics",
        }), 500


# ---------------- LIGHT CONTAINER LIST ----------------
@metrics_bp.route("/containers")
def list_containers():
    """
    List all Docker containers (fast):
    only id, name, status, image.
    """
    try:
        logger.info("Listing all containers")
        containers = docker_client.containers.list(all=True)
        result = []
        for c in containers:
            c.reload()
            result.append(
                {
                    "id": c.short_id,
                    "name": c.name,
                    "status": c.status,
                    "image": c.image.tags,
                }
            )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error listing containers: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to list containers",
        }), 500


@metrics_bp.route("/containers/with-stats")
def list_containers_with_stats():
    """
    List all Docker containers with their latest stats (CPU and memory).
    """
    try:
        logger.info("Listing all containers with stats")
        containers = docker_client.containers.list(all=True)
        result = []
        for c in containers:
            c.reload()
            if c.status == "running":
                metrics = getLatestContainerMetrics(c.short_id)
                cpu = f"{metrics.get('cpu_percent', 0):.2f}%" if metrics else "-"
                mem = metrics.get('mem_usage', '-') if metrics else "-"
            else:
                cpu = "-"
                mem = "-"
            result.append(
                {
                    "id": c.short_id,
                    "name": c.name,
                    "status": c.status,
                    "image": c.image.tags,
                    "cpu": cpu,
                    "mem": mem,
                }
            )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error listing containers with stats: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to list containers with stats",
        }), 500

# ---------------- PER-CONTAINER STATS ----------------
@metrics_bp.route("/containers/<container_id>/stats")
def container_stats(container_id):
    """Return CPU & memory stats for a single container."""
    try:
        container = docker_client.containers.get(container_id)
        usage = compute_container_usage(container)
        uptime_info = container_uptime_info(container)


        stats_data = {
            "id": container_id,
            "name": container.name,
            "status": usage["status"],
            "cpu_percent": usage["cpu_percent"],
            "mem_usage": usage["mem_usage"],
            "mem_limit": usage["mem_limit"],
            "mem_usage_bytes": usage["mem_usage_bytes"],
            "mem_limit_bytes": usage["mem_limit_bytes"],
             "uptime": uptime_info["uptime"],
    "uptime_seconds": uptime_info["uptime_seconds"],
    "started_at": uptime_info.get("started_at"),
    "finished_at": uptime_info.get("finished_at"),
        }

        # Add to ring buffer
        addContainerMetrics(container_id, stats_data)
        
        return jsonify(stats_data), 200
    except NotFound as e:
        logger.error(f"Container not found: {container_id}: {e}")
        return jsonify({
            "message": "Container not found or has been removed",            
            "status": "deleted",
            "id": container_id,
        }), 410

    except Exception as e:
        logger.error(f"Error retrieving stats for container {container_id}: {e}")
        return jsonify({
            "message": "Failed to retrieve container stats",            
            "status": "unknown",
            "id": container_id,
        }), 500

# ---------------- CONTAINER METRICS HISTORY ----------------
@metrics_bp.route("/containers/<container_id>/metrics/history")
def container_metrics_history(container_id):
    """Return stored metrics for a container."""
    try:
        history = getStoredMetrics(container_id)
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- LATEST CONTAINER METRICS ----------------
@metrics_bp.route("/containers/<container_id>/metrics/latest")
def latest_container_metrics(container_id):
    """Return latest metrics for a container."""
    try:
        latest = getLatestContainerMetrics(container_id)
        return jsonify(latest)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    except NotFound as e:
        logger.error(f"Container not found: {container_id}: {e}")
        return jsonify({
            "error": "Container not found",
            "container_id": container_id,
        }), 410

    except Exception as e:
        logger.error(f"Error retrieving stats for container {container_id}: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to retreive container stats",
        }), 500

# ---------------- SYSTEM METRICS HISTORY ----------------
@metrics_bp.route("/system/metrics/history")
def system_metrics_history():
    try:
        from app.utils.ringBuffer import getSystemMetricsHistory
        history = getSystemMetricsHistory()
        return jsonify(history)
    except Exception as e:
        logger.error(f"Error retrieving system metrics history: {e}")
        return jsonify({"error": str(e)}), 500

# ---------------- LATEST SYSTEM METRICS ----------------
@metrics_bp.route("/system/metrics/latest")
def latest_system_metrics():
    try:
        from app.utils.ringBuffer import getLatestSystemMetrics
        latest = getLatestSystemMetrics()
        return jsonify(latest)
    except Exception as e:
        logger.error(f"Error retrieving latest system metrics: {e}")
        return jsonify({"error": str(e)}), 500

# ---------------- CONTAINER LOGS ----------------
@metrics_bp.route("/containers/<container_id>/logs")
def container_logs(container_id):
    """Return the last 50 log lines for a container."""
    # Check if feature is enabled
    if not is_feature_enabled('log_monitoring'):
        return jsonify({
            "error": "Feature disabled",
            "message": "Log monitoring is disabled in configuration"
        }), 403

    try:
        container = docker_client.containers.get(container_id)

        tail_lines = get_log_tail_lines()
        raw = container.logs(tail=tail_lines).decode("utf-8", errors="replace")
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        lines = [f"[{now}] {line}" for line in raw.splitlines()]

        return jsonify(
            {
                "container": container.name,
                "logs": lines,
                "tail_lines": tail_lines,
            }
        ), 200
    except NotFound as e:
        logger.error(f"Container not found: {container_id} : {e}")
        return jsonify({
            "error": "Container not found",
            "container_id": container_id,
        }), 410
    except Exception as e:
        logger.error(f"Error retrieving logs for container {container_id}: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to retrieve container logs",
        }), 500

# ---------------- FETCH PROCESSES ----------------
@metrics_bp.route("/containers/<container_id>/processes")
def container_processes(container_id):
    """Return the list of processes running inside a container (exec_run with fallback to docker top)"""
    #Check if feature is enabled
    if not is_feature_enabled('process_monitoring'):
        return jsonify({
            "error": "Feature disabled",
            "message": "Process monitoring is disabled in configuration"
        }), 403
    
    try:
        container = docker_client.containers.get(container_id)
        container.reload()

        if container.status != "running":
            return jsonify({
                "container": container.name,
                "status": container.status,
                "processes": [],
                "message": "Container is not currently running."
            }), 200

        max_processes  = get_max_processes()

        processes = []
        source = "exec_run"

        try:
            result = container.exec_run(
                cmd=f"ps aux --sort=-%cpu | head -n {max_processes + 1}",
                stdout=True,
                stderr=True
            )

            if result.exit_code != 0:
                raise RuntimeError("ps command not available")

            ps_output = result.output.decode("utf-8", errors="replace")
            lines = ps_output.strip().split("\n")

            if len(lines) < 2:
                raise RuntimeError("Invalid ps output")

            header = lines[0].split()

            pid_idx = header.index("PID")
            cpu_idx = header.index("%CPU")
            mem_idx = header.index("%MEM")
            stat_idx = header.index("STAT")
            time_idx = header.index("TIME")
            cmd_idx = header.index("COMMAND")

            def normalize_state(state_raw):
                return {
                    'R': 'Running',
                    'S': 'Sleeping',
                    'D': 'Waiting',
                    'Z': 'Zombie',
                    'T': 'Stopped',
                    'I': 'Idle',
                }.get(state_raw[:1].upper(), state_raw or "Unknown")

            for line in lines[1:]:
                parts = line.split(None, cmd_idx)
                if len(parts) <= cmd_idx:
                    continue

                try:
                    processes.append({
                        "pid": parts[pid_idx],
                        "cpu_percent": float(parts[cpu_idx]),
                        "mem_percent": float(parts[mem_idx]),
                        "state": normalize_state(parts[stat_idx]),
                        "state_raw": parts[stat_idx],
                        "time": parts[time_idx],
                        "command": parts[cmd_idx],
                    })
                except Exception:
                    continue
        #in case ps is not available, fallback to docker top
        except Exception as e:
            logger.warning(
                f"exec_run ps failed for container {container_id}, falling back to docker top: {e}"
            )
            source = "docker_top"

            top_data = container.top(ps_args="auxwwH")
            titles = top_data.get("Titles", [])
            rows = top_data.get("Processes", [])

            def idx(name_variants):
                for i, t in enumerate(titles):
                    if t.upper() in name_variants:
                        return i
                return -1

            pid_idx = idx({"PID"})
            cpu_idx = idx({"%CPU", "CPU"})
            mem_idx = idx({"%MEM", "MEM"})
            stat_idx = idx({"STAT", "STATE", "S"})
            time_idx = idx({"TIME"})
            cmd_idx = idx({"CMD", "COMMAND"})

            def normalize_state(state_raw):
                return {
                    'R': 'Running',
                    'S': 'Sleeping',
                    'D': 'Waiting',
                    'Z': 'Zombie',
                    'T': 'Stopped',
                    'I': 'Idle',
                }.get(state_raw[:1].upper(), state_raw or "Unknown")

            for row in rows:
                try:
                    processes.append({
                        "pid": row[pid_idx] if pid_idx >= 0 else "—",
                        "cpu_percent": float(row[cpu_idx]) if cpu_idx >= 0 else 0.0,
                        "mem_percent": float(row[mem_idx]) if mem_idx >= 0 else 0.0,
                        "state": normalize_state(row[stat_idx]) if stat_idx >= 0 else "Unknown",
                        "state_raw": row[stat_idx] if stat_idx >= 0 else "",
                        "time": row[time_idx] if time_idx >= 0 else "—",
                        "command": row[cmd_idx] if cmd_idx >= 0 else "—",
                    })
                except Exception:
                    continue

        processes.sort(key=lambda p: p["cpu_percent"], reverse=True)

        # Limit to top 100 processes to prevent memory issues
        processes = processes[:max_processes]

        return jsonify({
            "container": container.name,
            "container_id": container_id,
            "status": container.status,
            "source": source,
            "total_count": len(processes),
            "max_processes": max_processes, 
            "processes": processes,
        }), 200
        
    except NotFound as e:
        return jsonify({"error": "Container not found",
                        "container_id": container_id}), 410
    
    except Exception as e:
        return jsonify({"error": "Unexpected error occurred",
                        "message": "Failed to retrieve container processes."}), 500
    
# ---------------- SYSTEM METRICS HISTORY ----------------
@metrics_bp.route("/containers/<container_id>/stop", methods=["POST"])
def stop_container(container_id):
    """Stop a running container."""
    # Check if operation is allowed
    if not is_stop_allowed():
        return jsonify({
            "error": "Operation not allowed",
            "message": "Container stop operation is disabled in configuration"
        }), 403

    try:
        container = docker_client.containers.get(container_id)
        container.reload()

        if container.status != "running":
            return jsonify({
                "message": "Container is not running.",
                "container_id": container_id,
                "status": container.status
            }), 200

        timeout = get_stop_timeout()
        container.stop(timeout=timeout)

        return jsonify({
            "message": "Container stopped successfully.",
            "container_id": container_id,
            "name": container.name,
            "status": "stopped",
            "timeout_used": timeout
        }), 200
    
    except NotFound as e:
        logger.error(f"Container not found: {container_id} : {e}")
        return jsonify({
            "error": "Container not found",
            "container_id": container_id,
        }), 410
    
    except Exception as e:
        logger.error(f"Error stopping container {container_id}: {e}")
        return jsonify({
            "error": "Unexpected error occurred",
            "message": "Failed to stop container",
        }), 500

# File Explorer: max bytes returned when previewing a file (prevents huge responses)
MAX_FILE_BYTES = 200_000  # preview size limit

# File Explorer API: returns a safe preview of a file inside the container (used by "Open file" in the UI)
@metrics_bp.route("/containers/<container_id>/file")
def container_file(container_id):
    """
    Read a text file inside a container.
    Example: GET /api/containers/<id>/file?path=/app/sample.txt
    """
    path = (request.args.get("path") or "").strip()

    if not path:
        return jsonify({"message": "Missing query param: path"}), 400

    if not path.startswith("/"):
        return jsonify({"message": "Path must start with /. Example: /app/sample.txt"}), 400

    try:
        container = docker_client.containers.get(container_id)

        # Read up to MAX_FILE_BYTES bytes from file (safe preview)
        cmd = [
            "sh",
            "-lc",
            f"if [ -f '{path}' ]; then head -c {MAX_FILE_BYTES} '{path}'; else exit 2; fi",
        ]

        # Execute a shell command ("cmd") inside the container to retrieve filesystem data
        result = container.exec_run(cmd, stdout=True, stderr=True)

        if result.exit_code == 2:
            return jsonify({"message": f"File not found: {path}"}), 404

        if result.exit_code != 0:
            err = (result.output or b"").decode("utf-8", "replace")
            return jsonify({"message": "Failed to read file", "details": err}), 500

        raw = result.output or b""
        return jsonify({
            "path": path,
            "content": raw.decode("utf-8", "replace"),
            "truncated": len(raw) >= MAX_FILE_BYTES
        }), 200

    except NotFound:
        return jsonify({
            "message": "Container not found or has been removed",
            "container_id": container_id
        }), 410

    except Exception as e:
        logger.error(f"Error reading file {path} from container {container_id}: {e}")
        return jsonify({
            "message": "Unexpected error occurred",
            "details": str(e),
        }), 500

# File Explorer API: lists one directory in the container (used by Files tab navigation + Up/Refresh)
@metrics_bp.route("/containers/<container_id>/fs")
def container_fs(container_id):
    path = (request.args.get("path") or "/").strip()
    if not path.startswith("/"):
        return jsonify({"message": "Path must start with /"}), 400

    try:
        container = docker_client.containers.get(container_id)

        # -A: almost all (skip . and ..)
        # -p: append / to directories
        # -1: one entry per line
        cmd = ["sh", "-lc", f"""
        p={_sh_quote(path)}
        if [ ! -d "$p" ]; then
          echo "__NOTDIR__"
          exit 3
        fi
        ls -Ap1 "$p"
        """]

        result = container.exec_run(cmd, stdout=True, stderr=True)

        if result.exit_code == 3:
            return jsonify({"message": f"Not a directory: {path}"}), 400

        if result.exit_code != 0:
            err = (result.output or b"").decode("utf-8", "replace")
            return jsonify({"message": "Failed to list directory", "details": err}), 500

        raw = (result.output or b"").decode("utf-8", "replace").splitlines()

        entries = []
        for name in raw:
            if not name:
                continue
            is_dir = name.endswith("/")
            clean = name[:-1] if is_dir else name

            full_path = (path.rstrip("/") + "/" + clean) if path != "/" else ("/" + clean)

            entries.append({
                "name": clean,
                "path": full_path,
                "type": "dir" if is_dir else "file",
            })

        entries.sort(key=lambda e: (0 if e["type"] == "dir" else 1, e["name"].lower()))
        return jsonify({"path": path, "entries": entries}), 200

    except NotFound:
        return jsonify({"message": "Container not found", "container_id": container_id}), 410
    except Exception as e:
        logger.error(f"Error listing fs for {container_id} path={path}: {e}")
        return jsonify({"message": "Unexpected error occurred", "details": str(e)}), 500


def _sh_quote(s: str) -> str:
    # safe single-quote shell escaping
    return "'" + s.replace("'", "'\"'\"'") + "'"

@metrics_bp.route("/config")
def get_configuration():
    """Return current configuration (safe values)"""
    from app.app_config import config
    return jsonify({
        "metrics": {
            "ring_buffer_size": config.RING_BUFFER_SIZE,
            "system_buffer_size": config.SYSTEM_METRICS_BUFFER_SIZE,
            "log_tail_lines": config.LOG_TAIL_LINES,
            "max_processes": config.MAX_PROCESSES,
        },
        "docker": {
            "stop_timeout": config.CONTAINER_STOP_TIMEOUT,
        },
        "formatting": {
            "bytes_precision": config.BYTES_PRECISION,
            "cpu_precision": config.CPU_PRECISION,
            "memory_precision": config.MEMORY_PRECISION,
        },
        "features": {
            "system_metrics": config.ENABLE_SYSTEM_METRICS,
            "process_monitoring": config.ENABLE_PROCESS_MONITORING, 
            "log_monitoring": config.ENABLE_LOG_MONITORING, 
        },
        "security": {
                "allow_stop": config.ALLOW_CONTAINER_STOP,
        }
        }), 200
