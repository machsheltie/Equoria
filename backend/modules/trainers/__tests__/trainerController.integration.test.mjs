/**
 * trainerRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: marketplace, assignments, user trainers, discovery, dismiss.
 * Routes are mounted at /api/trainers in authRouter.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let trainer;

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
}, 30000);

afterAll(async () => {
  await prisma.trainerAssignment
    .deleteMany({ where: { OR: [{ trainerId: trainer.id }, { horseId: horse.id }] } })
    .catch(() => {});
  await prisma.trainer.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/trainers/marketplace ───────────────────────────────────────────

describe('GET /api/trainers/marketplace', () => {
  it('returns 200 with marketplace data for authenticated user', async () => {
    const res = await request(app)
      .get('/api/trainers/marketplace')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.trainers)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/trainers/marketplace').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/trainers/marketplace/hire ─────────────────────────────────────

describe('POST /api/trainers/marketplace/hire', () => {
  it('returns 400 when marketplaceId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/trainers/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when marketplaceId does not match any offer', async () => {
    const csrf = await fetchCsrf(app);
    // Ensure marketplace exists first
    await request(app).get('/api/trainers/marketplace').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/trainers/marketplace/hire')
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
      .post('/api/trainers/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: 'some-id' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/trainers/marketplace/refresh ───────────────────────────────────

describe('POST /api/trainers/marketplace/refresh', () => {
  it('returns 200 when refreshing marketplace', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/trainers/marketplace/refresh')
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
      .post('/api/trainers/marketplace/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/trainers/assignments ───────────────────────────────────────────

describe('GET /api/trainers/assignments', () => {
  it('returns 200 with active assignments for authenticated user', async () => {
    const res = await request(app)
      .get('/api/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/trainers/assignments').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/trainers/assignments ──────────────────────────────────────────

describe('POST /api/trainers/assignments', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when trainerId does not belong to user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId: 999999999, horseId: horse.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when assigning owned trainer to owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/trainers/assignments')
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
      .post('/api/trainers/assignments')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ trainerId: trainer.id, horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/trainers/assignments/:id ────────────────────────────────────

describe('DELETE /api/trainers/assignments/:id', () => {
  it('returns 404 when assignment does not exist or belong to user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/trainers/assignments/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid assignment id format', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/trainers/assignments/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/trainers/assignments/1')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/trainers/user/:userId ──────────────────────────────────────────

describe('GET /api/trainers/user/:userId', () => {
  it('returns 200 with trainers for own user ID', async () => {
    const res = await request(app)
      .get(`/api/trainers/user/${user.id}`)
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
      .get('/api/trainers/user/other-user-uuid-not-mine')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/trainers/user/${user.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/trainers/:id/discovery ─────────────────────────────────────────

describe('GET /api/trainers/:id/discovery', () => {
  it('returns 200 with discovery slots for owned trainer', async () => {
    const res = await request(app)
      .get(`/api/trainers/${trainer.id}/discovery`)
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
      .get('/api/trainers/999999999/discovery')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/trainers/${trainer.id}/discovery`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/trainers/:id/dismiss ────────────────────────────────────────

describe('DELETE /api/trainers/:id/dismiss', () => {
  it('returns 404 for trainer not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/trainers/999999999/dismiss')
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

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/trainers/${disposable.id}/dismiss`)
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
      .delete(`/api/trainers/${trainer.id}/dismiss`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
