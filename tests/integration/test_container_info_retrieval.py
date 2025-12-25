import pytest
from unittest.mock import MagicMock, patch
from docker.errors import NotFound

def test_list_containers_with_stats(client):
    """Test listing containers with stats."""
    mock_container = MagicMock()
    mock_container.short_id = "containerID"
    mock_container.name = "sampleIDE"
    mock_container.status = "running"
    mock_container.image.tags = ["ide:latest"]

    mock_stats = {
        "cpu_percent": 15.5,
        "mem_usage": "256 MB"
    }

    with patch("app.routes.metrics.docker_client") as mock_docker, \
         patch("app.routes.metrics.getLatestContainerMetrics") as mock_get_latest:

        mock_docker.containers.list.return_value = [mock_container]
        mock_get_latest.return_value = mock_stats

        response = client.get("/api/containers/with-stats")
        assert response.status_code == 200
        data = response.get_json()

        assert len(data) == 1
        assert data[0]["id"] == "containerID"
        assert data[0]["name"] == "sampleIDE"
        assert data[0]["status"] == "running"
        assert data[0]["image"] == ["ide:latest"]
        assert data[0]["cpu"] == "15.50%"
        assert data[0]["mem"] == "256 MB"

def test_list_containers_with_stats_empty(client):
    """Test listing containers with stats when no containers."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.list.return_value = []

        response = client.get("/api/containers/with-stats")
        assert response.status_code == 200
        data = response.get_json()
        assert data == []

def test_list_containers_with_stats_error(client):
    """Test error handling for listing containers with stats."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.list.side_effect = Exception("Docker error")

        response = client.get("/api/containers/with-stats")
        assert response.status_code == 500
        data = response.get_json()
        assert data["error"] == "Unexpected error occurred"
        assert "Failed to list containers with stats" in data["message"]

def test_container_metrics_history(client):
    """Test retrieving metrics history for a container."""
    mock_history = [
        {"timestamp": "2023-01-01T00:00:00", "cpu_percent": 10.0},
        {"timestamp": "2023-01-01T00:01:00", "cpu_percent": 15.0}
    ]

    with patch("app.routes.metrics.getStoredMetrics") as mock_get_stored:
        mock_get_stored.return_value = mock_history

        response = client.get("/api/containers/containerID/metrics/history")
        assert response.status_code == 200
        data = response.get_json()
        assert data == mock_history

def test_container_metrics_history_error(client):
    """Test error handling for metrics history."""
    with patch("app.routes.metrics.getStoredMetrics") as mock_get_stored:
        mock_get_stored.side_effect = Exception("Storage error")

        response = client.get("/api/containers/containerID/metrics/history")
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data

def test_latest_container_metrics(client):
    """Test retrieving latest metrics for a container."""
    mock_latest = {
        "cpu_percent": 20.0,
        "mem_usage": "512 MB"
    }

    with patch("app.routes.metrics.getLatestContainerMetrics") as mock_get_latest:
        mock_get_latest.return_value = mock_latest

        response = client.get("/api/containers/containerID/metrics/latest")
        assert response.status_code == 200
        data = response.get_json()
        assert data == mock_latest

def test_latest_container_metrics_error(client):
    """Test error handling for latest metrics."""
    with patch("app.routes.metrics.getLatestContainerMetrics") as mock_get_latest:
        mock_get_latest.side_effect = Exception("Retrieval error")

        response = client.get("/api/containers/containerID/metrics/latest")
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data

def test_container_logs(client):
    """Test retrieving logs for a container."""
    mock_container = MagicMock()
    mock_container.name = "sampleIDE"
    mock_container.logs.return_value = b"line1\nline2\n"

    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.return_value = mock_container

        response = client.get("/api/containers/containerID/logs")
        assert response.status_code == 200
        data = response.get_json()
        assert data["container"] == "sampleIDE"
        assert len(data["logs"]) == 2
        assert "line1" in data["logs"][0]
        assert "line2" in data["logs"][1]

def test_container_logs_not_found(client):
    """Test logs for non-existent container."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = NotFound("not found")

        response = client.get("/api/containers/containerID/logs")
        assert response.status_code == 410
        data = response.get_json()
        assert data["error"] == "Container not found"
        assert data["container_id"] == "containerID"

def test_container_logs_error(client):
    """Test error handling for container logs."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = Exception("Docker error")

        response = client.get("/api/containers/containerID/logs")
        assert response.status_code == 500
        data = response.get_json()
        assert data["error"] == "Unexpected error occurred"
        assert "Failed to retrieve container logs" in data["message"]

def test_container_processes(client):
    """Test retrieving processes for a running container."""
    mock_container = MagicMock()
    mock_container.name = "sampleIDE"
    mock_container.status = "running"
    mock_container.exec_run.return_value = MagicMock(exit_code=0, output=b"USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.0  1234  567 ?        Ss   00:00   0:00 /bin/sh\n")

    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.return_value = mock_container

        response = client.get("/api/containers/containerID/processes")
        assert response.status_code == 200
        data = response.get_json()
        assert data["container"] == "sampleIDE"
        assert data["status"] == "running"
        assert data["source"] == "exec_run"
        assert len(data["processes"]) == 1
        assert data["processes"][0]["pid"] == "1"
        assert data["processes"][0]["command"] == "/bin/sh"

def test_container_processes_not_running(client):
    """Test processes for a stopped container."""
    mock_container = MagicMock()
    mock_container.name = "sampleIDE"
    mock_container.status = "exited"

    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.return_value = mock_container

        response = client.get("/api/containers/containerID/processes")
        assert response.status_code == 200
        data = response.get_json()
        assert data["container"] == "sampleIDE"
        assert data["status"] == "exited"
        assert data["processes"] == []
        assert "not currently running" in data["message"]

def test_container_processes_not_found(client):
    """Test processes for non-existent container."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = NotFound("not found")

        response = client.get("/api/containers/containerID/processes")
        assert response.status_code == 410
        data = response.get_json()
        assert data["error"] == "Container not found"
        assert data["container_id"] == "containerID"

def test_container_processes_error(client):
    """Test error handling for container processes."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.side_effect = Exception("Docker error")

        response = client.get("/api/containers/containerID/processes")
        assert response.status_code == 500
        data = response.get_json()
        assert data["error"] == "Unexpected error occurred"
        assert "Failed to retrieve container processes" in data["message"]