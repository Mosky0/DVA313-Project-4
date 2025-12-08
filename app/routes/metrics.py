import datetime
import time

import docker
import psutil
from flask import Blueprint, jsonify
from app.utils.ringBuffer import addContainerMetrics, getStoredMetrics, getLatestContainerMetrics

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")
docker_client = docker.from_env()


def format_bytes(num: int) -> str:
    """Format bytes into a human-readable string."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if num < 1024:
            return f"{num:.2f} {unit}"
        num /= 1024
    return f"{num:.2f} TB"


def compute_container_usage(container):
    """Compute CPU% and memory usage for a single container."""
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


# ---------------- SYSTEM METRICS ----------------
@metrics_bp.route("/system")
def system_metrics():
    """Return host-level system metrics (CPU, memory, load, uptime, processes)."""

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

    return jsonify(
        {
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
    )


# ---------------- LIGHT CONTAINER LIST ----------------
@metrics_bp.route("/containers")
def list_containers():
    """
    List all Docker containers (fast):
    only id, name, status, image.
    """
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
    return jsonify(result)


# ---------------- PER-CONTAINER STATS ----------------
@metrics_bp.route("/containers/<container_id>/stats")
def container_stats(container_id):
    """Return CPU & memory stats for a single container."""
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
    
    return jsonify(stats_data)

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


# ---------------- CONTAINER LOGS ----------------
@metrics_bp.route("/containers/<container_id>/logs")
def container_logs(container_id):
    """Return the last 50 log lines for a container."""
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
