import pytest 
from unittest.mock import patch, MagicMock
from docker.errors import NotFound, APIError

class TestContainerLogs:
    """Test for /api/containers/<id>/logs endpoint"""
    """CRITICAL TEST"""
    def test_get_logs_success(self, client, mock_container, sample_logs):
        """Test successful retrieval of container logs."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = sample_logs

            response = client.get(f'/api/containers/test123/logs')

            assert response.status_code == 200
            data = response.get_json()
            assert data['container'] == 'test_container'
            assert 'logs' in data 
            assert len(data['logs']) == 3 
            assert all(isinstance(log, str) for log in data['logs'])

            mock_docker.containers.get.assert_called_once_with('test123')
            mock_container.logs.assert_called_once_with(tail=50)

    """CRITICAL TEST"""
    def test_get_logs_not_found(self, client):
        """Test retrieval of logs for a non-existent container."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.side_effect = NotFound("Container not found")

            response = client.get(f'/api/containers/nonexistent/logs')

            assert response.status_code == 410
            data = response.get_json()
            assert 'error' in data
            assert data['container_id'] == 'nonexistent'

    """CRITICAL TEST"""
    def test_get_logs_empty_logs(self, client, mock_container):
        """Test retrieval of logs when container has no logs."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = b''

            response = client.get(f'/api/containers/test123/logs')

            assert response.status_code == 200
            data = response.get_json()
            assert data['container'] == 'test_container'
            assert 'logs' in data 
            assert data['logs'] == []

    def test_get_logs_unicode_handling(self, client, mock_container):
        """Test proper handling of unicode characters in logs."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            unicode_logs = "Hello 世界\nTest émoji 🚀\n".encode('utf-8')
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = unicode_logs
            
            response = client.get('/api/containers/test123/logs')
            
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['logs']) == 2
            assert '世界' in data['logs'][0]
            assert '🚀' in data['logs'][1]
    
    """in case of corrupted data"""
    def test_get_logs_invalid_utf8(self, client, mock_container):
        """Test handling of invalid UTF-8 sequences."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            invalid_logs = b"Valid line\n\xff\xfeInvalid\nAnother line\n"
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = invalid_logs
            
            response = client.get('/api/containers/test123/logs')
            
            # Should handle gracefully with errors='replace'
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['logs']) == 3
    
    """CRITICAL TEST"""
    def test_get_logs_docker_api_error(self, client, mock_container):
        """Test handling of Docker API errors."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.side_effect = APIError("Docker daemon error")
            
            response = client.get('/api/containers/test123/logs')
            
            assert response.status_code == 500
            data = response.get_json()
            assert 'error' in data
    
    
    def test_get_logs_timestamp_format(self, client, mock_container, sample_logs):
        """Test that logs include ISO format timestamps."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = sample_logs
            
            response = client.get('/api/containers/test123/logs')
            
            assert response.status_code == 200
            data = response.get_json()
            
            # Each log line should have a timestamp prefix
            for log_line in data['logs']:
                assert log_line.startswith('[')
                assert ']' in log_line
                # Verify ISO format contains 'T'
                assert 'T' in log_line.split(']')[0]
    
    
    def test_get_logs_multiline_handling(self, client, mock_container):
        """Test proper handling of multi-line log entries."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            multiline_logs = b"Line 1\nLine 2 continues\n  indented line\nLine 3\n"
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = multiline_logs
            
            response = client.get('/api/containers/test123/logs')
            
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['logs']) == 4
    
    
    def test_get_logs_stopped_container(self, client, mock_container_stopped, sample_logs):
        """Test retrieving logs from stopped container (should still work)."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container_stopped
            mock_container_stopped.logs.return_value = sample_logs
            
            response = client.get('/api/containers/stop123/logs')
            
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['logs']) == 3
    
    
    def test_get_logs_special_characters(self, client, mock_container):
        """Test logs with special characters and escape sequences."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            special_logs = b"Line with \t tabs\nLine with \x1b[31mANSI colors\x1b[0m\n"
            mock_docker.containers.get.return_value = mock_container
            mock_container.logs.return_value = special_logs
            
            response = client.get('/api/containers/test123/logs')
            
            assert response.status_code == 200
            data = response.get_json()
            assert len(data['logs']) == 2


@pytest.mark.parametrize("container_id", [
    "test123",
    "container-with-dashes",
    "container_with_underscores",
    "12345abcdef",
])
def test_get_logs_various_container_ids(client, mock_container, sample_logs, container_id):
    """Test log retrieval with various container ID formats."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_docker.containers.get.return_value = mock_container
        mock_container.logs.return_value = sample_logs
        
        response = client.get(f'/api/containers/{container_id}/logs')
        
        assert response.status_code == 200
        mock_docker.containers.get.assert_called_once_with(container_id)