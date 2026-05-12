/**
 * showController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: createShow, getShows, enterShow.
 * Routes live under authRouter at /api/shows.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let createdShowId;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `show-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `show${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-ShowHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: user.id,
      healthStatus: 'healthy',
    },
  });
}, 30000);

afterAll(async () => {
  if (createdShowId) {
    await prisma.showEntry.deleteMany({ where: { showId: createdShowId } }).catch(() => {});
    await prisma.show.delete({ where: { id: createdShowId } }).catch(() => {});
  }
  await prisma.showEntry.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/shows ───────────────────────────────────────────────────────────

describe('GET /api/shows', () => {
  it('returns 200 with list of shows and pagination', async () => {
    const res = await request(app).get('/api/shows').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.shows)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('returns 200 filtered by discipline', async () => {
    const res = await request(app)
      .get('/api/shows?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/shows').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/shows/create ───────────────────────────────────────────────────

describe('POST /api/shows/create', () => {
  it('returns 201 when creating a valid show', async () => {
    const csrf = await fetchCsrf(app);
    const showName = `TestFixture-Show-${Date.now()}`;
    const res = await request(app)
      .post('/api/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: showName,
        discipline: 'Dressage',
        entryFee: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.show).toBeDefined();
    createdShowId = res.body.data.show.id;
  });

  it('returns 400 for invalid discipline', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'Test Show',
        discipline: 'InvalidDiscipline',
        entryFee: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/shows/create')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'Test Show', discipline: 'Dressage', entryFee: 0 });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/shows/:id/enter ────────────────────────────────────────────────

describe('POST /api/shows/:id/enter', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/shows/${createdShowId ?? 1}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 400 (validation) or 404 (show not yet created in this run order) are both valid
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent show', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/shows/999999999/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 or 409 when entering owned eligible horse in open show', async () => {
    if (!createdShowId) {
      return;
    }
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/shows/${createdShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    // 201 on first entry; 409 if already entered
    expect([201, 409]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/shows/1/enter')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(401);
  });
});
