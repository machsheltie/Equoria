import request from 'supertest';
import { generateTestToken, authHeader as _authHeader } from '../../tests/helpers/authHelper.mjs';

import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
import { snapshotEnv, restoreEnv } from '../../tests/helpers/envSnapshot.mjs';

// TEST_RATE_LIMIT_MAX_REQUESTS must be set before app.mjs imports the
// rate-limiting middleware (which reads it at factory time). Snapshot
// first so the mutation does not leak into other suites.
const __envSnap__ = snapshotEnv();
process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '100';

const { default: app } = await import('../../app.mjs');

describe('Horse routes rate limiting', () => {
  afterAll(() => {
    restoreEnv(__envSnap__);
  });

  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  it('should apply query rate limiter to GET /api/horses', async () => {
    // Test bypass mechanism removed for production security (2025-01-16)
    // Tests now use real JWT tokens via backend/tests/helpers/authHelper.mjs
    const token = generateTestToken({ id: 'test-user-uuid-123', role: 'user' });

    const response = await request(app)
      .get('/api/horses')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    // Query rate limiter default is 100; global limiter uses a much higher test limit.
    expect(response.headers['ratelimit-limit']).toBe('100');
  });
});
