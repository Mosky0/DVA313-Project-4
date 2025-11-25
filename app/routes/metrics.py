import docker
from flask import Blueprint, jsonify

metrics_bp = Blueprint("metrics", __name__, url_prefix="/api")
docker_client = docker.from_env()

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

    return jsonify({
        "id": container_id,
        "name": container.name,
        "cpu_total": stats["cpu_stats"]["cpu_usage"]["total_usage"],
        "mem_usage": stats["memory_stats"]["usage"],
        "mem_limit": stats["memory_stats"]["limit"],
    })
