/**
 * /api/v1/personality-evolution — what is left of the namespace.
 *
 * Equoria-5d8ba. OLD CONTRACT: GET /horse/:horseId/{triggers,stability,
 * predict,history} returned a horse's temperament "evolution" analysis
 * (predictions from constants, history always empty) and GET /config listed
 * the evolution system's configuration. NEW RULING (owner, 2026-10-22):
 * remove the horse temperament-evolution read endpoints and their tests.
 * Temperament only affects the show matrix, groom bond and trainer fit
 * (owner ruling 2026-10-21) and players never change it (Equoria-gu8jk), so
 * every one of those paths now answers 404, and the service behind them
 * (personalityEvolutionSystem, including the caller-less
 * evolveHorseTemperament) is gone.
 *
 * Kept: the groom paths stay 404 (Equoria-j5qui, Equoria-jy3f7 — groom
 * personalities never evolve) and POST /apply-effects stays a 410
 * (Equoria-bvddn.4 — an unauthorized no-op stub, closed).
 *
 * Routes live under authRouter at /api/v1/personality-evolution.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let groom;
let horse;
let breed;
let csrfPair;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  const tag = randomBytes(6).toString('hex');
  user = await prisma.user.create({
    data: {
      email: `pevol-${tag}@test.com`,
      username: `pevol${tag}`,
      password: 'irrelevant-hash',
      firstName: 'PEvol',
      lastName: 'Tester',
      money: 5000,
      xp: 0,
      level: 1,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  csrfPair = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

  breed = await prisma.breed.create({
    data: { name: `TestFixture-PersEvoBreed-${tag}`, description: 'personality-evolution removal test' },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-EvolGroom-${tag}`,
      speciality: 'foalCare',
      personality: 'calm',
      skillLevel: 'intermediate',
      experience: 100,
      level: 5,
      sessionRate: 25.0,
      isActive: true,
      userId: user.id,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EvolHorse-${tag}`,
      sex: 'Filly',
      dateOfBirth: new Date('2023-06-01T12:00:00Z'),
      age: 2,
      temperament: 'nervous',
      healthStatus: 'Good',
      userId: user.id,
      breedId: breed.id,
    },
  });

  // FK order: horse -> groom -> user -> breed.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'breed');
}, 60000);

afterAll(() => cleanup.run(), 60000);

// ─── Horse temperament-evolution reads — REMOVED (Equoria-5d8ba) ──────────────

describe('GET /api/v1/personality-evolution/horse/:horseId/* (removed, Equoria-5d8ba)', () => {
  it.each(['triggers', 'stability', 'predict', 'history'])(
    'GET /horse/:horseId/%s is 404 for the horse owner',
    async path => {
      const res = await request(app)
        .get(`/api/v1/personality-evolution/horse/${horse.id}/${path}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    },
  );

  it('GET /config is 404 (it described the removed evolution system)', async () => {
    const res = await request(app)
      .get('/api/v1/personality-evolution/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('the horse keeps its temperament', async () => {
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { temperament: true } });
    expect(after.temperament).toBe('nervous');
  });
});

// ─── GET /api/v1/personality-evolution/groom/:groomId/* — REMOVED ─────────────
// Equoria-j5qui, owner ruling 2026-10-22: groom personalities never evolve, so
// nothing describes a groom's evolution. Even the groom's owner gets 404.

describe('GET /api/v1/personality-evolution/groom/:groomId/* (removed)', () => {
  it.each(['triggers', 'stability', 'predict', 'history'])(
    'GET /groom/:groomId/%s is 404 for the groom owner',
    async path => {
      const res = await request(app)
        .get(`/api/v1/personality-evolution/groom/${groom.id}/${path}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    },
  );
});

// ─── POST /api/v1/personality-evolution/groom/:groomId/evolve — REMOVED ───────
// Equoria-jy3f7, owner ruling 2026-10-22: groom personalities never evolve.

describe('POST /api/v1/personality-evolution/groom/:groomId/evolve (removed)', () => {
  it('is 404 for the owner of the groom, and the groom keeps its personality', async () => {
    const before = await prisma.groom.findUnique({ where: { id: groom.id }, select: { personality: true } });
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({});

    expect(res.status).toBe(404);
    const after = await prisma.groom.findUnique({ where: { id: groom.id }, select: { personality: true } });
    expect(after.personality).toBe(before.personality);
  });
});

// ─── POST /api/v1/personality-evolution/apply-effects ────────────────────────
// Equoria-bvddn.4 (audit 2026-09-25): an unauthorized no-op stub, closed with
// 410 for every authenticated caller (precedent: POST /api/v1/users/:id/add-xp).

describe('POST /api/personality-evolution/apply-effects', () => {
  it('returns 410 Gone for a non-admin authenticated caller (route removed)', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/apply-effects')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({ entityId: horse.id, entityType: 'horse', evolutionType: 'trait_strengthening' })
      .expect(410);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/removed/i);
  });

  it('returns 410 (not 401/validation) even for a malformed body', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/apply-effects')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({ entityId: horse.id })
      .expect(410);

    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth (route is still gated by authenticateToken)', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/personality-evolution/apply-effects')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ entityId: horse.id, entityType: 'horse', evolutionType: 'trait_strengthening' });

    expect(res.status).toBe(401);
  });
});
