import pytest
from unittest.mock import MagicMock
from app import create_app

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    return app

@pytest.fixture
def client(app):
    return app.test_client()


# ============================================================================
# NEW FIXTURES FOR LOGS AND PROCESSES TESTING
# ============================================================================

@pytest.fixture
def mock_container():
    """Create a mock Docker container for testing."""
    container = MagicMock()
    container.id = "test_container_id"
    container.short_id = "test123"
    container.name = "test_container"
    container.status = "running"
    container.image.tags = ["test:latest"]
    return container


@pytest.fixture
def mock_container_stopped():
    """Create a mock stopped Docker container."""
    container = MagicMock()
    container.id = "stopped_container_id"
    container.short_id = "stop123"
    container.name = "stopped_container"
    container.status = "exited"
    container.image.tags = ["test:latest"]
    return container


@pytest.fixture
def sample_logs():
    """Sample log output for testing."""
    return b"Log line 1\nLog line 2\nLog line 3\n"


@pytest.fixture
def sample_processes():
    """Sample process data for docker top testing."""
    return {
        "Titles": ["USER", "PID", "%CPU", "%MEM", "STAT", "TIME", "COMMAND"],
        "Processes": [
            ["root", "1", "0.5", "1.2", "Ss", "0:01", "/bin/bash"],
            ["root", "42", "2.3", "3.4", "R", "0:05", "python app.py"],
            ["root", "100", "0.1", "0.5", "S", "0:00", "/usr/bin/sleep 60"],
        ]
    }


@pytest.fixture
def sample_ps_output():
    """Sample ps aux command output for exec_run testing."""
    return b"""USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.5  1.2  18380  3640 ?        Ss   10:00   0:01 /bin/bash
root        42  2.3  3.4  45678 12340 ?        R    10:05   0:05 python app.py
root       100  0.1  0.5   4520  1024 ?        S    10:10   0:00 /usr/bin/sleep 60
"""


# ============================================================================
# INTEGRATION TEST FIXTURES 
# ============================================================================

@pytest.fixture
def real_docker_client():
    """Real Docker client for integration tests."""
    try:
        import docker
        client = docker.from_env()
        client.ping()
        return client
    except Exception as e:
        pytest.skip(f"Docker not available: {e}")


@pytest.fixture
def integration_test_container(real_docker_client):
    """
    Create a real test container for integration tests.
    Automatically cleaned up after test.
    """
    container = None
    try:
        container = real_docker_client.containers.run(
            "alpine:latest",
            command="sh -c 'while true; do echo Test log $(date); sleep 1; done'",
            detach=True,
            name="pytest_test_container",
            remove=False
        )
        
        import time
        time.sleep(2)  # Wait for container to start
        
        yield container
        
    finally:
        if container:
            try:
                container.stop(timeout=1)
                container.remove()
            except:
                pass