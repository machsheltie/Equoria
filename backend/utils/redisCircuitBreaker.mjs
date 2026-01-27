/**
 * 🔌 Redis Circuit Breaker Wrapper
 *
 * Implements circuit breaker pattern for Redis operations to prevent cascading failures.
 * Uses opossum library for proven, production-ready circuit breaker implementation.
 *
 * Features:
 * - Automatic failure detection and circuit opening
 * - Half-open state for recovery testing
 * - Configurable thresholds and timeouts
 * - Comprehensive metrics collection
 * - Health monitoring integration
 *
 * Phase 2, Subtask 2.1: Redis Circuit Breaker Implementation
 */

import CircuitBreaker from 'opossum';
import logger from './logger.mjs';

/**
 * Circuit Breaker Configuration
 * Based on production requirements and industry best practices
 */
const DEFAULT_CIRCUIT_OPTIONS = {
  // Failure threshold: open circuit after 50% error rate over 10 requests
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds - time to wait before attempting recovery
  timeout: 3000, // 3 seconds per operation - balance between UX and failure detection
  volumeThreshold: 10, // Minimum requests before opening circuit

  // Half-open state configuration
  halfOpenRequests: 3, // Test recovery with 3 requests

  // Error detection
  errorFilter: err => {
    // Don't count certain errors as failures (e.g., connection refused during shutdown)
    if (err?.code === 'ECONNREFUSED' && process.env.NODE_ENV === 'test') {
      return false;
    }
    return true;
  },
};

/**
 * Metrics Storage
 * In-memory metrics for monitoring circuit breaker state and performance
 */
class CircuitMetrics {
  constructor() {
    this.stats = {
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      fallbackCount: 0,
      circuitOpenCount: 0,
      circuitCloseCount: 0,
      circuitHalfOpenCount: 0,
      lastStateChange: null,
      currentState: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
    };
  }

  incrementSuccess() {
    this.stats.successCount++;
  }

  incrementFailure() {
    this.stats.failureCount++;
  }

  incrementTimeout() {
    this.stats.timeoutCount++;
  }

  incrementFallback() {
    this.stats.fallbackCount++;
  }

  updateState(state) {
    this.stats.currentState = state;
    this.stats.lastStateChange = new Date().toISOString();

    if (state === 'OPEN') {
      this.stats.circuitOpenCount++;
    } else if (state === 'CLOSED') {
      this.stats.circuitCloseCount++;
    } else if (state === 'HALF_OPEN') {
      this.stats.circuitHalfOpenCount++;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  reset() {
    this.stats = {
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      fallbackCount: 0,
      circuitOpenCount: 0,
      circuitCloseCount: 0,
      circuitHalfOpenCount: 0,
      lastStateChange: null,
      currentState: 'CLOSED',
    };
  }
}

/**
 * Create Redis Circuit Breaker
 * Factory function that wraps a Redis client with circuit breaker protection
 *
 * @param {Object} redisClient - ioredis or redis client instance
 * @param {Object} options - Circuit breaker configuration options
 * @returns {Object} Wrapped Redis client with circuit breaker and metrics
 */
export function createRedisCircuitBreaker(redisClient, options = {}) {
  const config = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  const metrics = new CircuitMetrics();

  // Create wrapped Redis operations with circuit breaker
  const operations = {};

  // Common Redis operations to protect
  const REDIS_OPERATIONS = [
    'get',
    'set',
    'setex',
    'del',
    'keys',
    'flushdb',
    'expire',
    'ttl',
    'exists',
  ];

  REDIS_OPERATIONS.forEach(operation => {
    // Create circuit breaker for each operation
    const breaker = new CircuitBreaker(async (...args) => {
      // Execute the actual Redis operation
      return await redisClient[operation](...args);
    }, config);

    // Event: Circuit opened (failure threshold exceeded)
    breaker.on('open', () => {
      metrics.updateState('OPEN');
      logger.warn(`[RedisCircuitBreaker] Circuit OPENED for operation: ${operation}`, {
        failureCount: metrics.stats.failureCount,
        successCount: metrics.stats.successCount,
        errorThreshold: config.errorThresholdPercentage,
      });
    });

    // Event: Circuit half-open (testing recovery)
    breaker.on('halfOpen', () => {
      metrics.updateState('HALF_OPEN');
      logger.info(`[RedisCircuitBreaker] Circuit HALF-OPEN for operation: ${operation}`, {
        testRequests: config.halfOpenRequests,
      });
    });

    // Event: Circuit closed (recovery successful)
    breaker.on('close', () => {
      metrics.updateState('CLOSED');
      logger.info(`[RedisCircuitBreaker] Circuit CLOSED for operation: ${operation}`, {
        successCount: metrics.stats.successCount,
      });
    });

    // Event: Successful operation
    breaker.on('success', () => {
      metrics.incrementSuccess();
      logger.debug(`[RedisCircuitBreaker] Operation succeeded: ${operation}`);
    });

    // Event: Operation failure
    breaker.on('failure', error => {
      metrics.incrementFailure();
      logger.warn(`[RedisCircuitBreaker] Operation failed: ${operation}`, {
        error: error.message,
        code: error.code,
      });
    });

    // Event: Operation timeout
    breaker.on('timeout', () => {
      metrics.incrementTimeout();
      logger.warn(`[RedisCircuitBreaker] Operation timeout: ${operation}`, {
        timeout: config.timeout,
      });
    });

    // Event: Fallback executed (circuit open, returning fallback value)
    breaker.on('fallback', () => {
      metrics.incrementFallback();
      logger.info(`[RedisCircuitBreaker] Fallback executed for: ${operation}`, {
        circuitState: metrics.stats.currentState,
      });
    });

    // Store wrapped operation
    operations[operation] = breaker;
  });

  /**
   * Get Circuit Breaker Health Status
   * Returns comprehensive health information for monitoring
   */
  function getHealthStatus() {
    const stats = metrics.getStats();
    const totalRequests = stats.successCount + stats.failureCount;
    const errorRate =
      totalRequests > 0 ? ((stats.failureCount / totalRequests) * 100).toFixed(2) : 0;

    return {
      status: stats.currentState === 'CLOSED' ? 'healthy' : 'degraded',
      circuitState: stats.currentState,
      metrics: {
        totalRequests,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        timeoutCount: stats.timeoutCount,
        fallbackCount: stats.fallbackCount,
        errorRate: `${errorRate}%`,
      },
      circuitHistory: {
        openCount: stats.circuitOpenCount,
        closeCount: stats.circuitCloseCount,
        halfOpenCount: stats.circuitHalfOpenCount,
        lastStateChange: stats.lastStateChange,
      },
      configuration: {
        errorThreshold: `${config.errorThresholdPercentage}%`,
        resetTimeout: `${config.resetTimeout}ms`,
        operationTimeout: `${config.timeout}ms`,
        volumeThreshold: config.volumeThreshold,
        halfOpenRequests: config.halfOpenRequests,
      },
    };
  }

  /**
   * Get Circuit Metrics
   * Returns raw metrics data for detailed monitoring
   */
  function getMetrics() {
    return metrics.getStats();
  }

  /**
   * Reset Circuit Breaker
   * Manually reset circuit to closed state (use with caution)
   */
  function resetCircuit() {
    Object.values(operations).forEach(breaker => {
      breaker.close();
    });
    metrics.reset();
    logger.info('[RedisCircuitBreaker] Circuit breaker manually reset');
  }

  /**
   * Check if Circuit is Open
   * Returns true if any operation has an open circuit
   */
  function isCircuitOpen() {
    return metrics.stats.currentState === 'OPEN';
  }

  return {
    // Wrapped Redis operations
    operations,

    // Health and monitoring
    getHealthStatus,
    getMetrics,
    isCircuitOpen,

    // Manual control (use with caution)
    resetCircuit,

    // Access to raw Redis client (for operations not wrapped)
    rawClient: redisClient,
  };
}

/**
 * Export default circuit breaker configuration
 */
export { DEFAULT_CIRCUIT_OPTIONS };
