import docker
from flask import Blueprint, jsonify

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")
docker_client = docker.from_env()

def format_bytes(num):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if num < 1024:
            return f"{num:.2f} {unit}"
        num /= 1024

@metrics_bp.route("/containers")
def list_containers():
    containers = docker_client.containers.list(all=True)
    result = []
    for c in containers:
        result.append({
            "id": c.short_id,
            "name": c.name,
            "status": c.status,
            "image": c.image.tags,
        })
    return jsonify(result)

@metrics_bp.route("/containers/<container_id>/stats")
def container_stats(container_id):
    container = docker_client.containers.get(container_id)

    # Make sure we have the latest status
    container.reload()
    status = container.status

    # Default values
    cpu_percent = 0.0
    mem_usage = 0
    mem_limit = 0

    # Only calculate real stats if the container is running
    if status == "running":
        stats = container.stats(stream=False)

        # ---- CPU PERCENT ----
        cpu_total = stats["cpu_stats"]["cpu_usage"]["total_usage"]
        cpu_total_prev = stats["precpu_stats"]["cpu_usage"].get("total_usage", 0)

        system_total = stats["cpu_stats"].get("system_cpu_usage", 0)
        system_total_prev = stats["precpu_stats"].get("system_cpu_usage", 0)

        cpu_delta = cpu_total - cpu_total_prev
        system_delta = system_total - system_total_prev

        if system_delta > 0 and cpu_delta > 0:
            num_cpus = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [])) or 1
            cpu_percent = (cpu_delta / system_delta) * num_cpus * 100.0

        # ---- MEMORY ----
        mem_usage = stats["memory_stats"].get("usage", 0)
        mem_limit = stats["memory_stats"].get("limit", 0)

    mem_usage_fmt = format_bytes(mem_usage)
    mem_limit_fmt = format_bytes(mem_limit)

    return jsonify({
        "id": container_id,
        "name": container.name,
        "status": status,              # <— also return status here
        "cpu_percent": cpu_percent,    # 0.0 if not running
        "mem_usage": mem_usage_fmt,    # "0.00 B" if not running
        "mem_limit": mem_limit_fmt,
        "mem_usage_bytes": mem_usage,
        "mem_limit_bytes": mem_limit,
    })

