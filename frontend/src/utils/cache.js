class Cache {
  constructor(defaultTTL = 60000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL; 
  }

  set(key, value, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
  }
 
  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.cache.entries()) {
      if (now > data.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Currently 20 seconds ttl
export const systemCache = new Cache(20000);
export const containerCache = new Cache(20000); 
export const eventCache = new Cache(20000);

export default Cache;