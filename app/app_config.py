#CONFIGURATION FILE FOR THE APPLICATION

"""
Configuration settings for the application.
This file contains all configurable parameters and their default values.
"""
import os 
from dataclasses import dataclass
from typing import List
from flask import Config


class MetricsConfig: 
    """Configuration for metrics collection"""

    # Size of the ring buffer for storing container metrics
    RING_BUFFER_SIZE = int(os.getenv('RING_BUFFER_SIZE', 100))

    # Size of the ring buffer for storing system metrics
    SYSTEM_METRICS_BUFFER_SIZE = int(os.getenv('SYSTEM_BUFFER_SIZE', 200))

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
    ALLOW_CONTAINER_START = os.getenv('ALLOW_START', 'false').lower() == 'true'
    ALLOW_CONTAINER_RESTART = os.getenv('ALLOW_RESTART', 'false').lower() == 'true'



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