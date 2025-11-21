/**
 * Rate Limit Store
 *
 * In-memory store for tracking rate limits per IP address
 * Implements LRU eviction and automatic cleanup
 *
 * Phase 1, Day 3: Rate Limiting Implementation
 */

/**
 * Rate Limit Store Class
 * Tracks request counts and reset times per IP
 */
export class RateLimitStore {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.data = new Map();
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute default

    // Start automatic cleanup
    if (this.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, this.cleanupInterval);
    }
  }

  /**
   * Increment request count for an IP
   * @param {string} key - IP address
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} - { current, resetTime }
   */
  increment(key, windowMs) {
    const now = Date.now();
    const entry = this.data.get(key);

    // If no entry or window expired, create new entry
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.data.set(key, {
        count: 1,
        resetTime,
      });

      // LRU eviction if store is too large
      if (this.data.size > this.maxSize) {
        this.evictOldest();
      }

      return {
        current: 1,
        resetTime,
      };
    }

    // Increment existing count
    entry.count += 1;
    this.data.set(key, entry);

    return {
      current: entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Get current request count for an IP
   * @param {string} key - IP address
   * @returns {Object|null} - { count, resetTime } or null
   */
  get(key) {
    const entry = this.data.get(key);
    if (!entry) return null;

    const now = Date.now();

    // Check if entry has expired
    if (now > entry.resetTime) {
      this.data.delete(key);
      return null;
    }

    return {
      count: entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a specific IP
   * @param {string} key - IP address
   */
  reset(key) {
    this.data.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll() {
    this.data.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.data.entries()) {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.data.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Evict oldest entry (LRU)
   */
  evictOldest() {
    const firstKey = this.data.keys().next().value;
    if (firstKey) {
      this.data.delete(firstKey);
    }
  }

  /**
   * Get current storage size
   * @returns {number}
   */
  getStorageSize() {
    return this.data.size;
  }

  /**
   * Get request count for an IP (for testing)
   * @param {string} key - IP address
   * @returns {number}
   */
  getRequestCount(key) {
    const entry = this.get(key);
    return entry ? entry.count : 0;
  }

  /**
   * Stop automatic cleanup
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Export singleton instance for use across the application
export const rateLimitStore = new RateLimitStore();
