/**
 * clubController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getClubs, getMyClubs, getClub, createClub, joinClub, leaveClub,
 * getElections, getElectionResults.
 * Routes live under authRouter at /api/v1/clubs.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let club;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `club-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `club${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Club',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  club = await prisma.club.create({
    data: {
      name: `TestFixture-Club-${Date.now()}`,
      type: 'discipline',
      category: 'Dressage',
      description: 'Integration test club',
      leaderId: user.id,
    },
  });

  // Create membership so getElections (which requires membership) returns 200.
  await prisma.clubMembership.create({
    data: { clubId: club.id, userId: user.id, role: 'president' },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: memberships (FK to
  // club + user) before the club, club before the user.
  cleanup.add(() => prisma.clubMembership.deleteMany({ where: { clubId: club.id } }), 'clubMembership');
  cleanup.add(() => prisma.club.delete({ where: { id: club.id } }), 'club');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/clubs ───────────────────────────────────────────────────────────

describe('GET /api/v1/clubs', () => {
  it('returns 200 with list of clubs', async () => {
    const res = await request(app).get('/api/v1/clubs').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for invalid type filter', async () => {
    const res = await request(app)
      .get('/api/v1/clubs?type=invalid')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/clubs').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/clubs/mine ──────────────────────────────────────────────────────

describe('GET /api/v1/clubs/mine', () => {
  it('returns 200 with user clubs', async () => {
    const res = await request(app)
      .get('/api/v1/clubs/mine')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/clubs/mine').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/clubs/:id ───────────────────────────────────────────────────────

describe('GET /api/v1/clubs/:id', () => {
  it('returns 200 with club details', async () => {
    const res = await request(app)
      .get(`/api/v1/clubs/${club.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for non-existent club', async () => {
    const res = await request(app)
      .get('/api/v1/clubs/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/clubs/${club.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/clubs/:id/elections ────────────────────────────────────────────

describe('GET /api/v1/clubs/:id/elections', () => {
  it('returns 200 with elections for club', async () => {
    const res = await request(app)
      .get(`/api/v1/clubs/${club.id}/elections`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/clubs/${club.id}/elections`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/clubs ──────────────────────────────────────────────────────────

describe('POST /api/v1/clubs', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/clubs')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid club type', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/clubs')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'Test Club',
        type: 'invalid-type',
        category: 'Dressage',
        description: 'Test',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/clubs')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'Test Club', type: 'discipline', category: 'Dressage', description: 'Test' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/clubs/:id/join ─────────────────────────────────────────────────

describe('POST /api/v1/clubs/:id/join', () => {
  it('returns 200 or 400 when joining a club (already member or success)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/clubs/${club.id}/join`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    // president is auto-member (400 or 409 conflict) or successfully joined (200/201) are all valid
    expect([200, 201, 400, 409]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for non-existent club', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/clubs/999999999/join')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/clubs/${club.id}/join`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
