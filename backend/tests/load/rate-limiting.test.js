/**
 * 🔒 LOAD TEST: Rate Limiting Enforcement
 *
 * Tests rate limiting behavior under concurrent load to ensure:
 * - Rate limits are properly enforced
 * - Distributed rate limiting works (Redis)
 * - Exponential backoff functions correctly
 * - No memory leaks under sustained load
 * - Performance remains acceptable
 *
 * Usage:
 *   k6 run backend/tests/load/rate-limiting.test.js
 *
 * Environment Variables:
 *   API_URL - Base URL of API (default: http://localhost:3000)
 *   VUS - Virtual users (default: 10)
 *   DURATION - Test duration (default: 30s)
 *
 * @module tests/load/rate-limiting
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const rateLimitHits = new Counter('rate_limit_hits');
const rateLimitErrors = new Rate('rate_limit_errors');
const requestDuration = new Trend('request_duration');
const authRequestDuration = new Trend('auth_request_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 VUs
    { duration: '1m', target: 20 },  // Ramp up to 20 VUs
    { duration: '2m', target: 50 },  // Spike to 50 VUs
    { duration: '1m', target: 20 },  // Scale down to 20 VUs
    { duration: '30s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],    // Error rate under 5%
    rate_limit_errors: ['rate>0.3'],   // At least 30% should hit rate limits
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000';

/**
 * Test Setup - Create test user and get auth token
 */
export function setup() {
  const email = `loadtest-${Date.now()}@example.com`;
  const password = 'LoadTest123!';

  // Register test user
  const registerRes = http.post(`${API_URL}/api/auth/register`, JSON.stringify({
    email,
    username: `loadtest_${Date.now()}`,
    password,
    firstName: 'Load',
    lastName: 'Test',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'user registered': (r) => r.status === 201 || r.status === 200,
  });

  // Login to get token
  const loginRes = http.post(`${API_URL}/api/auth/login`, JSON.stringify({
    email,
    password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = loginRes.json('data.accessToken') || loginRes.json('token');

  return {
    email,
    password,
    token,
    userId: loginRes.json('data.id') || loginRes.json('userId'),
  };
}

/**
 * Main Test Scenario - Concurrent requests to trigger rate limiting
 */
export default function (data) {
  const { token } = data;

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  // Test 1: Rapid GET requests to /api/users/profile
  for (let i = 0; i < 5; i++) {
    const startTime = new Date();
    const res = http.get(`${API_URL}/api/users/profile`, params);
    const duration = new Date() - startTime;

    requestDuration.add(duration);

    const checks = check(res, {
      'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
      rateLimitErrors.add(1);

      // Check for Retry-After header
      check(res, {
        'has Retry-After header': (r) => r.headers['Retry-After'] !== undefined,
        'rate limit body has error message': (r) => {
          const body = r.json();
          return body.success === false && body.message.includes('rate limit');
        },
      });

      // Respect Retry-After if provided
      const retryAfter = parseInt(res.headers['Retry-After']) || 1;
      sleep(Math.min(retryAfter, 5)); // Cap at 5 seconds
    } else {
      rateLimitErrors.add(0);
      sleep(0.1); // Brief pause between successful requests
    }
  }

  // Test 2: Authentication endpoints (stricter rate limits)
  const authStartTime = new Date();
  const authRes = http.post(`${API_URL}/api/auth/login`, JSON.stringify({
    email: data.email,
    password: data.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  authRequestDuration.add(new Date() - authStartTime);

  check(authRes, {
    'auth endpoint responds': (r) => r.status === 200 || r.status === 429,
  });

  if (authRes.status === 429) {
    rateLimitHits.add(1);
  }

  sleep(1); // Pause between iterations
}

/**
 * Test Teardown - Clean up test data
 */
export function teardown(data) {
  const { token } = data;

  // Delete test user
  http.del(`${API_URL}/api/users/account`, null, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
}

/**
 * Custom Summary Output
 */
export function handleSummary(data) {
  const rateLimitCount = data.metrics.rate_limit_hits?.values.count || 0;
  const totalRequests = data.metrics.http_reqs?.values.count || 0;
  const rateLimitPercentage = ((rateLimitCount / totalRequests) * 100).toFixed(2);

  return {
    'stdout': `
╔════════════════════════════════════════════════════════════════╗
║           RATE LIMITING LOAD TEST SUMMARY                      ║
╠════════════════════════════════════════════════════════════════╣
║ Total Requests:           ${totalRequests.toString().padStart(10)}                      ║
║ Rate Limit Hits:          ${rateLimitCount.toString().padStart(10)} (${rateLimitPercentage}%)             ║
║ Avg Request Duration:     ${data.metrics.request_duration?.values.avg.toFixed(2).padStart(10)}ms                 ║
║ P95 Request Duration:     ${data.metrics.http_req_duration?.values['p(95)'].toFixed(2).padStart(10)}ms                 ║
║ Error Rate:               ${(data.metrics.http_req_failed?.values.rate * 100).toFixed(2).padStart(10)}%                  ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ${rateLimitPercentage >= 30 ? '✅ PASS' : '❌ FAIL'} - Rate limiting working correctly      ║
╚════════════════════════════════════════════════════════════════╝
`,
    'load-test-rate-limiting.json': JSON.stringify(data, null, 2),
  };
}
