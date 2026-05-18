/**
 * enhancedGroomController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getEnhancedInteractions, performEnhancedInteraction, getRelationshipDetails,
 * getInteractionTypes, getRelationshipLevels, getSpecialEvents.
 * Routes live under authRouter at /api/grooms/enhanced.
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

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let groom;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `egroom-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `egroom${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EGroom',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-EnhancedGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnhancedHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2022-06-01'),
      age: 3,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/grooms/enhanced/interactions/types ──────────────────────────────

describe('GET /api/grooms/enhanced/interactions/types', () => {
  it('returns 200 with interaction types', async () => {
    const res = await request(app)
      .get('/api/grooms/enhanced/interactions/types')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/grooms/enhanced/interactions/types').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/grooms/enhanced/relationship-levels ────────────────────────────

describe('GET /api/grooms/enhanced/relationship-levels', () => {
  it('returns 200 with relationship level definitions', async () => {
    const res = await request(app)
      .get('/api/grooms/enhanced/relationship-levels')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/grooms/enhanced/relationship-levels').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/grooms/enhanced/special-events ─────────────────────────────────

describe('GET /api/grooms/enhanced/special-events', () => {
  it('returns 200 with special event definitions', async () => {
    const res = await request(app)
      .get('/api/grooms/enhanced/special-events')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/grooms/enhanced/special-events').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/grooms/enhanced/interactions/:groomId/:horseId ─────────────────

describe('GET /api/grooms/enhanced/interactions/:groomId/:horseId', () => {
  it('returns 200 with available interactions for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/interactions/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  // Equoria-ogmu: regression — response.horse.age must equal the DB value
  // (game-years), NOT the real-time day count. The controller previously
  // mutated `horse.age = ageInDays`, masquerading days as years to the API.
  it('returns horse.age as game-years (not days) and ageInDays as a separate field', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/interactions/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const respHorse = res.body.data.horse;

    // The fixture is created with age=3 (game-years). The response must echo it.
    expect(respHorse.age).toBe(3);

    // ageInDays is a separate field, day-granular, much larger than the game-year age.
    expect(typeof respHorse.ageInDays).toBe('number');
    expect(respHorse.ageInDays).toBeGreaterThan(respHorse.age);
    expect(respHorse.ageInDays).toBeGreaterThan(700); // DOB 2022-06-01 → > ~700 days

    // Sentinel: catches re-introduction of the `horse.age = ageInDays` mutation.
    expect(respHorse.age).not.toBe(respHorse.ageInDays);
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/interactions/999999999/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/interactions/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/grooms/enhanced/relationship/:groomId/:horseId ─────────────────

describe('GET /api/grooms/enhanced/relationship/:groomId/:horseId', () => {
  it('returns 200 with relationship details for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/relationship/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/relationship/999999999/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/grooms/enhanced/relationship/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/grooms/enhanced/interact ──────────────────────────────────────

describe('POST /api/grooms/enhanced/interact', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/grooms/enhanced/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid duration', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/grooms/enhanced/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        horseId: horse.id,
        interactionType: 'grooming',
        variation: 'standard',
        duration: 999, // Invalid: max is 180
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/grooms/enhanced/interact')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        horseId: horse.id,
        interactionType: 'grooming',
        variation: 'standard',
        duration: 30,
      });

    expect(res.status).toBe(401);
  });
});
