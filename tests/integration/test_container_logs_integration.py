import time
import pytest

@pytest.mark.integration 
class TestLogsIntegration:
    """Integration tests with real Docker containers"""

    def test_real_container_logs(self, integration_test_container, client):
        """Test retrieving logs from a real running container."""
        time.sleep(3)  #Wait for some logs
        
        container_id = integration_test_container.short_id
        response = client.get(f'/api/containers/{container_id}/logs')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert 'container' in data
        assert 'logs' in data
        assert len(data['logs']) > 0
        
        #Verify log contains our test message
        logs_text = ' '.join(data['logs'])
        assert 'Test log' in logs_text

    def test_nonexistent_container(self, client):
        """Test with container that doesn't exist."""
        response = client.get('/api/containers/definitely_not_real_12345/logs')
        assert response.status_code == 410


@pytest.mark.integration
class TestProcessesIntegration:
    """Integration tests for processes."""
    
    def test_real_container_processes(self, client, integration_test_container):
        """Test retrieving processes from a real container."""
        time.sleep(2)
        
        container_id = integration_test_container.short_id
        response = client.get(f'/api/containers/{container_id}/processes')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['status'] == 'running'
        assert len(data['processes']) > 0
        
        commands = [p['command'] for p in data['processes']]
        assert any('sh' in cmd for cmd in commands)