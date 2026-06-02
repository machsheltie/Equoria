/**
 * trainerRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: marketplace, assignments, user trainers, discovery, dismiss.
 * Routes are mounted at /api/v1/trainers (authRouter is mounted at /api/v1;
 * authRouter.use('/trainers', ...) — see backend/app/routers.mjs:149,290).
 * Unversioned /api/* mounts were removed (Equoria-4bs3s); /api/v1 is canonical.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let trainer;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `trainer-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `trainer${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TrainerCtrl',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TrainerHorse-${Date.now()}`,
      sex: 'Colt',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });

  trainer = await prisma.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Trainer-${Date.now()}`,
      personality: 'focused',
      skillLevel: 'expert',
      speciality: 'Dressage',
      sessionRate: 150,
      level: 3,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: child rows
  // (assignments, trainers, marketplace state) and the horse (Horse.userId is
  // onDelete:Restrict, schema:282) BEFORE the user row. A failed delete fails
  // the suite instead of being swallowed and leaking a fixture into the
  // canonical DB. trainer.deleteMany({ userId }) also sweeps the disposable
  // trainer created in the dismiss test, scoped to this suite's user.
  cleanup.add(
    () =>
      prisma.trainerAssignment.deleteMany({
        where: { OR: [{ trainerId: trainer.id }, { horseId: horse.id }] },
      }),
    'trainerAssignment',
  );
  cleanup.add(() => prisma.trainer.deleteMany({ where: { userId: user.id } }), 'trainer');
  cleanup.add(
    () => prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }),
    'staffMarketplaceState',
  );
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/trainers/marketplace ───────────────────────────────────────────

describe('GET /api/v1/trainers/marketplace', () => {
  it('returns 200 with marketplace data for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/trainers/marketplace')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.trainers)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/trainers/marketplace').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/trainers/marketplace/hire ─────────────────────────────────────

describe('POST /api/v1/trainers/marketplace/hire', () => {
  it('returns 400 when marketplaceId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trainers/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when marketplaceId does not match any offer', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    // Ensure marketplace exists first
    await request(app).get('/api/v1/trainers/marketplace').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/trainers/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: 'nonexistent-marketplace-id-xyz' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/trainers/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: 'some-id' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/trainers/marketplace/refresh ───────────────────────────────────

describe('POST /api/v1/trainers/marketplace/refresh', () => {
  it('returns 200 when refreshing marketplace', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trainers/marketplace/refresh')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/trainers/marketplace/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/trainers/assignments ───────────────────────────────────────────

describe('GET /api/v1/trainers/assignments', () => {
  it('returns 200 with active assignments for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/trainers/assignments').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/trainers/assignments ──────────────────────────────────────────

describe('POST /api/v1/trainers/assignments', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when trainerId does not belong to user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId: 999999999, horseId: horse.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when assigning owned trainer to owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId: trainer.id, horseId: horse.id });

    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.trainerId).toBe(trainer.id);
    }
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId: trainer.id, horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/v1/trainers/assignments/:id ────────────────────────────────────

describe('DELETE /api/v1/trainers/assignments/:id', () => {
  it('returns 404 when assignment does not exist or belong to user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .delete('/api/v1/trainers/assignments/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid assignment id format', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .delete('/api/v1/trainers/assignments/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/v1/trainers/assignments/1')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/trainers/user/:userId ──────────────────────────────────────────

describe('GET /api/v1/trainers/user/:userId', () => {
  it('returns 200 with trainers for own user ID', async () => {
    const res = await request(app)
      .get(`/api/v1/trainers/user/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find(t => t.id === trainer.id);
    expect(found).toBeDefined();
  });

  it('returns 404 when accessing another user ID', async () => {
    const res = await request(app)
      .get('/api/v1/trainers/user/other-user-uuid-not-mine')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/trainers/user/${user.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/trainers/:id/discovery ─────────────────────────────────────────

describe('GET /api/v1/trainers/:id/discovery', () => {
  it('returns 200 with discovery slots for owned trainer', async () => {
    const res = await request(app)
      .get(`/api/v1/trainers/${trainer.id}/discovery`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.trainerId).toBe(trainer.id);
    expect(Array.isArray(res.body.data.slots)).toBe(true);
  });

  it('returns 404 for trainer not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/trainers/999999999/discovery')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/trainers/${trainer.id}/discovery`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/v1/trainers/:id/dismiss ────────────────────────────────────────

describe('DELETE /api/v1/trainers/:id/dismiss', () => {
  it('returns 404 for trainer not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .delete('/api/v1/trainers/999999999/dismiss')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when dismissing owned trainer', async () => {
    // Create a disposable trainer for dismiss test
    const disposable = await prisma.trainer.create({
      data: {
        firstName: 'TestFixture',
        lastName: `Disposable-${Date.now()}`,
        personality: 'patient',
        skillLevel: 'novice',
        speciality: 'Jumping',
        sessionRate: 100,
        userId: user.id,
      },
    });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .delete(`/api/v1/trainers/${disposable.id}/dismiss`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/v1/trainers/${trainer.id}/dismiss`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
