/**
 * 🔒 User-documentation refresh — public-write removal + admin gating
 *     (Equoria-bs6fc, OWASP A01 Broken Access Control)
 *
 * The defect: `userDocumentationRoutes` is mounted on the PUBLIC
 * (unauthenticated) router at `/user-docs` and `/api/user-docs`, and it
 * exposed `POST /refresh` — a cache-mutation endpoint that forces a repeated
 * disk-read of the docs directory. Any anonymous caller could hit it (despite
 * the route comment claiming "admin only"), giving an unauthenticated
 * cache-thrash / DoS lever.
 *
 * The fix:
 *   1. REMOVE the public `POST /refresh` route from the user-docs router.
 *      Anonymous POST to either public mount now 404s (no handler).
 *   2. Relocate the privileged refresh to `POST /api/v1/admin/docs/refresh`,
 *      behind the adminRouter's authenticateToken + requireRole('admin') +
 *      csrfProtection chain.
 *   3. Keep the public GET read endpoints public and working.
 *
 * No mocks. Real Express app, real DB, real JWT, real CSRF. This is a
 * cross-cutting test (public docs router + admin router + auth/CSRF
 * middleware), so it lives in backend/__tests__/ per the module-test
 * convention.
 *
 * AC mapping:
 *   - anonymous POST /user-docs/refresh           → not 200 (route removed → 404)
 *   - anonymous POST /api/user-docs/refresh        → not 200 (route removed → 404)
 *   - anonymous POST /api/v1/admin/docs/refresh    → 401 (authenticateToken)
 *   - admin (real JWT + CSRF) POST .../docs/refresh → 200 (admin path succeeds)
 *   - public GET docs read endpoints               → 200 (reads stay available)
 */

import request from 'supertest';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const ADMIN_REFRESH_ROUTE = '/api/v1/admin/docs/refresh';

describe('User-documentation refresh access control (Equoria-bs6fc)', () => {
  let admin;
  let adminToken;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup — deletes only the admin user this suite made.
  cleanup.add(
    () => prisma.user.deleteMany({ where: { id: { in: [admin?.id].filter(Boolean) } } }),
    'user',
  );

  beforeAll(async () => {
    const pw = await bcrypt.hash('AdminPassword123!', 1);
    admin = await prisma.user.create({
      data: {
        username: `bs6fc_admin_${ts}`,
        email: `bs6fc_admin_${ts}@example.com`,
        password: pw,
        firstName: 'TestFixture-bs6fc',
        lastName: 'Admin',
        role: 'admin',
        mfaEnabled: false,
      },
    });
    adminToken = generateTestToken({ id: admin.id, role: 'admin' });
  }, 120000);

  afterAll(async () => {
    await cleanup.run();
  }, 120000);

  // ─── Sentinel-positive: the PUBLIC write route must be GONE ──────────────────

  it('anonymous POST /user-docs/refresh is NOT publicly accessible (route removed)', async () => {
    const res = await request(app).post('/user-docs/refresh').set('Origin', ORIGIN);
    // The route was deleted from the public router → falls through to 404.
    // The critical assertion is that it is NOT a 200 success (the old defect).
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(404);
  });

  it('anonymous POST /api/user-docs/refresh is NOT publicly accessible (route removed)', async () => {
    const res = await request(app).post('/api/user-docs/refresh').set('Origin', ORIGIN);
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(404);
  });

  it('anonymous POST /api/v1/admin/docs/refresh is rejected by auth (401)', async () => {
    const res = await request(app).post(ADMIN_REFRESH_ROUTE).set('Origin', ORIGIN);
    // authenticateToken runs before csrfProtection on the adminRouter, so an
    // unauthenticated caller is rejected at the auth boundary, not allowed in.
    expect(res.status).not.toBe(200);
    expect([401, 403]).toContain(res.status);
  });

  // ─── Positive-path: the relocated admin route MUST work for an admin ─────────

  it('admin (real JWT + CSRF) POST /api/v1/admin/docs/refresh succeeds (200)', async () => {
    // Bearer-header auth → CSRF token is bound to the salt identifier (see
    // resolveSessionIdentifier in middleware/csrf.mjs), so fetchCsrf without an
    // access cookie yields a token that validates for this header-auth POST.
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_REFRESH_ROUTE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/refreshed successfully/i);
    expect(res.body.data.refreshedAt).toBeDefined();
  });

  // ─── Read endpoints stay public (no regression) ─────────────────────────────

  it('public GET /api/user-docs (list) remains available (200)', async () => {
    const res = await request(app).get('/api/user-docs').set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('public GET /user-docs/health remains available (200)', async () => {
    const res = await request(app).get('/user-docs/health').set('Origin', ORIGIN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
