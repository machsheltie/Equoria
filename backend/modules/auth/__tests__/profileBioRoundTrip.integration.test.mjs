/**
 * profileBioRoundTrip.integration.test.mjs (Equoria-pnd1z)
 *
 * The profile-edit UI exposes a `bio` field and PUTs it to
 * /api/v1/auth/profile, but the backend updateProfile controller never
 * destructured / persisted `bio` and getProfile never returned it — so bio
 * silently vanished (empty after PUT + reload; surfaced by the o5hub.42
 * Stage B pass, profile-edit.spec.ts line 230).
 *
 * Real-DB integration test — no mocks. Asserts bio round-trips through
 * PUT (persist + echo) and GET (return) and is stored on the User row.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('INTEGRATION: profile bio round-trip (Equoria-pnd1z)', () => {
  let __csrf__;
  let user;
  let token;
  const bio = `TestFixture bio ${Date.now()} — round-trip check`;

  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
    const ts = Date.now();
    const created = await createTestUser({
      username: `biort_${ts}`,
      email: `biort_${ts}@test.com`,
    });
    user = created.user;
    token = created.token;
  }, 120000);

  afterAll(async () => {
    await cleanupTestData();
  }, 120000);

  it('PUT /api/v1/auth/profile persists bio and echoes it in the response', async () => {
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toHaveProperty('bio', bio);
  });

  it('persists bio in the User.settings JSONB', async () => {
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true },
    });
    expect(fresh.settings.bio).toBe(bio);
  });

  it('GET /api/v1/auth/profile returns the persisted bio', async () => {
    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toHaveProperty('bio', bio);
  });

  it('clears bio when an explicit empty string is sent', async () => {
    const res = await request(app)
      .put('/api/v1/auth/profile')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toHaveProperty('bio', '');
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true },
    });
    expect(fresh.settings.bio).toBe('');
  });
});
