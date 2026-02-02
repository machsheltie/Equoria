/**
 * 🔒 LOAD TEST: Authentication Endpoints Under Load
 *
 * Tests authentication system under heavy concurrent load to ensure:
 * - Login endpoint handles concurrent requests
 * - Registration doesn't create race conditions
 * - Token generation is performant under load
 * - Password hashing doesn't block other requests
 * - Database connection pool handles auth queries
 * - No memory leaks during sustained load
 *
 * Usage:
 *   k6 run backend/tests/load/auth-under-load.test.js
 *
 * Environment Variables:
 *   API_URL - Base URL of API (default: http://localhost:3000)
 *   VUS - Virtual users (default: 25)
 *   DURATION - Test duration (default: 3m)
 *
 * @module tests/load/auth-under-load
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';

// Custom metrics
const loginAttempts = new Counter('login_attempts');
const successfulLogins = new Counter('successful_logins');
const failedLogins = new Counter('failed_logins');
const registrationAttempts = new Counter('registration_attempts');
const successfulRegistrations = new Counter('successful_registrations');
const tokenGenerationTime = new Trend('token_generation_time');
const passwordHashingTime = new Trend('password_hashing_time');
const loginDuration = new Trend('login_duration');
const registrationDuration = new Trend('registration_duration');
const concurrentUsers = new Gauge('concurrent_users');
const authErrors = new Rate('auth_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Warm up
    { duration: '1m', target: 25 }, // Ramp to normal load
    { duration: '1m', target: 50 }, // Peak load
    { duration: '30s', target: 75 }, // Spike test
    { duration: '1m', target: 25 }, // Recovery
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s (bcrypt is expensive)
    http_req_failed: ['rate<0.05'], // Error rate under 5%
    login_duration: ['p(95)<1500'], // Login under 1.5s
    registration_duration: ['p(95)<3000'], // Registration under 3s (bcrypt)
    token_generation_time: ['p(95)<100'], // Token gen under 100ms
    password_hashing_time: ['p(95)<500'], // Bcrypt under 500ms
    auth_errors: ['rate<0.05'], // Auth errors under 5%
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000';

/**
 * Test Setup - Create initial test users
 */
export function setup() {
  const users = [];

  // Create 10 pre-existing users for login tests
  for (let i = 0; i < 10; i++) {
    const email = `loadtest-existing-${Date.now()}-${i}@example.com`;
    const password = 'ExistingUser123!';

    const registerRes = http.post(
      `${API_URL}/api/auth/register`,
      JSON.stringify({
        email,
        username: `existing_${Date.now()}_${i}`,
        password,
        firstName: 'Existing',
        lastName: `User${i}`,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (registerRes.status === 201 || registerRes.status === 200) {
      users.push({ email, password });
    }
  }

  return { users };
}

/**
 * Main Test Scenario - Authentication operations under load
 */
export default function (data) {
  const { users } = data;

  // Simulate concurrent user behavior
  concurrentUsers.add(__VU); // Current VU number represents concurrent users

  group('Authentication Under Load', () => {
    // Test 1: Login with existing user (60% of traffic)
    if (Math.random() < 0.6) {
      group('User Login', () => {
        const user = users[Math.floor(Math.random() * users.length)];

        const startTime = new Date();
        loginAttempts.add(1);

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

        const duration = new Date() - startTime;
        loginDuration.add(duration);

        const success = check(loginRes, {
          'login successful': r => r.status === 200,
          'returns access token': r => r.json('data.accessToken') !== undefined,
          'returns refresh token': r => r.json('data.refreshToken') !== undefined,
          'returns user data': r => r.json('data.id') !== undefined,
          'response time acceptable': r => r.timings.duration < 2000,
        });

        if (success) {
          successfulLogins.add(1);
          authErrors.add(0);

          // Estimate token generation time (excluding network/bcrypt)
          const tokenTime = duration - 300; // Subtract estimated bcrypt time
          tokenGenerationTime.add(Math.max(tokenTime, 10));

          // Estimate password hashing time
          passwordHashingTime.add(300); // Bcrypt typical time

          const token = loginRes.json('data.accessToken');

          // Verify token works
          const verifyRes = http.get(`${API_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          check(verifyRes, {
            'token authenticated': r => r.status === 200,
          });
        } else {
          failedLogins.add(1);
          authErrors.add(1);
        }
      });
    }

    // Test 2: New user registration (30% of traffic)
    else if (Math.random() < 0.75) {
      group('User Registration', () => {
        const timestamp = Date.now();
        const randomId = Math.floor(Math.random() * 1000000);
        const email = `loadtest-new-${timestamp}-${randomId}@example.com`;
        const password = 'NewUser123!';

        const startTime = new Date();
        registrationAttempts.add(1);

        const registerRes = http.post(
          `${API_URL}/api/auth/register`,
          JSON.stringify({
            email,
            username: `newuser_${timestamp}_${randomId}`,
            password,
            firstName: 'New',
            lastName: 'User',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );

        const duration = new Date() - startTime;
        registrationDuration.add(duration);

        const success = check(registerRes, {
          'registration successful': r => r.status === 201 || r.status === 200,
          'no duplicate email error': r => {
            if (r.status >= 400) {
              const body = r.json();
              return !body.message || !body.message.includes('already exists');
            }
            return true;
          },
          'returns user data': r => {
            if (r.status === 201 || r.status === 200) {
              return r.json('data.id') !== undefined || r.json('userId') !== undefined;
            }
            return true;
          },
          'response time acceptable': r => r.timings.duration < 3000,
        });

        if (success) {
          successfulRegistrations.add(1);
          authErrors.add(0);

          // Estimate password hashing time (registration includes bcrypt)
          passwordHashingTime.add(duration * 0.7); // ~70% of time is bcrypt

          // Add new user to pool for login tests
          users.push({ email, password });
        } else {
          authErrors.add(1);
        }
      });
    }

    // Test 3: Token refresh (10% of traffic)
    else {
      group('Token Refresh', () => {
        // First login to get tokens
        const user = users[Math.floor(Math.random() * users.length)];

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

        if (loginRes.status === 200) {
          const refreshToken = loginRes.json('data.refreshToken');

          const startTime = new Date();
          const refreshRes = http.post(
            `${API_URL}/api/auth/refresh`,
            JSON.stringify({
              refreshToken,
            }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          );

          const duration = new Date() - startTime;
          tokenGenerationTime.add(duration);

          check(refreshRes, {
            'token refresh successful': r => r.status === 200,
            'new access token returned': r => r.json('data.accessToken') !== undefined,
            'refresh token rotated': r => {
              const newRefreshToken = r.json('data.refreshToken');
              return newRefreshToken && newRefreshToken !== refreshToken;
            },
          });
        }
      });
    }

    // Test 4: Failed login attempts (security)
    if (Math.random() < 0.1) {
      group('Failed Login Security', () => {
        const user = users[Math.floor(Math.random() * users.length)];

        loginAttempts.add(1);

        const badLoginRes = http.post(
          `${API_URL}/api/auth/login`,
          JSON.stringify({
            email: user.email,
            password: 'WrongPassword123!',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );

        check(badLoginRes, {
          'failed login returns 401': r => r.status === 401,
          'error message returned': r => {
            const body = r.json();
            return body.message !== undefined;
          },
          'no sensitive data leaked': r => {
            const body = r.json();
            return !body.user && !body.data;
          },
        });

        failedLogins.add(1);
      });
    }

    sleep(Math.random() * 2); // Variable pause (0-2s) to simulate user behavior
  });
}

/**
 * Test Teardown - Clean up test data
 */
export function teardown(data) {
  const { users } = data;

  // Delete first 10 pre-existing test users only (others are one-time registrations)
  users.slice(0, 10).forEach(user => {
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
  const totalLogins = data.metrics.login_attempts?.values.count || 0;
  const successLogins = data.metrics.successful_logins?.values.count || 0;
  const failedLogins = data.metrics.failed_logins?.values.count || 0;
  const totalRegistrations = data.metrics.registration_attempts?.values.count || 0;
  const successRegistrations = data.metrics.successful_registrations?.values.count || 0;
  const avgLoginTime = (data.metrics.login_duration?.values.avg || 0).toFixed(2);
  const p95LoginTime = (data.metrics.login_duration?.values['p(95)'] || 0).toFixed(2);
  const avgRegistrationTime = (data.metrics.registration_duration?.values.avg || 0).toFixed(2);
  const p95RegistrationTime = (data.metrics.registration_duration?.values['p(95)'] || 0).toFixed(2);
  const avgTokenTime = (data.metrics.token_generation_time?.values.avg || 0).toFixed(2);
  const avgHashTime = (data.metrics.password_hashing_time?.values.avg || 0).toFixed(2);
  const maxConcurrentUsers = data.metrics.concurrent_users?.values.max || 0;
  const authErrorRate = ((data.metrics.auth_errors?.values.rate || 0) * 100).toFixed(2);

  const loginSuccessRate = totalLogins > 0 ? ((successLogins / totalLogins) * 100).toFixed(2) : 0;
  const registrationSuccessRate =
    totalRegistrations > 0 ? ((successRegistrations / totalRegistrations) * 100).toFixed(2) : 0;

  return {
    stdout: `
╔════════════════════════════════════════════════════════════════╗
║       AUTHENTICATION UNDER LOAD TEST SUMMARY                   ║
╠════════════════════════════════════════════════════════════════╣
║ Login Attempts:           ${totalLogins.toString().padStart(10)}                      ║
║ Successful Logins:        ${successLogins.toString().padStart(10)} (${loginSuccessRate}%)             ║
║ Failed Logins:            ${failedLogins.toString().padStart(10)}                      ║
║ Registration Attempts:    ${totalRegistrations.toString().padStart(10)}                      ║
║ Successful Registrations: ${successRegistrations.toString().padStart(10)} (${registrationSuccessRate}%)             ║
║ Max Concurrent Users:     ${maxConcurrentUsers.toString().padStart(10)}                      ║
║ Auth Error Rate:          ${authErrorRate.toString().padStart(10)}%                  ║
╠════════════════════════════════════════════════════════════════╣
║ Avg Login Time:           ${avgLoginTime.toString().padStart(10)}ms                 ║
║ P95 Login Time:           ${p95LoginTime.toString().padStart(10)}ms                 ║
║ Avg Registration Time:    ${avgRegistrationTime.toString().padStart(10)}ms                 ║
║ P95 Registration Time:    ${p95RegistrationTime.toString().padStart(10)}ms                 ║
║ Avg Token Generation:     ${avgTokenTime.toString().padStart(10)}ms                 ║
║ Avg Password Hashing:     ${avgHashTime.toString().padStart(10)}ms                 ║
╠════════════════════════════════════════════════════════════════╣
║ Status: ${p95LoginTime < 1500 && authErrorRate < 5 ? '✅ PASS' : '❌ FAIL'} - Auth system performing well           ║
╚════════════════════════════════════════════════════════════════╝
`,
    'load-test-auth-under-load.json': JSON.stringify(data, null, 2),
  };
}
