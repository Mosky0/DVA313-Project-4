import threading
from datetime import datetime
from collections import defaultdict

class RingBuffer:
    def __init__(self, size):
        self.size = size
        self.buffer = [None] * size
        self.head = 0
        self.tail = 0
        self.count = 0
        self.lock = threading.Lock()

    def push(self, item):
        with self.lock:
            self.buffer[self.head] = item
            self.head = (self.head + 1) % self.size

            if self.count < self.size:
                self.count += 1
            else:
                self.tail = (self.tail + 1) % self.size

    def getAll(self):
        with self.lock:
            if self.count == 0:
                return []
            
            result = []
            index = self.tail

            for i in range(self.count):
                result.append(self.buffer[index])
                index = (index + 1) % self.size
            
            return result

    def getLast(self):
        with self.lock:
            if self.count == 0:
                return None
            index = (self.head - 1 + self.size) % self.size
            return self.buffer[index]

    def clear(self):
        with self.lock:
            self.head = 0
            self.tail = 0
            self.count = 0

    def getCount(self):
        with self.lock:
            return self.count

    def isEmpty(self):
        with self.lock:
            return self.count == 0

    def isFull(self):
        with self.lock:
            return self.count == self.size


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