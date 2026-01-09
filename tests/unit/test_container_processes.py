import pytest 
from unittest.mock import MagicMock, patch
from docker.errors import NotFound, APIError

class TestContainerProcesses:
    """Test for /api/containers/<id>/processes endpoint"""
    
    """CRITICAL TEST"""
    def test_get_processes_success(self, client, mock_container, sample_ps_output):
        """Test successful retrieval of container processes."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container

            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = sample_ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get(f'/api/containers/test123/processes')

            assert response.status_code == 200
            data = response.get_json()

            assert data['container'] == 'test_container'
            assert data['status'] == 'running'
            assert data['source'] == 'exec_run'
            assert len(data['processes']) == 3
            
            # Verify first process structure
            proc = data['processes'][0]
            assert 'pid' in proc
            assert 'cpu_percent' in proc
            assert 'mem_percent' in proc
            assert 'state' in proc
            assert 'command' in proc
   
    """CRITICAL TEST"""
    def test_get_processes_container_not_found(self, client):
        """Test process retrieval when container doesn't exist."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.side_effect = NotFound("Container not found")
            
            response = client.get('/api/containers/nonexistent/processes')
            
            assert response.status_code == 410
            data = response.get_json()
            assert 'error' in data

    """CRITICAL TEST"""
    def test_get_processes_container_not_running(self, client, mock_container_stopped):
        """Test retrieval of processes when container is not running."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container_stopped
            
            response = client.get('/api/containers/stop123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            
            assert data['status'] == 'exited'
            assert data['processes'] == []

    """CRITICAL TEST"""
    def test_get_processes_fallback_to_docker_top(self, client, mock_container, sample_processes):
        """Test fallback to docker top when exec_run fails."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            mock_docker.containers.get.return_value = mock_container
            
            # Make exec_run fail
            exec_result = MagicMock()
            exec_result.exit_code = 127
            mock_container.exec_run.return_value = exec_result
            
            # Setup docker top fallback
            mock_container.top.return_value = sample_processes
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['source'] == 'docker_top'
            assert len(data['processes']) == 3
            mock_container.top.assert_called_once()
    





    def test_get_processes_state_normalization(self, client, mock_container):
        """Test that process states are normalized correctly."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            ps_output = b"""USER       PID %CPU %MEM STAT TIME COMMAND
            root         1  0.5  1.2 R    0:01 running_process
            root         2  0.1  0.3 S    0:00 sleeping_process
            root         3  0.0  0.1 D    0:00 waiting_process
            root         4  0.0  0.0 Z    0:00 zombie_process
            root         5  0.0  0.1 T    0:00 stopped_process
            root         6  0.0  0.1 I    0:00 idle_process
            """
            mock_docker.containers.get.return_value = mock_container
            
            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            
            states = [p['state'] for p in data['processes']]
            assert 'Running' in states
            assert 'Sleeping' in states
            assert 'Waiting' in states
            assert 'Zombie' in states
            assert 'Stopped' in states
            assert 'Idle' in states
    
    
    def test_get_processes_sorting_by_cpu(self, client, mock_container):
        """Test that processes are sorted by CPU usage (descending)."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            ps_output = b"""USER       PID %CPU %MEM STAT TIME COMMAND
            root         1  0.5  1.2 R    0:01 low_cpu
            root         2  5.0  2.0 R    0:10 high_cpu
            root         3  2.5  1.5 R    0:05 mid_cpu
            """
            mock_docker.containers.get.return_value = mock_container
            
            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            
            cpu_values = [p['cpu_percent'] for p in data['processes']]
            assert cpu_values == sorted(cpu_values, reverse=True)
            assert cpu_values[0] == 5.0  # highest first
    
    
    def test_get_processes_limits_to_100(self, client, mock_container):
        """Test that process list is limited to 100 entries."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            # Create 150 processes
            lines = [b"USER       PID %CPU %MEM STAT TIME COMMAND"]
            for i in range(150):
                lines.append(f"root     {i:5d}  0.1  0.1 S    0:00 process_{i}".encode())
            
            ps_output = b"\n".join(lines)
            mock_docker.containers.get.return_value = mock_container
            
            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            
            assert len(data['processes']) == 100
            assert data['total_count'] == 100
    
    
    def test_get_processes_empty_output(self, client, mock_container):
        """Test handling of empty process list."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            ps_output = b"USER       PID %CPU %MEM STAT TIME COMMAND\n"
            mock_docker.containers.get.return_value = mock_container
            
            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['processes'] == []
    
    
    def test_get_processes_unicode_in_command(self, client, mock_container):
        """Test processes with unicode characters in command."""
        with patch("app.routes.metrics.docker_client") as mock_docker:
            ps_output = """USER       PID %CPU %MEM STAT TIME COMMAND
            root         1  0.5  1.2 R    0:01 python /app/测试.py
            root         2  0.1  0.3 S    0:00 /bin/sh -c "echo 🚀"
            """.encode('utf-8')
            mock_docker.containers.get.return_value = mock_container
            
            exec_result = MagicMock()
            exec_result.exit_code = 0
            exec_result.output = ps_output
            mock_container.exec_run.return_value = exec_result
            
            response = client.get('/api/containers/test123/processes')
            
            assert response.status_code == 200
            data = response.get_json()
            
            commands = [p['command'] for p in data['processes']]
            assert any('测试' in cmd for cmd in commands)
            assert any('🚀' in cmd for cmd in commands)


@pytest.mark.parametrize("status", ["paused", "restarting", "dead"])
def test_get_processes_various_container_states(client, mock_container, status):
    """Test process retrieval for containers in various states."""
    with patch("app.routes.metrics.docker_client") as mock_docker:
        mock_container.status = status
        mock_docker.containers.get.return_value = mock_container
        
        response = client.get('/api/containers/test123/processes')
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == status
        assert data['processes'] == []