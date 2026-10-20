/**
 * enhancedMilestoneController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMilestoneDefinitions, getMilestoneStatus. (evaluateMilestone and
 * POST /milestones/evaluate-milestone were removed by Equoria-gu8jk — players
 * never write milestone or ultra-rare trait logs; only the daily job evaluates.)
 * Routes live under authRouter at /api/v1/milestones (Equoria-vivsi: the
 * unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:177).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-twmpa: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. milestoneTraitLog -> horse -> user
// (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();

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
  cleanup.add(() => prisma.milestoneTraitLog.deleteMany({ where: { horseId: horse.id } }), 'milestoneTraitLog');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/milestones/milestone-definitions ─────────────────────────────

describe('GET /api/milestones/milestone-definitions', () => {
  it('returns 200 with milestone type definitions', async () => {
    const res = await request(app)
      .get('/api/v1/milestones/milestone-definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.milestoneTypes).toBeDefined();
    expect(res.body.data.developmentalWindows).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/milestones/milestone-definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/milestones/milestone-status/:horseId ────────────────────────

describe('GET /api/milestones/milestone-status/:horseId', () => {
  it('returns 200 with milestone status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/milestones/milestone-status/${horse.id}`)
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
      .get('/api/v1/milestones/milestone-status/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/milestones/milestone-status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
