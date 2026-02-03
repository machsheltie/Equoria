import request from 'supertest';
import { generateTestToken, authHeader } from '../../tests/helpers/authHelper.mjs';

process.env.TEST_BYPASS_RATE_LIMIT = 'false';
process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '100';

const { default: app } = await import('../../app.mjs');

describe('Horse routes rate limiting', () => {
  it('should apply query rate limiter to GET /api/horses', async () => {
    // Test bypass mechanism removed for production security (2025-01-16)
    // Tests now use real JWT tokens via backend/tests/helpers/authHelper.mjs
    const token = generateTestToken({ id: 'test-user-uuid-123', role: 'user' });

    const response = await request(app).get('/api/horses').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    // Query rate limiter default is 100; global limiter uses a much higher test limit.
    expect(response.headers['ratelimit-limit']).toBe('100');
  });
});
