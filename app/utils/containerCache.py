import threading

container_stats_cache = {}
container_stats_lock = threading.Lock()