import datetime
import asyncio
from collections import deque
from app import socketio
from app.utils.dockerClient import DockerClientProvider

client = DockerClientProvider.get_docker_client()
logs_dic = {}

# Continuously get log from one container
async def collect_logs_continuously(container):
    container_name = container.name

    if container_name not in logs_dic:
        logs_dic[container_name] = deque(maxlen=50) # 50 lines of logs, adjustable
    while True:
        try:
            logs = container.logs(tail=50).decode("utf-8").splitlines()
            time = datetime.datetime.now(datetime.timezone.utc).isoformat()

            for log in logs:
                log_line = f"[{time}] {log}"
                logs_dic[container_name].append(log_line)

                socketio.emit(f"log_{container_name}", {"log": log_line})

        except Exception as e:
            print(f"Error reading logs from {container_name}: {e}")
        
        await asyncio.sleep(2)

        
# Call log collector function for every container
async def start_log_collect():
    containers = client.containers.list()

    tasks = []

    for container in containers:
        tasks.append(asyncio.create_task(collect_logs_continuously(container)))

    await asyncio.gather(*tasks)