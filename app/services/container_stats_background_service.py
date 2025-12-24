import docker
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.utils.loggerConfig import IntializeLogger
from app.utils.ringBuffer import addContainerMetrics
from app.routes.metrics import compute_container_usage
from app.utils.container_cache import container_stats_cache

logger = IntializeLogger(__name__)
class CotainerStatsCollector:
    def __init__(self, interval=1):
        self.interval = interval 
        self.docker_client = docker.from_env()
        self.running = False
        self.thread = None

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self.collect_container_stats, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

    def collect_container_stats(self):
        while self.running:
            try:
                self.start_container_collection()
            except Exception as e:
                print(f"Error collecting container stats: {e}")
            
            time.sleep(self.interval)

    def start_container_collection(self):
        containers = self.docker_client.containers.list(all=True)
        current_ids = {c.id for c in containers}

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                executor.submit(self.collect_single_container, c): c.id
                for c in containers
            }

            for future in as_completed(futures):
                cid = futures[future]
                try:
                    future.result()
                except Exception as e:
                    logger.warning(f"Stats failed for {cid}: {e}")

        stale_ids = set(container_stats_cache) - current_ids
        for cid in stale_ids:
            container_stats_cache.pop(cid, None)

    def collect_single_container(self, container):
        usage = compute_container_usage(container)

        stats = {
            "id": container.id,
            "name": container.name,
            "status": usage["status"],
            "cpu_percent": usage["cpu_percent"],
            "mem_limit": usage["mem_limit"],
            "mem_usage": usage["mem_usage"],
            "mem_usage_bytes": usage["mem_usage_bytes"],
            "mem_limit_bytes": usage["mem_limit_bytes"],
        }

        container_stats_cache[container.id] = stats
        
container_stats_collector = CotainerStatsCollector()

def start_container_stats_collection():
    container_stats_collector.start()

def stop_container_stats_collection():
    container_stats_collector.stop()