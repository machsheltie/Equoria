/**
 * 🔒 API-documentation mutations — public-write removal + admin gating
 *     (Equoria-7osu4, OWASP A01 Broken Access Control)
 *
 * The defect: `documentationRoutes` is mounted on the PUBLIC (unauthenticated)
 * router at `/docs` and `/api/docs` (backend/app/routers.mjs), and it exposed
 * three state-changing endpoints — `POST /generate`, `POST /endpoints`, and
 * `POST /schemas` — carrying only a per-route `authenticateToken`. There was NO
 * admin-role gating and NO CSRF. That let any authenticated NON-admin caller
 * register arbitrary endpoints/schemas and, via `generateDocumentation()`,
 * force a write to the curated `swagger.yaml` on disk.
 *
 * The fix (mirrors the Equoria-bs6fc `/api/v1/admin/docs/refresh` fix):
 *   1. REMOVE the public POST mutations from the /docs router. A public POST to
 *      either mount now 404s (no handler).
 *   2. Relocate the privileged mutations behind the adminRouter:
 *        POST /api/v1/admin/docs/generate
 *        POST /api/v1/admin/docs/endpoints
 *        POST /api/v1/admin/docs/schemas
 *      each inheriting authenticateToken + requireRole('admin') + csrfProtection.
 *   3. Keep the public GET read endpoints (auth-gated reads) working.
 *
 * No mocks. Real Express app, real DB, real JWT, real CSRF. This is a
 * cross-cutting test (public docs router + admin router + auth/CSRF middleware),
 * so it lives in backend/__tests__/ per the module-test convention.
 *
 * The shared apiDocumentationService singleton's `swaggerPath` is redirected to
 * a throwaway temp copy for the lifetime of this suite so the admin /generate
 * test cannot mutate the curated backend/docs/swagger.yaml on disk.
 */

import request from 'supertest';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { cpSync, mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { getApiDocumentationService } from '../services/apiDocumentationService.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const ADMIN_GENERATE = '/api/v1/admin/docs/generate';
const ADMIN_ENDPOINTS = '/api/v1/admin/docs/endpoints';
const ADMIN_SCHEMAS = '/api/v1/admin/docs/schemas';

describe('API-documentation mutation access control (Equoria-7osu4)', () => {
  let admin;
  let adminToken;
  let member;
  let memberToken;
  let docService;
  let originalSwaggerPath;
  let tempDir;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup — deletes only the users this suite made.
  cleanup.add(
    () =>
      prisma.user.deleteMany({
        where: { id: { in: [admin?.id, member?.id].filter(Boolean) } },
      }),
    'user',
  );

  beforeAll(async () => {
    const pw = await bcrypt.hash('AdminPassword123!', 1);
    admin = await prisma.user.create({
      data: {
        username: `7osu4_admin_${ts}`,
        email: `7osu4_admin_${ts}@example.com`,
        password: pw,
        firstName: 'TestFixture-7osu4',
        lastName: 'Admin',
        role: 'admin',
        mfaEnabled: false,
      },
    });
    member = await prisma.user.create({
      data: {
        username: `7osu4_member_${ts}`,
        email: `7osu4_member_${ts}@example.com`,
        password: pw,
        firstName: 'TestFixture-7osu4',
        lastName: 'Member',
        role: 'user',
        mfaEnabled: false,
      },
    });
    adminToken = generateTestToken({ id: admin.id, role: 'admin' });
    memberToken = generateTestToken({ id: member.id, role: 'user' });

    // Redirect the singleton's swaggerPath to a throwaway temp copy so the
    // admin /generate test does not mutate the curated swagger.yaml on disk.
    docService = getApiDocumentationService();
    originalSwaggerPath = docService.swaggerPath;
    const canonical = join(process.cwd(), 'docs', 'swagger.yaml');
    const source = existsSync(canonical) ? canonical : docService.swaggerPath;
    tempDir = mkdtempSync(join(os.tmpdir(), 'equoria-docs-7osu4-'));
    const tempSwagger = join(tempDir, 'swagger.yaml');
    cpSync(source, tempSwagger);
    docService.swaggerPath = tempSwagger;
  }, 120000);

  afterAll(async () => {
    if (docService && originalSwaggerPath) {
      docService.swaggerPath = originalSwaggerPath;
    }
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    await cleanup.run();
  }, 120000);

  // ─── Sentinel-positive: the PUBLIC write routes must be GONE ─────────────────
  // The critical assertion is that they are NOT 200/201 (the old defect): an
  // authenticated NON-admin can no longer mutate documentation on the public
  // surface. The deleted routes fall through to 404.

  it('public POST /api/docs/generate is removed (404), even with a valid token', async () => {
    const res = await request(app)
      .post('/api/docs/generate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({});
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(404);
  });

  it('public POST /api/docs/endpoints is removed (404), even with a valid token', async () => {
    const res = await request(app)
      .post('/api/docs/endpoints')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ method: 'POST', path: '/api/x', summary: 'X' });
    expect(res.status).not.toBe(201);
    expect(res.status).toBe(404);
  });

  it('public POST /api/docs/schemas is removed (404), even with a valid token', async () => {
    const res = await request(app)
      .post('/api/docs/schemas')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'X', schema: { type: 'object' } });
    expect(res.status).not.toBe(201);
    expect(res.status).toBe(404);
  });

  // ─── Admin routes reject anonymous + non-admin callers ──────────────────────

  it('anonymous POST /api/v1/admin/docs/generate is rejected by auth (401/403)', async () => {
    const res = await request(app).post(ADMIN_GENERATE).set('Origin', ORIGIN).send({});
    expect(res.status).not.toBe(200);
    expect([401, 403]).toContain(res.status);
  });

  it('non-admin (valid JWT + CSRF) POST /api/v1/admin/docs/endpoints is forbidden (403)', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_ENDPOINTS)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ method: 'POST', path: '/api/x', summary: 'X' });
    // requireRole('admin') rejects the non-admin before the handler runs.
    expect(res.status).not.toBe(201);
    expect(res.status).toBe(403);
  });

  // ─── Positive-path: relocated admin routes MUST work for an admin ───────────

  it('admin (real JWT + CSRF) POST /api/v1/admin/docs/endpoints registers (201)', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_ENDPOINTS)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        method: 'GET',
        path: `/api/test/7osu4-${ts}`,
        summary: '7osu4 endpoint',
        description: '7osu4 endpoint',
        tags: ['Testing'],
        responses: { 200: { description: 'Success' } },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.method).toBe('GET');
    expect(res.body.data.path).toBe(`/api/test/7osu4-${ts}`);
  });

  it('admin POST /api/v1/admin/docs/endpoints validates input (400)', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_ENDPOINTS)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ method: 'INVALID', path: '', summary: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('admin (real JWT + CSRF) POST /api/v1/admin/docs/schemas registers (201)', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_SCHEMAS)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: `Schema7osu4_${ts}`,
        schema: { type: 'object', properties: { id: { type: 'string' } } },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(`Schema7osu4_${ts}`);
  });

  it('admin (real JWT + CSRF) POST /api/v1/admin/docs/generate succeeds (200)', async () => {
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await request(app)
      .post(ADMIN_GENERATE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.generatedAt).toBeDefined();
    expect(res.body.data.specificationVersion).toBeDefined();
  });

  // ─── Read endpoints stay (auth-gated) reads — no regression ─────────────────

  it('public GET /api/docs/health still requires auth (401, not 404 — route exists)', async () => {
    const res = await request(app).get('/api/docs/health').set('Origin', ORIGIN);
    // The read route still exists (not removed): an unauthenticated caller is
    // rejected at the auth boundary (401), not 404.
    expect(res.status).toBe(401);
  });

  it('GET /api/docs/health returns 200 for an authenticated reader', async () => {
    const res = await request(app)
      .get('/api/docs/health')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/docs/analytics reports an honest trend (computed from persisted snapshots, no fabricated literal)', async () => {
    // Equoria-zr9kl: trends are now derived from persisted coverage snapshots.
    // The shape is DB-state-dependent (the canonical DB may or may not already
    // hold >=2 snapshots), so assert the contract is internally CONSISTENT — the
    // crucial invariant is that any non-null direction is a REAL classification
    // (improving/declining/stable), never the old hard-coded 'stable'/'improving'
    // literal returned regardless of data. The dedicated seeded proof lives in
    // backend/modules/docs/__tests__/documentationCoverageTrend.integration.test.mjs.
    const res = await request(app)
      .get('/api/docs/analytics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    const { trends } = res.body.data;
    expect(typeof trends.tracked).toBe('boolean');
    const validDirections = [null, 'improving', 'declining', 'stable'];
    expect(validDirections).toContain(trends.coverageTrend);
    expect(validDirections).toContain(trends.qualityTrend);
    if (trends.tracked === false) {
      expect(trends.coverageTrend).toBeNull();
      expect(trends.qualityTrend).toBeNull();
    } else {
      expect(trends.coverageTrend).not.toBeNull();
      expect(trends.qualityTrend).not.toBeNull();
    }
  });
});
