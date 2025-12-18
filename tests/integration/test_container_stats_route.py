import pytest
from unittest.mock import MagicMock, patch
from docker.errors import NotFound

def test_container_stats(client):
    mock_container = MagicMock()
    mock_container.id = "containerID"
    mock_container.name = "sampleIDE"
    mock_container.status = "running"
    mock_container.stats.return_value = {
        "cpu_stats": {"cpu_usage": {"total_usage": 100}, "system_cpu_usage": 1000, "online_cpus": 1},
        "precpu_stats": {"cpu_usage": {"total_usage": 50}, "system_cpu_usage": 500},
        "memory_stats": {"usage": 512, "limit": 1024},
    }

    with patch("app.routes.metrics.docker_client") as mock_docker, \
         patch("app.routes.metrics.addContainerMetrics") as mock_add:

        mock_docker.containers.get.return_value = mock_container

        response = client.get("/api/containers/containerID/stats")
        assert response.status_code == 200
        data = response.get_json()
        assert data["id"] == "containerID"
        assert data["cpu_percent"] >= 0
        assert data["mem_usage_bytes"] == 512

def test_container_stats_not_found(client):
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = NotFound("not found")

        response = client.get("/api/containers/containerID/stats")
        assert response.status_code == 410
        assert response.get_json()["status"] == "deleted"

def test_container_stats_docker_error(client):
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = Exception("Docker error")

        response = client.get("/api/containers/containerID/stats")
        assert response.status_code == 500
        data = response.get_json()
        assert data == {"id":"containerID","status": "unknown", "message": "Failed to retrieve container stats"}