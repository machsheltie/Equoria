/**
 * enhancedMilestoneController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMilestoneDefinitions, getMilestoneStatus, evaluateMilestone.
 * Routes live under authRouter at /api/milestones.
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
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `emilestone-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `emilestone${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EMilestone',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-MilestoneHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.milestoneTraitLog.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/milestones/milestone-definitions ────────────────────────────────

describe('GET /api/milestones/milestone-definitions', () => {
  it('returns 200 with milestone type definitions', async () => {
    const res = await request(app)
      .get('/api/milestones/milestone-definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.milestoneTypes).toBeDefined();
    expect(res.body.data.developmentalWindows).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/milestones/milestone-definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/milestones/milestone-status/:horseId ───────────────────────────

describe('GET /api/milestones/milestone-status/:horseId', () => {
  it('returns 200 with milestone status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/milestones/milestone-status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse.id);
    expect(res.body.data.availableMilestones).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/milestones/milestone-status/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/milestones/milestone-status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/milestones/evaluate-milestone ──────────────────────────────────

describe('POST /api/milestones/evaluate-milestone', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/milestones/evaluate-milestone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid milestoneType', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/milestones/evaluate-milestone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: horse.id,
        milestoneType: 'invalid_milestone_type',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/milestones/evaluate-milestone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: 999999999,
        milestoneType: 'imprinting',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 or 400 when evaluating imprinting for owned foal', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/milestones/evaluate-milestone')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: horse.id,
        milestoneType: 'imprinting',
      });

    // 200 = evaluated successfully; 400 = milestone not evaluable (e.g., outside window)
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/milestones/evaluate-milestone')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: horse.id,
        milestoneType: 'imprinting',
      });

    expect(res.status).toBe(401);
  });
});
