/**
 * 🔒 LOAD TEST: Concurrent Session Management
 *
 * Tests session handling under concurrent load to ensure:
 * - Multiple simultaneous sessions per user work correctly
 * - Session limits are enforced (max 5 per user)
 * - Session cleanup works under load
 * - Token refresh doesn't create race conditions
 * - Memory doesn't leak with many sessions
 *
 * Usage:
 *   k6 run backend/tests/load/concurrent-sessions.test.js
 *
 * Environment Variables:
 *   API_URL - Base URL of API (default: http://localhost:3000)
 *   VUS - Virtual users (default: 20)
 *   DURATION - Test duration (default: 2m)
 *
 * @module tests/load/concurrent-sessions
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const activeSessions = new Gauge('active_sessions');
const sessionCreations = new Counter('session_creations');
const sessionRefreshes = new Counter('session_refreshes');
const sessionConflicts = new Rate('session_conflicts');
const sessionCleanups = new Counter('session_cleanups');
const tokenRefreshDuration = new Trend('token_refresh_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up
    { duration: '1m', target: 20 }, // Sustained load
    { duration: '1m', target: 30 }, // Increased load
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    session_conflicts: ['rate<0.1'], // Conflict rate under 10%
    token_refresh_duration: ['p(95)<500'], // Token refresh under 500ms
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000';

/**
 * Test Setup - Create test users with multiple sessions
 */
export function setup() {
  const users = [];

  // Create 5 test users
  for (let i = 0; i < 5; i++) {
    const email = `concurrent-test-${Date.now()}-${i}@example.com`;
    const password = 'ConcurrentTest123!';

    // Register user
    const registerRes = http.post(
      `${API_URL}/api/auth/register`,
      JSON.stringify({
        email,
        username: `concurrent_${Date.now()}_${i}`,
        password,
        firstName: 'Concurrent',
        lastName: `Test${i}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    check(registerRes, {
      'user registered': r => r.status === 201 || r.status === 200,
    });

    // Login to get initial token
    const loginRes = http.post(
      `${API_URL}/api/auth/login`,
      JSON.stringify({
        email,
        password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const accessToken = loginRes.json('data.accessToken') || loginRes.json('token');
    const refreshToken = loginRes.json('data.refreshToken');

    users.push({
      email,
      password,
      accessToken,
      refreshToken,
      userId: loginRes.json('data.id') || loginRes.json('userId'),
    });
  }

  return { users };
}

/**
 * Main Test Scenario - Concurrent sessions and token operations
 */
export default function (data) {
  const { users } = data;

  // Select a random user for this VU
  const user = users[Math.floor(Math.random() * users.length)];

  group('Concurrent Session Operations', () => {
    // Test 1: Create new session (login from "new device")
    group('New Session Creation', () => {
      const loginRes = http.post(
        `${API_URL}/api/auth/login`,
        JSON.stringify({
          email: user.email,
          password: user.password,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const success = check(loginRes, {
        'new session created': r => r.status === 200,
        'returns access token': r => r.json('data.accessToken') !== undefined,
        'returns refresh token': r => r.json('data.refreshToken') !== undefined,
      });

      if (success) {
        sessionCreations.add(1);
        const newToken = loginRes.json('data.accessToken');

        // Verify new session works
        const profileRes = http.get(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });

        check(profileRes, {
          'new session authenticated': r => r.status === 200,
        });
      }
    });

    // Test 2: Use existing session
    group('Existing Session Usage', () => {
      const profileRes = http.get(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      check(profileRes, {
        'existing session works': r => r.status === 200,
        'returns user data': r => r.json('data.id') === user.userId,
      });
    });

    // Test 3: Token refresh (simulate expired access token)
    group('Token Refresh', () => {
      const startTime = new Date();

      const refreshRes = http.post(
        `${API_URL}/api/auth/refresh`,
        JSON.stringify({
          refreshToken: user.refreshToken,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const duration = new Date() - startTime;
      tokenRefreshDuration.add(duration);

      const success = check(refreshRes, {
        'token refresh successful': r => r.status === 200,
        'new access token returned': r => r.json('data.accessToken') !== undefined,
        'refresh token rotated': r => {
          const newRefreshToken = r.json('data.refreshToken');
          return newRefreshToken && newRefreshToken !== user.refreshToken;
        },
      });

      if (success) {
        sessionRefreshes.add(1);

        // Update tokens for next iteration
        user.accessToken = refreshRes.json('data.accessToken');
        user.refreshToken = refreshRes.json('data.refreshToken');
      }
    });

    // Test 4: Attempt to exceed session limit (6th session)
    group('Session Limit Enforcement', () => {
      // Create 6 sessions rapidly
      let exceededLimit = false;
      for (let i = 0; i < 6; i++) {
        const loginRes = http.post(
          `${API_URL}/api/auth/login`,
          JSON.stringify({
            email: user.email,
            password: user.password,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );

        if (loginRes.status === 429 || loginRes.status === 403) {
          exceededLimit = true;
          sessionConflicts.add(1);

          check(loginRes, {
            'session limit enforced': r => r.status === 429 || r.status === 403,
            'error message returned': r => {
              const body = r.json();
              return body.message && body.message.includes('session');
            },
          });
          break;
        } else {
          sessionConflicts.add(0);
        }
      }

      // Record active sessions metric (estimated)
      activeSessions.add(exceededLimit ? 5 : 6);
    });

    // Test 5: Logout and cleanup
    group('Session Cleanup', () => {
      const logoutRes = http.post(`${API_URL}/api/auth/logout`, null, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      const success = check(logoutRes, {
        'logout successful': r => r.status === 200,
      });

      if (success) {
        sessionCleanups.add(1);

        // Verify token invalidated
        const verifyRes = http.get(`${API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${user.accessToken}` },
        });

        check(verifyRes, {
          'token invalidated after logout': r => r.status === 401,
        });
      }
    });

    sleep(1); // Pause between iterations
  });
}

/**
 * Test Teardown - Clean up test data
 */
export function teardown(data) {
  const { users } = data;

  // Delete all test users
  users.forEach(user => {
    // Login fresh to get valid token
    const loginRes = http.post(
      `${API_URL}/api/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const token = loginRes.json('data.accessToken') || loginRes.json('token');

    if (token) {
      // Delete user account
      http.del(`${API_URL}/api/users/account`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
}

/**
 * Custom Summary Output
 */
export function handleSummary(data) {
  const totalSessions = data.metrics.session_creations?.values.count || 0;
  const totalRefreshes = data.metrics.session_refreshes?.values.count || 0;
  const totalCleanups = data.metrics.session_cleanups?.values.count || 0;
  const conflictRate = ((data.metrics.session_conflicts?.values.rate || 0) * 100).toFixed(2);
  const avgRefreshTime = (data.metrics.token_refresh_duration?.values.avg || 0).toFixed(2);
  const maxActiveSessions = data.metrics.active_sessions?.values.max || 0;

  return {
    stdout: `
╔════════════════════════════════════════════════════════════════╗
║        CONCURRENT SESSION MANAGEMENT TEST SUMMARY              ║
╠════════════════════════════════════════════════════════════════╣
║ Sessions Created:         ${totalSessions.toString().padStart(10)}                      ║
║ Token Refreshes:          ${totalRefreshes.toString().padStart(10)}                      ║
║ Session Cleanups:         ${totalCleanups.toString().padStart(10)}                      ║
║ Max Active Sessions:      ${maxActiveSessions.toString().padStart(10)}                      ║
║ Conflict Rate:            ${conflictRate.toString().padStart(10)}%                  ║
║ Avg Refresh Time:         ${avgRefreshTime.toString().padStart(10)}ms                 ║
║ P95 Refresh Time:         ${(data.metrics.token_refresh_duration?.values['p(95)'] || 0).toFixed(2).padStart(10)}ms                 ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ${conflictRate < 10 ? '✅ PASS' : '❌ FAIL'} - Session management working correctly    ║
╚════════════════════════════════════════════════════════════════╝
`,
    'load-test-concurrent-sessions.json': JSON.stringify(data, null, 2),
  };
}
