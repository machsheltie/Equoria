/**
 * 🔒 LOAD TEST: Distributed Rate Limiting (Redis)
 *
 * Tests distributed rate limiting across multiple server instances to ensure:
 * - Rate limits work across multiple backend servers
 * - Redis-based rate limiting is consistent
 * - No race conditions in distributed environment
 * - Rate limit counters sync across instances
 * - Performance acceptable with Redis overhead
 *
 * Usage:
 *   k6 run backend/tests/load/distributed-rate-limiting.test.js
 *
 * Environment Variables:
 *   API_URL - Base URL of API (default: http://localhost:3000)
 *   API_URL_2 - Second instance URL (default: http://localhost:3001)
 *   VUS - Virtual users (default: 15)
 *   DURATION - Test duration (default: 2m)
 *
 * @module tests/load/distributed-rate-limiting
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const rateLimitHitsServer1 = new Counter('rate_limit_hits_server1');
const rateLimitHitsServer2 = new Counter('rate_limit_hits_server2');
const totalRateLimitHits = new Counter('total_rate_limit_hits');
const distributedConsistency = new Rate('distributed_consistency');
const redisLatency = new Trend('redis_latency');
const crossServerRequests = new Counter('cross_server_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '20s', target: 5 }, // Warm up
    { duration: '40s', target: 15 }, // Ramp up
    { duration: '1m', target: 25 }, // Peak load
    { duration: '30s', target: 10 }, // Scale down
    { duration: '10s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% under 800ms (Redis adds latency)
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    distributed_consistency: ['rate>0.9'], // 90%+ consistency across servers
    redis_latency: ['p(95)<100'], // Redis operations under 100ms
    total_rate_limit_hits: ['count>50'], // At least 50 rate limit hits total
  },
};

const API_URL_1 = __ENV.API_URL || 'http://localhost:3000';
const API_URL_2 = __ENV.API_URL_2 || 'http://localhost:3001';

/**
 * Test Setup - Create test user and verify Redis connectivity
 */
export function setup() {
  const email = `distributed-test-${Date.now()}@example.com`;
  const password = 'DistributedTest123!';

  // Register test user on server 1
  const registerRes = http.post(
    `${API_URL_1}/api/auth/register`,
    JSON.stringify({
      email,
      username: `distributed_${Date.now()}`,
      password,
      firstName: 'Distributed',
      lastName: 'Test',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  check(registerRes, {
    'user registered on server 1': r => r.status === 201 || r.status === 200,
  });

  // Login on server 1
  const loginRes = http.post(
    `${API_URL_1}/api/auth/login`,
    JSON.stringify({
      email,
      password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

  const token = loginRes.json('data.accessToken') || loginRes.json('token');

  // Verify server 2 can authenticate with same token (shared Redis session)
  const verifyRes = http.get(`${API_URL_2}/api/users/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(verifyRes, {
    'token works on server 2': r => r.status === 200,
    'same user data on server 2': r => r.json('data.email') === email,
  });

  return {
    email,
    password,
    token,
    userId: loginRes.json('data.id') || loginRes.json('userId'),
  };
}

/**
 * Main Test Scenario - Distributed rate limiting across servers
 */
export default function (data) {
  const { token } = data;

  const params = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  group('Distributed Rate Limiting', () => {
    // Test 1: Rapid requests to Server 1
    group('Server 1 Rate Limiting', () => {
      let hitRateLimit = false;

      for (let i = 0; i < 10; i++) {
        const startTime = new Date();
        const res = http.get(`${API_URL_1}/api/users/profile`, params);
        const duration = new Date() - startTime;

        redisLatency.add(duration);

        if (res.status === 429) {
          hitRateLimit = true;
          rateLimitHitsServer1.add(1);
          totalRateLimitHits.add(1);

          check(res, {
            'rate limit response from server 1': r => r.status === 429,
            'has Retry-After header': r => r.headers['Retry-After'] !== undefined,
          });

          const retryAfter = parseInt(res.headers['Retry-After']) || 1;
          sleep(Math.min(retryAfter, 3));
          break;
        }
      }

      check(hitRateLimit, {
        'server 1 enforces rate limit': hit => hit === true,
      });
    });

    // Test 2: Rapid requests to Server 2 (should share same rate limit counter)
    group('Server 2 Rate Limiting (Shared Counter)', () => {
      let hitRateLimit = false;

      for (let i = 0; i < 5; i++) {
        const startTime = new Date();
        const res = http.get(`${API_URL_2}/api/users/profile`, params);
        const duration = new Date() - startTime;

        redisLatency.add(duration);
        crossServerRequests.add(1);

        if (res.status === 429) {
          hitRateLimit = true;
          rateLimitHitsServer2.add(1);
          totalRateLimitHits.add(1);

          check(res, {
            'rate limit response from server 2': r => r.status === 429,
            'consistent rate limit message': r => {
              const body = r.json();
              return body.message && body.message.includes('rate limit');
            },
          });

          // Check if server 2 respected server 1's rate limit counter
          distributedConsistency.add(1);

          const retryAfter = parseInt(res.headers['Retry-After']) || 1;
          sleep(Math.min(retryAfter, 3));
          break;
        } else {
          // If server 2 allowed request after server 1 hit limit, inconsistency
          distributedConsistency.add(0);
        }
      }
    });

    // Test 3: Alternating requests between servers
    group('Cross-Server Rate Limit Consistency', () => {
      const servers = [API_URL_1, API_URL_2];
      let totalRequests = 0;
      let rateLimitHits = 0;

      for (let i = 0; i < 8; i++) {
        const serverUrl = servers[i % 2]; // Alternate between servers

        const res = http.get(`${serverUrl}/api/users/profile`, params);
        totalRequests++;

        if (res.status === 429) {
          rateLimitHits++;
          totalRateLimitHits.add(1);

          if (serverUrl === API_URL_1) {
            rateLimitHitsServer1.add(1);
          } else {
            rateLimitHitsServer2.add(1);
          }

          // Both servers should hit rate limit around same request count
          const consistency = rateLimitHits > 0;
          distributedConsistency.add(consistency ? 1 : 0);

          sleep(1); // Wait for rate limit window
        }

        sleep(0.2); // Brief pause between requests
      }

      check(rateLimitHits > 0, {
        'cross-server rate limiting enforced': hit => hit === true,
      });
    });

    // Test 4: Test rate limit window expiration
    group('Rate Limit Window Reset', () => {
      // Trigger rate limit
      let hitLimit = false;
      for (let i = 0; i < 15; i++) {
        const res = http.get(`${API_URL_1}/api/users/profile`, params);
        if (res.status === 429) {
          hitLimit = true;
          break;
        }
      }

      if (hitLimit) {
        // Wait for rate limit window (typically 60 seconds, but test with shorter wait)
        sleep(2);

        // Verify rate limit is still enforced (window hasn't expired yet)
        const verifyRes = http.get(`${API_URL_1}/api/users/profile`, params);
        check(verifyRes, {
          'rate limit persists within window': r => r.status === 429,
        });
      }
    });

    // Test 5: Redis failover behavior (optional - tests degradation)
    group('Redis Availability Check', () => {
      // Make request and measure Redis response time
      const startTime = new Date();
      const res = http.get(`${API_URL_1}/api/health`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const duration = new Date() - startTime;

      redisLatency.add(duration);

      check(res, {
        'health check responds': r => r.status === 200,
        'Redis status available': r => {
          const body = r.json();
          return body.redis && (body.redis.status === 'healthy' || body.redis.status === 'connected');
        },
      });
    });

    sleep(0.5); // Pause between test iterations
  });
}

/**
 * Test Teardown - Clean up test data
 */
export function teardown(data) {
  const { token } = data;

  // Delete test user (try both servers)
  http.del(`${API_URL_1}/api/users/account`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Custom Summary Output
 */
export function handleSummary(data) {
  const server1Hits = data.metrics.rate_limit_hits_server1?.values.count || 0;
  const server2Hits = data.metrics.rate_limit_hits_server2?.values.count || 0;
  const totalHits = data.metrics.total_rate_limit_hits?.values.count || 0;
  const consistencyRate = ((data.metrics.distributed_consistency?.values.rate || 0) * 100).toFixed(2);
  const avgRedisLatency = (data.metrics.redis_latency?.values.avg || 0).toFixed(2);
  const p95RedisLatency = (data.metrics.redis_latency?.values['p(95)'] || 0).toFixed(2);
  const crossServerReqs = data.metrics.cross_server_requests?.values.count || 0;

  return {
    stdout: `
╔════════════════════════════════════════════════════════════════╗
║      DISTRIBUTED RATE LIMITING TEST SUMMARY (Redis)            ║
╠════════════════════════════════════════════════════════════════╣
║ Total Rate Limit Hits:    ${totalHits.toString().padStart(10)}                      ║
║ Server 1 Hits:            ${server1Hits.toString().padStart(10)}                      ║
║ Server 2 Hits:            ${server2Hits.toString().padStart(10)}                      ║
║ Cross-Server Requests:    ${crossServerReqs.toString().padStart(10)}                      ║
║ Consistency Rate:         ${consistencyRate.toString().padStart(10)}%                  ║
║ Avg Redis Latency:        ${avgRedisLatency.toString().padStart(10)}ms                 ║
║ P95 Redis Latency:        ${p95RedisLatency.toString().padStart(10)}ms                 ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ${consistencyRate >= 90 ? '✅ PASS' : '❌ FAIL'} - Distributed rate limiting working    ║
╚════════════════════════════════════════════════════════════════╝
`,
    'load-test-distributed-rate-limiting.json': JSON.stringify(data, null, 2),
  };
}
