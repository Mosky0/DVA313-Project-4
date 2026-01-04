"""
Configuration settings for the application.
This file contains all configurable parameters and their default values.
"""
import os 
from dataclasses import dataclass
from typing import List
from flask import Config 


@dataclass 
class MetricsConfig: 
    """Configuration for metrics collection"""

    # Size of the ring buffer for storing metrics
    RING_BUFFER_SIZE = int(os.getenv('RING_BUFFER_SIZE', 100))
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
    CONTAINER_STOP_TIMEOUT = int(os.getenv('CONTAINER_STOP_TIMEOUT', 10))

    # Allow operations on the containers
    ALLOW_CONTAINER_STOP = os.getenv('ALLOW_STOP', 'true').lower() == 'true'
    ALLOW_CONTAINER_START = os.getenv('ALLOW_START', 'false').lower() == 'true'
    ALLOW_CONTIANER_RESTART = os.getenv('ALLOW_RESTART', 'false').lower() == 'true'



# Global configuration instance
config = Config()




""" Helper functions for accessing configuration values"""

# Get size of the ring buffer
def get_ring_buffer_size():
    return config.RING_BUFFER_SIZE

# Get number of log tail lines
def get_log_tail_lines():
    return config.LOG_TAIL_LINES

# Get maximum number of processes
def get_max_processes():
    return config.MAX_PROCESSES

# Get timeout for stopping containers
def get_stop_timeout():
    return config.CONTAINER_STOP_TIMEOUT

# Verify if stopping containers is allowed
def is_stop_allowed():
    return config.ALLOW_CONTAINER_STOP

# Verify if a feature is enabled
def is_feature_enabled(feature_name):
    features = {
        'system_metrics': config.ENABLE_SYSTEM_METRICS,
        'process_monitoring': config.ENABLE_PROCESS_MONITORING,
        'log_monitoring': config.ENABLE_LOG_MONITORING
    }
    return features.get(feature_name, False)