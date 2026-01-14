#CONFIGURATION FILE FOR THE APPLICATION

"""
Configuration settings for the application.
This file contains all configurable parameters and their default values.
These can be modified manually or by the commands provided below
"""
import os 
from dataclasses import dataclass
from typing import List
from flask import Config

"""COMMANDS FOR THE TERMINAL: 
1. To check the current configuration of the application:
curl http://localhost:8000/api/config

2. Running the application with Docker by default configuration:
docker rm -f monitoring_app
docker build -t monitoring-app:0.0.1 .
docker run -d --name monitoring_app -p 8000:8000 -v //var/run/docker.sock:/var/run/docker.sock monitoring-app:0.0.1

3. To run the application with custom configuration values, use the following command:
docker rm -f monitoring_app
docker build -t monitoring-app:0.0.1 .
docker run -d --name monitoring_app -p 8000:8000 -v //var/run/docker.sock:/var/run/docker.sock -e RING_BUFFER_SIZE=150  -e ALLOW_STOP=false monitoring-app:0.0.1    
"""

class MetricsConfig: 
    """Configuration for metrics collection"""

    # Size of the ring buffer for storing container metrics (cpu usage/memory usage)
    # example: CPU History [45%, 50%, 55%, ...] up to 100 by default
    # example: Memory History [200MB, 250MB, 300MB, ...] up to 100 by default
    RING_BUFFER_SIZE = int(os.getenv('RING_BUFFER_SIZE', 100)) 
    # command to check container metrics history:
    # curl http://localhost:5000/api/containers/CONTAINER_ID/metrics/history

    # Size of the ring buffer for storing system metrics (total cpu/cpu per core/system memory)
    # example: System CPU History [30%, 35%, 40%, ...] up to 200 by default and so on
    SYSTEM_METRICS_BUFFER_SIZE = int(os.getenv('SYSTEM_BUFFER_SIZE', 200))
    # command to check system metrics history:
    # curl http://localhost:5000/api/system/metrics/history

    # Number of lines of logs to tail for monitoring 
    LOG_TAIL_LINES = int(os.getenv('LOG_TAIL_LINES', 50))

    # Maximum number of processes of the containers to tail 
    MAX_PROCESSES = int(os.getenv('MAX_PROCESSES', 100))
    
    """Format settings"""

    # Precision for displaying value 
    BYTES_PRECISION = 2
    CPU_PRECISION = 2
    MEMORY_PRECISION = 2

    """Enable application features"""

    ENABLE_SYSTEM_METRICS = True
    ENABLE_PROCESS_MONITORING = True
    ENABLE_LOG_MONITORING = True

    """Docker operations"""

    # Timeout after stopping a container (seconds)
    CONTAINER_STOP_TIMEOUT = int(os.getenv('CONTAINER_STOP_TIMEOUT', 5))

    # Allow operations on the containers
    ALLOW_CONTAINER_STOP = os.getenv('ALLOW_STOP', 'true').lower() == 'true'

# Global configuration instance
config = MetricsConfig()




""" Helper functions for accessing configuration values"""

# Get size of the ring buffer for container metrics 
def get_ring_buffer_size():
    return config.RING_BUFFER_SIZE

# Get size of the ring buffer for system metrics
def get_system_buffer_size():
    return config.SYSTEM_METRICS_BUFFER_SIZE

# Get number of log tail lines
def get_log_tail_lines():
    return config.LOG_TAIL_LINES

# Get maximum number of processes
def get_max_processes():
    return config.MAX_PROCESSES

# Get timeout for stopping containers
def get_stop_timeout():
    return config.CONTAINER_STOP_TIMEOUT

# Get precision for bytes formatting 
def get_bytes_precision():
    return config.BYTES_PRECISION

# Get precision for CPU formatting
def get_cpu_precision():
    return config.CPU_PRECISION

# Get precision for memory formatting
def get_memory_precision():
    return config.MEMORY_PRECISION

# Verify if stopping containers is allowed
def is_stop_allowed():
    return config.ALLOW_CONTAINER_STOP

# Verify if a feature is enabled
"""
Arguments:
    feature_name: 'system_metrics', 'process_monitoring', 'log_monitoring'
Returns:
    bool: True if the feature is enabled, False otherwise
"""
def is_feature_enabled(feature_name):
    features = {
        'system_metrics': config.ENABLE_SYSTEM_METRICS,
        'process_monitoring': config.ENABLE_PROCESS_MONITORING,
        'log_monitoring': config.ENABLE_LOG_MONITORING
    }
    return features.get(feature_name, False)