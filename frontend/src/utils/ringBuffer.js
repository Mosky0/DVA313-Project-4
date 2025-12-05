// Circular buffer for in memory metrics storage
export class RingBuffer {
    /**
     * @param {number} size -- Size of buffer
     */
    constructor(size) {
        this.size = size;
        this.buffer = new Array(size);
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

        /**
     * 
     * @param {*} item - Add item to buffer
     */
    push(item) {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.size;
        if (this.count < this.size) {
            this.count++;
        } else {
            this.tail = (this.tail + 1) % this.size;
        }
    }

    /**
     * 
     * @returns {Array} - Get buffer items
     */
    getAll() {
        if (this.count === 0) return [];
        const result = [];
        let index = this.tail;

        for (let i = 0; i < this.count; i++) {
            result.push(this.buffer[index]);
            index = (index + 1) % this.size;
        }
        return result;
    }

    /**
     * @returns {*} - Get most recent item
     */
    getLast() {
        if (this.count === 0) return null;
        const index = (this.head - 1 + this.size) % this.size;
        return this.buffer[index];
    }
    
    /**
     * Clear buffer
     */
    clear() {
        this.head = 0;
        this.tail = 0;
        this.count = 0;
    }

    /**
     * 
     * @returns {number} - Get nr of items
     */
    getCount() {
        return this.count;
    }

    /**
     * 
     * @returns {boolean} - Check if buffer is empty
     */
    isEmpty() {
        return this.count === 0;
    }

    /**
     * 
     * @returns {boolean} - Check if buffer is full
     */
    isFull() {
        return this.count === this.size;
    }
}

// Sturcture that contains {containerId: {cpuBuffer: RingBuffer, memoryBuffer: RingBuffer}}
export const containerMetricsStorage = {};

/**
 * Initialize the ring buffers
 * @param {string} containerId
 * @param {number} bufferSize
 */
export const initializeContainerBuffers = (containerId, bufferSize = 360) => {
  if (!containerMetricsStorage[containerId]) {
    containerMetricsStorage[containerId] = {
      cpuBuffer: new RingBuffer(bufferSize),
      memoryBuffer: new RingBuffer(bufferSize)
    };
  }
};


// Change this depending on how frequent we poll or how long time of data we want to display. (5 second poll interval for 30min = 360 buffer size)
export const DEFAULT_BUFFER_SIZE = 360;

/**
 * Add metrics for a container
 * @param {string} containerId
 * @param {Object} metrics
 */
export const addContainerMetrics = (containerId, metrics) => {

  if (!containerMetricsStorage[containerId]) {
    initializeContainerBuffers(containerId);
  }

  // Add CPU metrics
  if (typeof metrics.cpu_percent === 'number') {
    containerMetricsStorage[containerId].cpuBuffer.push({
      timestamp: new Date(),
      value: metrics.cpu_percent
    });
  }

  // Add memory metrics
  if (typeof metrics.mem_usage_bytes === 'number' && typeof metrics.mem_limit_bytes === 'number') {
    const memoryPercent = metrics.mem_limit_bytes > 0 
      ? (metrics.mem_usage_bytes / metrics.mem_limit_bytes) * 100 : 0;
      
    containerMetricsStorage[containerId].memoryBuffer.push({
      timestamp: new Date(),
      value: memoryPercent,
      usageBytes: metrics.mem_usage_bytes,
      limitBytes: metrics.mem_limit_bytes
    });
  }
};

/**
 * Get stored metrics from container
 * @param {string} containerId
 * @returns {Object}
 */
export const getStoredMetrics = (containerId) => {
  if (!containerMetricsStorage[containerId]) {
    return { cpuHistory: [], cpuMemory: [] };
  }

  return {
    cpuHistory: containerMetricsStorage[containerId].cpuBuffer.getAll(),
    memoryHistory: containerMetricsStorage[containerId].memoryBuffer.getAll()
  };
};

/**
 * Get latest metrics for a container
 * @param {string} containerId
 * @returns {Object}
 */
export const getLatestContainerMetrics = (containerId) => {
  if (!containerMetricsStorage[containerId]) {
    return { cpu: null, memory: null };
  }

  return {
    cpu: containerMetricsStorage[containerId].cpuBuffer.getLast(),
    memory: containerMetricsStorage[containerId].memoryBuffer.getLast()
  };
};