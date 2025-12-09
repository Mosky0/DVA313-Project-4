import docker
import threading
import time
import psutil
from app.utils.ringBuffer import addContainerMetrics, addSystemMetrics
from app.routes.metrics import compute_container_usage

class MetricsCollector:
    def __init__(self, interval=5):
        self.interval = interval 
        self.docker_client = docker.from_env()
        self.running = False
        self.thread = None

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._collect_metrics_loop, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

    def _collect_metrics_loop(self):
        while self.running:
            try:
                self._collect_all_metrics()
            except Exception as e:
                print(f"Error collecting metrics: {e}")
            
            time.sleep(self.interval)

    def _collect_all_metrics(self):
        try:
            try:
                # Host metrics
                total_cpu = psutil.cpu_percent(interval=None)
                per_core = psutil.cpu_percent(interval=None, percpu=True)
                
                mem = psutil.virtual_memory()
                used_bytes = mem.used
                limit_bytes = mem.total
                
                system_data = {
                    "cpu": {
                        "total_percent": total_cpu,
                        "per_core": per_core,
                    },
                    "memory": {
                        "used_bytes": used_bytes,
                        "limit_bytes": limit_bytes,
                    },
                }
                
                addSystemMetrics(system_data)
            except Exception as e:
                print(f"Error collecting system metrics: {e}")
            
            # Container metrics
            containers = self.docker_client.containers.list(all=True)
            
            for container in containers:
                try:
                    usage = compute_container_usage(container)
                    
                    stats_data = {
                        "id": container.short_id,
                        "name": container.name,
                        "status": usage["status"],
                        "cpu_percent": usage["cpu_percent"],
                        "mem_usage": usage["mem_usage"],
                        "mem_limit": usage["mem_limit"],
                        "mem_usage_bytes": usage["mem_usage_bytes"],
                        "mem_limit_bytes": usage["mem_limit_bytes"],
                    }
                    
                    addContainerMetrics(container.short_id, stats_data)

                except Exception as e:
                    print(f"Error collecting metrics for container {container.short_id}: {e}")
                    
        except Exception as e:
            print(f"Error listing containers: {e}")

metrics_collector = MetricsCollector()

def start_metrics_collection():
    metrics_collector.start()

def stop_metrics_collection():
    metrics_collector.stop()