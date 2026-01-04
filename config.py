"""
Configuration settings for the application.
This file contains all configurable parameters and their default values.
"""

import os 
from dataclasses import dataclass
from typing import List 

@dataclass 
class MetricsConfig: 
    """Configuration for metrics collection."""

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

    """Docker operations"""

    # Timeout after stopping a container (seconds)
    CONTAINER_STOP_TIMEOUT = int(os.getenv('CONTAINER_STOP_TIMEOUT', 10))

    # Allow operations on the containers
    

    