from unittest.mock import MagicMock, patch

def test_list_containers(client):
    mock_container = MagicMock()
    mock_container.short_id = "containerID"
    mock_container.name = "sampleIDE"
    mock_container.status = "running"
    mock_container.image.tags = ["ide:latest"]

    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.list.return_value = [mock_container]

        response = client.get("/api/containers")

        assert response.status_code == 200
        data = response.get_json()

        assert data == [{
            "id": "containerID",
            "name": "sampleIDE",
            "status": "running",
            "image": ["ide:latest"]
        }]

def test_list_containers_empty(client):
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.list.return_value = []

        response = client.get("/api/containers")

        assert response.status_code == 200
        data = response.get_json()

        assert data == []

def test_list_containers_docker_error(client):
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.list.side_effect = Exception("Docker error")

        response = client.get("/api/containers")

        assert response.status_code == 500
        data = response.get_json()

        assert data == {"error": "Unexpected error occurred", "message": "Failed to list containers"}