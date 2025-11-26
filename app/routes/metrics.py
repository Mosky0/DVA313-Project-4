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
    stats = container.stats(stream=False)

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
        
        # ---- CPU PERCENT (with safe access) ----
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

        # DEBUG
        print(f"cpu_total: {cpu_total}, cpu_total_prev: {cpu_total_prev}")
        print(f"system_total: {system_total}, system_total_prev: {system_total_prev}")
        print(f"cpu_delta: {cpu_delta}, system_delta: {system_delta}")

        if system_delta > 0 and cpu_delta > 0:
            online_cpus = cpu_stats.get("online_cpus", 1)
            cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0
            print(f"CALCULATED cpu_percent: {cpu_percent}")
        else:
            online_cpus = cpu_stats.get("online_cpus", 1)
            if cpu_total > 0 and system_total > 0:
                cpu_percent = (cpu_total / system_total) * online_cpus * 100.0
                print(f"FALLBACK cpu_percent: {cpu_percent}")

    mem_usage_fmt = format_bytes(mem_usage)
    mem_limit_fmt = format_bytes(mem_limit)

    # Extract relevant metrics
    return jsonify({
        "id": container_id,
        "name": container.name,
        "status": status,
        "cpu_percent": cpu_percent,
        "mem_usage": mem_usage_fmt,
        "mem_limit": mem_limit_fmt,
        "mem_usage_bytes": mem_usage,
        "mem_limit_bytes": mem_limit,
    })
