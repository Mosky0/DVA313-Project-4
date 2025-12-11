import datetime
import time
from app.util.loggerConfig import IntializeLogger
import docker
from docker.errors import NotFound
import psutil
from flask import Blueprint, jsonify
from app.utils.ringBuffer import addContainerMetrics, getStoredMetrics, getLatestContainerMetrics, addSystemMetrics

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")
docker_client = docker.from_env()
logger = IntializeLogger(__name__)

def format_bytes(num: int) -> str:
    """Format bytes into a human-readable string."""
    try:
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if num < 1024:
                return f"{num:.2f} {unit}"
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
            "cpu_percent": round(cpu_percent, 2),
            "mem_usage_bytes": mem_usage,
            "mem_limit_bytes": mem_limit,
            "mem_usage": format_bytes(mem_usage),
            "mem_limit": format_bytes(mem_limit),
        }
    except Exception as e:
        logger.error(f"Error computing usage for container {container.id}: {e}")
        raise


# ---------------- SYSTEM METRICS ----------------
@metrics_bp.route("/system")
def system_metrics():
    """Return host-level system metrics (CPU, memory, load, uptime, processes)."""
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

        total_cpu = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(interval=None, percpu=True)

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


# ---------------- PER-CONTAINER STATS ----------------
@metrics_bp.route("/containers/<container_id>/stats")
def container_stats(container_id):
    """Return CPU & memory stats for a single container."""
    try:
        container = docker_client.containers.get(container_id)
        usage = compute_container_usage(container)

        stats_data = {
            "id": container_id,
            "name": container.name,
            "status": usage["status"],
            "cpu_percent": usage["cpu_percent"],
            "mem_usage": usage["mem_usage"],
            "mem_limit": usage["mem_limit"],
            "mem_usage_bytes": usage["mem_usage_bytes"],
            "mem_limit_bytes": usage["mem_limit_bytes"],
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
    try:
        container = docker_client.containers.get(container_id)

        raw = container.logs(tail=50).decode("utf-8", errors="replace")
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        lines = [f"[{now}] {line}" for line in raw.splitlines()]

    return jsonify(
        {
            "container": container.name,
            "logs": lines,
        }
    )

# ---------------- FETCH PROCESSES ----------------
@metrics_bp.route("/containers/<container_id>/processes")
def container_processes(container_id):
    """Return the list of processes running inside a container"""
    try:
        container = docker_client.containers.get(container_id)
        #verify it is running
        container.reload()
        if container.status != "running":
            return jsonify({
                "container": container.name,
                "processes": [],
                "error": "Container is not currently running."
            }), 200 
        
        #execute top inside the container

        top_data = container.top(ps_args="aux")
        titles = top_data.get("Titles", [])
        processes_total = top_data.get("Processes", [])

        #map the titles to each process info
        pid_idx = -1
        cpu_idx = -1
        mem_idx = -1 
        time_idx = -1 
        stat_idx = -1
        cmd_idx = -1

        #find indexes
        for i, title in enumerate(titles):
            title_upper = title.upper()
            if title_upper == "PID":
                pid_idx = i
            elif title_upper in ["%CPU", "CPU"]:
                cpu_idx = i
            elif title_upper in ["%MEM", "MEM"]:
                mem_idx = i
            elif title_upper == "TIME":
                time_idx = i
            elif title_upper in ["STAT", "STATE", "S"]:
                stat_idx = i
            elif title_upper in ["CMD", "COMMAND"]:
                cmd_idx = i

        def normalize_state(state_raw):
            """Convert Linux process state codes to human-readable"""
            if not state_raw:
                return "Unknown"
            
            state_code = state_raw[0].upper()
            
            state_map = {
                'R': 'Running',
                'S': 'Sleeping',
                'D': 'Waiting',
                'Z': 'Zombie',
                'T': 'Stopped',
                'I': 'Idle',
            }
            
            return state_map.get(state_code, state_raw)

        processes = []

        for proc_row in processes_total:
            try:
                state_raw = proc_row[stat_idx] if stat_idx >= 0 and len(proc_row) > stat_idx else ""
                state = normalize_state(state_raw)
                
                cpu_val = proc_row[cpu_idx] if cpu_idx >= 0 and len(proc_row) > cpu_idx else "0.0"
                mem_val = proc_row[mem_idx] if mem_idx >= 0 and len(proc_row) > mem_idx else "0.0"
                
                try:
                    cpu_float = float(cpu_val)
                    mem_float = float(mem_val)
                except (ValueError, TypeError):
                    cpu_float = 0.0
                    mem_float = 0.0
                proc_info = {
                    "pid": proc_row[pid_idx] if pid_idx >= 0 and len(proc_row) > pid_idx else "—",
                    "cpu_percent": cpu_float,
                    "mem_percent": mem_float,
                    "state": state,
                    "state_raw": state_raw,  
                    "time": proc_row[time_idx] if time_idx >= 0 and len(proc_row) > time_idx else "—",
                    "command": proc_row[cmd_idx] if cmd_idx >= 0 and len(proc_row) > cmd_idx else "—",
                }
                processes.append(proc_info)
            except (IndexError, ValueError) as e:
                print(f"Error parsing process row: {e}")
                continue

        return jsonify({
            "container": container.name,
            "status": container.status,
            "processes": processes,
        }), 200
        
    except docker.errors.NotFound as e:
        return jsonify({"error": "Container not found",
                        "container_id": container_id}), 410
    
    except docker.errors.Exception as e:
        return jsonify({"error": "Unexpected error occurred",
                        "message": "Failed to retrieve container processes."}), 500
