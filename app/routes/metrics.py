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

        # Extract CPU stats securely
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

        if system_delta > 0 and cpu_delta > 0:
            percpu_usage = cpu_usage_stats.get("percpu_usage", [])
            num_cpus = len(percpu_usage) if percpu_usage else 1
            cpu_percent = (cpu_delta / system_delta) * num_cpus * 100.0

        # Extract memory stats securely
        mem_stats = stats.get("memory_stats", {})
        mem_usage = mem_stats.get("usage") or mem_stats.get("usage_bytes", 0)
        mem_limit = mem_stats.get("limit") or mem_stats.get("limit_bytes", 0)

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
