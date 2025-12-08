import threading
from datetime import datetime
from collections import defaultdict, deque

class RingBuffer:
    def __init__(self, size):
        self.size = size
        self.buffer = deque(maxlen=size)
        self.lock = threading.Lock()

    def push(self, item):
        with self.lock:
            self.buffer.append(item)

    def getAll(self):
        with self.lock:
            return list(self.buffer)

    def getLast(self):
        with self.lock:
            if len(self.buffer) == 0:
                return None
            return self.buffer[-1]

    def clear(self):
        with self.lock:
            self.buffer.clear()

    def getCount(self):
        with self.lock:
            return len(self.buffer)

    def isEmpty(self):
        with self.lock:
            return len(self.buffer) == 0

    def isFull(self):
        with self.lock:
            return len(self.buffer) == self.size

containerMetricsStorage = defaultdict(dict)


DEFAULT_BUFFER_SIZE = 360

def initializeContainerBuffers(container_id, buffer_size=DEFAULT_BUFFER_SIZE):
    if container_id not in containerMetricsStorage:
        containerMetricsStorage[container_id] = {
            'cpuBuffer': RingBuffer(buffer_size),
            'memoryBuffer': RingBuffer(buffer_size)
        }

def addContainerMetrics(container_id, metrics):
    if container_id not in containerMetricsStorage:
        initializeContainerBuffers(container_id)
    
    if 'cpu_percent' in metrics and isinstance(metrics['cpu_percent'], (int, float)):
        containerMetricsStorage[container_id]['cpuBuffer'].push({
            'timestamp': datetime.now().isoformat(),
            'value': metrics['cpu_percent']
        })

    if ('mem_usage_bytes' in metrics and 'mem_limit_bytes' in metrics and
        isinstance(metrics['mem_usage_bytes'], (int, float)) and 
        isinstance(metrics['mem_limit_bytes'], (int, float))):
        
        memory_percent = (metrics['mem_usage_bytes'] / metrics['mem_limit_bytes']) * 100 if metrics['mem_limit_bytes'] > 0 else 0
        
        containerMetricsStorage[container_id]['memoryBuffer'].push({
            'timestamp': datetime.now().isoformat(),
            'value': memory_percent,
            'usageBytes': metrics['mem_usage_bytes'],
            'limitBytes': metrics['mem_limit_bytes']
        })

def getStoredMetrics(container_id):
    if container_id not in containerMetricsStorage:
        return {'cpuHistory': [], 'memoryHistory': []}
    
    return {
        'cpuHistory': containerMetricsStorage[container_id]['cpuBuffer'].getAll(),
        'memoryHistory': containerMetricsStorage[container_id]['memoryBuffer'].getAll()
    }

def getLatestContainerMetrics(container_id):
    if container_id not in containerMetricsStorage:
        return {'cpu': None, 'memory': None}
    
    return {
        'cpu': containerMetricsStorage[container_id]['cpuBuffer'].getLast(),
        'memory': containerMetricsStorage[container_id]['memoryBuffer'].getLast()
    }