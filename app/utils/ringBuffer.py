import os
import threading
from datetime import datetime
from collections import defaultdict, deque
from app.utils.loggerConfig import IntializeLogger
from dotenv import load_dotenv
load_dotenv()
logger = IntializeLogger(__name__)

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
systemMetricsStorage = {
    'systemCpuBuffer': None,
    'cpuCoreBuffers': {},
    'memoryBuffer': None
}


DEFAULT_BUFFER_SIZE = (int(os.getenv('METRICS_STORAGE_LIMIT', 30)) * 60) // int(os.getenv('METRICS_UPDATE_INTERVAL', 5))
SYSTEM_DEFAULT_BUFFER_SIZE = (int(os.getenv('METRICS_STORAGE_LIMIT', 30)) * 60) // int(os.getenv('METRICS_UPDATE_INTERVAL', 5))
logger.info(f"Metrics storage buffer size set to {DEFAULT_BUFFER_SIZE} entries.")

def initializeContainerBuffers(container_id, buffer_size=DEFAULT_BUFFER_SIZE):
    if container_id not in containerMetricsStorage:
        containerMetricsStorage[container_id] = {
            'cpuBuffer': RingBuffer(buffer_size),
            'memoryBuffer': RingBuffer(buffer_size)
        }

def initializeSystemBuffers(num_cores, buffer_size=SYSTEM_DEFAULT_BUFFER_SIZE):
    if systemMetricsStorage['systemCpuBuffer'] is None:
        systemMetricsStorage['systemCpuBuffer'] = RingBuffer(buffer_size)
        
    for core_idx in range(num_cores):
        if core_idx not in systemMetricsStorage['cpuCoreBuffers']:
            systemMetricsStorage['cpuCoreBuffers'][core_idx] = RingBuffer(buffer_size)
    
    if systemMetricsStorage['memoryBuffer'] is None:
        systemMetricsStorage['memoryBuffer'] = RingBuffer(buffer_size)

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

def addSystemMetrics(system_data):
    cpu_per_core = system_data.get('cpu', {}).get('per_core', [])
    cpu_total = system_data.get('cpu', {}).get('total_percent', 0)
    initializeSystemBuffers(len(cpu_per_core))
    
    if isinstance(cpu_total, (int, float)):
        systemMetricsStorage['systemCpuBuffer'].push({
            'timestamp': datetime.now().isoformat(),
            'value': cpu_total
        })
    
    for core_idx, core_value in enumerate(cpu_per_core):
        if isinstance(core_value, (int, float)):
            systemMetricsStorage['cpuCoreBuffers'][core_idx].push({
                'timestamp': datetime.now().isoformat(),
                'value': core_value
            })
    
    memory_data = system_data.get('memory', {})
    used_bytes = memory_data.get('used_bytes', 0)
    limit_bytes = memory_data.get('limit_bytes', 0)
    
    if isinstance(used_bytes, (int, float)) and isinstance(limit_bytes, (int, float)):
        memory_percent = (used_bytes / limit_bytes) * 100 if limit_bytes > 0 else 0
        systemMetricsStorage['memoryBuffer'].push({
            'timestamp': datetime.now().isoformat(),
            'value': memory_percent,
            'usageBytes': used_bytes,
            'limitBytes': limit_bytes
        })

def getStoredMetrics(container_id):
    if container_id not in containerMetricsStorage:
        return {'cpuHistory': [], 'memoryHistory': []}
    
    return {
        'cpuHistory': containerMetricsStorage[container_id]['cpuBuffer'].getAll(),
        'memoryHistory': containerMetricsStorage[container_id]['memoryBuffer'].getAll()
    }

def getSystemMetricsHistory():
    result = {
        'cpuCoreHistories': {},
        'systemCpuHistory': [],
        'memoryHistory': []
    }
    
    if systemMetricsStorage['systemCpuBuffer']:
        result['systemCpuHistory'] = systemMetricsStorage['systemCpuBuffer'].getAll()
    
    for core_idx, buffer in systemMetricsStorage['cpuCoreBuffers'].items():
        result['cpuCoreHistories'][core_idx] = buffer.getAll()
    
    if systemMetricsStorage['memoryBuffer']:
        result['memoryHistory'] = systemMetricsStorage['memoryBuffer'].getAll()
    
    return result

def getLatestContainerMetrics(container_id):
    if container_id not in containerMetricsStorage:
        return {'cpu': None, 'memory': None}
    
    return {
        'cpu': containerMetricsStorage[container_id]['cpuBuffer'].getLast(),
        'memory': containerMetricsStorage[container_id]['memoryBuffer'].getLast()
    }

def getLatestSystemMetrics():
    result = {
        'systemCpu': None,
        'cpuCores': {},
        'memory': None
    }
    
    if systemMetricsStorage['systemCpuBuffer']:
        result['systemCpu'] = systemMetricsStorage['systemCpuBuffer'].getLast()
    
    for core_idx, buffer in systemMetricsStorage['cpuCoreBuffers'].items():
        result['cpuCores'][core_idx] = buffer.getLast()
    
    if systemMetricsStorage['memoryBuffer']:
        result['memory'] = systemMetricsStorage['memoryBuffer'].getLast()
    
    return result
