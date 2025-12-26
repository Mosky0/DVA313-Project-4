import docker
from app.utils.loggerConfig import InitializeLogger

logger = InitializeLogger(__name__)

class DockerClientProvider:
    _client = None

    @staticmethod
    def get_docker_client():
        if DockerClientProvider._client is None:
            try:
                DockerClientProvider._client = docker.from_env()
                logger.debug("Docker client successfully initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize Docker client: {e}")
                raise
        return DockerClientProvider._client