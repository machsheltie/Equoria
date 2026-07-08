/**
 * BB.3 foal milestone DETECTION + PERSISTENCE (Equoria-oey96.18).
 *
 * This is the write/detection half of BB.3. The read half (surfacing the
 * persisted `FoalDevelopment.completedMilestones` store as
 * Array<{ id, timestamp }> on GET /foals/:id/development) shipped in
 * Equoria-oey96.17. This suite proves the detection/write path actually
 * POPULATES that store from REAL gameplay state, for all four milestone
 * families, idempotently:
 *
 *   bond      — Horse.bondScore crosses 25/50/75/100 during a real interaction
 *   stage     — foal enters weanling/yearling/two-year-old stage (game-year clock)
 *   first-trait — first discovered/expressed epigenetic trait
 *   graduation  — foal reaches age 3 game-years (21 real days) via graduateFoal
 *
 * IDEMPOTENCY is the core correctness property: re-detecting on unchanged state
 * records nothing new and never duplicates a milestone (the store is keyed by
 * milestone id — duplication is structurally impossible).
 *
 * Real DB, real model/service code, no mocks. Scoped TestFixture- cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { detectAndRecordFoalMilestones, computeReachedMilestones } from '../services/foalMilestoneService.mjs';
import { completeEnrichmentActivity, graduateFoal } from '../models/foalModel.mjs';

const ORIGIN = 'http://localhost:3000';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// A dateOfBirth N whole days ago, anchored off-midnight UTC so the date-only
// game-year age math (Equoria-vdw5 / oey96.16) is exercised honestly.
function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

const cleanup = createCleanupTracker();
const TAG = `oey9618-${randomBytes(4).toString('hex')}`;
const createdFoalIds = [];

let user;
let token;

// Create a fixture foal and register scoped cleanup for its child rows.
async function makeFoal({ suffix, days, ageYears, bondScore = 0, epigeneticModifiers, epigeneticFlags }) {
  const data = {
    ...fixtureColor(),
    name: `TestFixture-${TAG}-${suffix}`,
    sex: 'Filly',
    dateOfBirth: dobDaysAgo(days),
    age: ageYears,
    bondScore,
    stressLevel: 10,
    userId: user.id,
  };
  if (epigeneticModifiers !== undefined) {
    data.epigeneticModifiers = epigeneticModifiers;
  }
  if (epigeneticFlags !== undefined) {
    data.epigeneticFlags = epigeneticFlags;
  }
  const foal = await prisma.horse.create({ data });
  createdFoalIds.push(foal.id);
  return foal;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.com`,
      username: TAG,
      password: 'irrelevant-hash',
      firstName: 'BB3',
      lastName: 'Detect',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Child rows first, then horses, then user (FK order). All scoped to this run.
  cleanup.add(
    () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: createdFoalIds } } }),
    'foalTrainingHistory',
  );
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: createdFoalIds } } }), 'foalActivity');
  cleanup.add(
    () => prisma.groomAssignment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'groomAssignment',
  );
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'foalDevelopment',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdFoalIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ---------------------------------------------------------------------------
// PURE detection (no DB) — the boundary logic.
// ---------------------------------------------------------------------------
describe('computeReachedMilestones — pure boundary logic', () => {
  it('reports bond milestones only for crossed thresholds', () => {
    const reached = computeReachedMilestones({ ageDays: 0, bondScore: 60, hasDiscoveredTrait: false });
    expect(reached).toContain('bond-25');
    expect(reached).toContain('bond-50');
    expect(reached).not.toContain('bond-75');
    expect(reached).not.toContain('bond-100');
  });

  it('reports each stage as its real-day boundary is crossed (game-year clock)', () => {
    expect(computeReachedMilestones({ ageDays: 2, bondScore: 0, hasDiscoveredTrait: false })).toEqual([]);
    expect(computeReachedMilestones({ ageDays: 9, bondScore: 0, hasDiscoveredTrait: false })).toEqual([
      'stage-weanling',
      'stage-yearling',
    ]);
    expect(computeReachedMilestones({ ageDays: 21, bondScore: 0, hasDiscoveredTrait: false })).toEqual([
      'stage-weanling',
      'stage-yearling',
      'stage-two-year-old',
      'graduation',
    ]);
  });

  it('reports first-trait when a trait is discovered', () => {
    expect(computeReachedMilestones({ ageDays: 0, bondScore: 0, hasDiscoveredTrait: true })).toContain('first-trait');
  });
});

// ---------------------------------------------------------------------------
// Bond milestone detection + idempotency (real DB, direct detection).
// ---------------------------------------------------------------------------
describe('bond milestone detection (real DB)', () => {
  it('records crossed bond milestones once and is idempotent on re-run', async () => {
    const foal = await makeFoal({ suffix: 'bond', days: 1, ageYears: 0, bondScore: 60 });

    const first = await detectAndRecordFoalMilestones(foal.id);
    expect(first.newMilestones).toContain('bond-25');
    expect(first.newMilestones).toContain('bond-50');
    expect(first.newMilestones).not.toContain('bond-75');

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones['bond-25']).toBeDefined();
    expect(persisted.completedMilestones['bond-50']).toBeDefined();
    const ts25 = persisted.completedMilestones['bond-25'];

    // Idempotency: re-run detects nothing new; timestamps are preserved.
    const second = await detectAndRecordFoalMilestones(foal.id);
    expect(second.newMilestones).toEqual([]);
    const persistedAgain = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persistedAgain.completedMilestones['bond-25']).toBe(ts25);
    expect(Object.keys(persistedAgain.completedMilestones).sort()).toEqual(
      Object.keys(persisted.completedMilestones).sort(),
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// First-trait milestone detection (real DB, direct detection).
// ---------------------------------------------------------------------------
describe('first-trait milestone detection (real DB)', () => {
  it('records first-trait once a discovered epigenetic trait exists; idempotent', async () => {
    const foal = await makeFoal({
      suffix: 'trait',
      days: 1,
      ageYears: 0,
      epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] },
    });

    const first = await detectAndRecordFoalMilestones(foal.id);
    expect(first.newMilestones).toContain('first-trait');

    const second = await detectAndRecordFoalMilestones(foal.id);
    expect(second.newMilestones).not.toContain('first-trait');
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones['first-trait']).toBe(first.completedMilestones['first-trait']);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Stage milestones surface through the REAL read endpoint (GET /development).
// ---------------------------------------------------------------------------
describe('stage milestone detection on the /development read path (HTTP, real DB)', () => {
  it('detecting on read records + surfaces the passed stage milestones', async () => {
    // 9 real days → yearling (game-year 1); age<=1 so /development is reachable.
    const foal = await makeFoal({ suffix: 'yearling', days: 9, ageYears: 1 });

    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.completedMilestones.map(m => m.id);
    expect(ids).toContain('stage-weanling');
    expect(ids).toContain('stage-yearling');
    expect(ids).not.toContain('stage-two-year-old');
    expect(ids).not.toContain('graduation');

    // Persisted for real (not just computed for the response).
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones['stage-weanling']).toBeDefined();
    expect(persisted.completedMilestones['stage-yearling']).toBeDefined();
  }, 30000);
});

// ---------------------------------------------------------------------------
// Bond milestone recorded by the REAL enrichment write path.
// ---------------------------------------------------------------------------
describe('bond milestone recorded on the enrichment write path (real DB)', () => {
  it('completing an enrichment activity that crosses 25 records bond-25', async () => {
    // dob today (day 0), bond 24 → any day-0 activity (+3..7) crosses 25.
    const foal = await makeFoal({ suffix: 'enrich', days: 0, ageYears: 0, bondScore: 24 });

    const result = await completeEnrichmentActivity(foal.id, 'gentle_touch');
    expect(result.levels.bondScore).toBeGreaterThanOrEqual(25);

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted).not.toBeNull();
    expect(persisted.completedMilestones['bond-25']).toBeDefined();
  }, 30000);
});

// ---------------------------------------------------------------------------
// Graduation milestone recorded by the REAL graduateFoal write path.
// ---------------------------------------------------------------------------
describe('graduation milestone recorded on the graduateFoal write path (real DB)', () => {
  it('graduating a 21-day foal records graduation + all passed stage milestones; idempotent', async () => {
    // 21 real days → age 3 game-years (graduated). age=3.
    const foal = await makeFoal({ suffix: 'grad', days: 21, ageYears: 3 });

    await graduateFoal(foal.id, user.id);

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones.graduation).toBeDefined();
    expect(persisted.completedMilestones['stage-weanling']).toBeDefined();
    expect(persisted.completedMilestones['stage-yearling']).toBeDefined();
    expect(persisted.completedMilestones['stage-two-year-old']).toBeDefined();
    const gradTs = persisted.completedMilestones.graduation;

    // Idempotency: a second detection does not duplicate / re-stamp graduation.
    const again = await detectAndRecordFoalMilestones(foal.id);
    expect(again.newMilestones).not.toContain('graduation');
    const persistedAgain = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persistedAgain.completedMilestones.graduation).toBe(gradTs);
  }, 30000);
});
