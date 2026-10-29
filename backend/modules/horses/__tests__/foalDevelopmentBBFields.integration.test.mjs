/**
 * GET /api/v1/foals/:foalId/development — BB.1/BB.2/BB.3 additive fields
 * (Equoria-oey96.17).
 *
 * Audit finding P2-7: the /development endpoint returned only the legacy
 * 6-day structure. The age-stage payload (BB.1/BB.2) had been bolted onto a
 * DIFFERENT endpoint (GET /:foalId/activities), and the BB.3 milestone store
 * was never surfaced here. This suite proves the endpoint now returns, on the
 * ratified game-year cadence (Equoria-oey96.16; 7 real days = 1 game year):
 *
 *   BB.1  ageInWeeks · birthDate
 *   BB.3  completedMilestones: Array<{ id, timestamp }> read from the REAL
 *         persisted FoalDevelopment.completedMilestones store — the detection
 *         WRITE path is Equoria-oey96.18, so a fresh foal reports [] honestly;
 *         this suite SEEDS a real milestone row to prove the read path
 *         surfaces persisted data (not a hardcoded []).
 *
 * ADDITIVITY: every legacy field the FoalDetailPage flow reads
 * (development.currentDay/bondingLevel/maxDay, activityHistory,
 * foal) must remain present with unchanged semantics.
 *
 * Equoria-fr2kg. OLD CONTRACT: the response also carried the player-run
 * enrichment and activity fields (development.completedActivities,
 * enrichmentDay, enrichmentWindowOpen, availableEnrichmentActivities, and the
 * BB.2 stage-filtered availableActivities). NEW RULING (owner, 2026-10-14/15):
 * foal enrichment is the groom's job, so none of those fields are returned.
 *
 * Equoria-fr2kg Q5. OLD CONTRACT: BB.1 also returned `ageStage` (newborn /
 * weanling / yearling / twoYearOld), and reading development recorded
 * stage-* milestones. NEW RULING (owner, 2026-10-15): the named life stages
 * are removed, so neither is returned or recorded.
 *
 * Real DB, real Express, no mocks. Scoped TestFixture- cleanup (CLAUDE.md §2).
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
// Equoria-n7qa3: fail-loud scoped cleanup.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

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
const TAG = `oey9617-${randomBytes(4).toString('hex')}`;
// A real, server-shaped ISO timestamp seeded into the milestone store.
const SEEDED_MILESTONE_TS = '2026-01-01T00:00:00.000Z';

let user;
let token;
let yearlingFoal;

beforeAll(async () => {
  // FK-order scoped cleanup (Equoria-n7qa3): child rows → horse → user.
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: yearlingFoal.id } }), 'foalActivity');
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: yearlingFoal.id } }), 'foalDevelopment');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: yearlingFoal.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${TAG}@test.com`,
      username: TAG,
      password: 'irrelevant-hash',
      firstName: 'BB',
      lastName: 'Fields',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // dob 9 real days ago → game-year 1 (7–13 real days).
  yearlingFoal = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-${TAG}-Yearling`,
      sex: 'Filly',
      dateOfBirth: dobDaysAgo(9),
      age: 1,
      bondScore: 30,
      userId: user.id,
    }),
  });

  // Seed a FoalDevelopment row WITH a real completedMilestones store so the
  // read path is proven to surface persisted milestones (Constitution §2 —
  // empty is honest only after a real query; a seeded row proves non-empty).
  await prisma.foalDevelopment.create({
    data: {
      foalId: yearlingFoal.id,
      currentDay: 2,
      bondingLevel: 45,
      completedActivities: { 0: ['gentleTouch'] },
      completedMilestones: { bond25: SEEDED_MILESTONE_TS },
    },
  });
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/foals/:foalId/development — BB.1/BB.2/BB.3 additive (Equoria-oey96.17)', () => {
  let data;

  it('returns 200 for the owned foal', async () => {
    const res = await request(app)
      .get(`/api/v1/foals/${yearlingFoal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    data = res.body.data;
    expect(data).toBeDefined();
  });

  it('BB.1: exposes ageInWeeks / birthDate on the game-year clock, and no ageStage', () => {
    expect(data).not.toHaveProperty('ageStage');
    expect(data.ageInWeeks).toBe(1);
    expect(data.birthDate).toBe(yearlingFoal.dateOfBirth.toISOString());
  });

  // Equoria-fr2kg Q16. OLD CONTRACT: bondingLevel echoed the legacy
  // FoalDevelopment column (45 here). NEW RULING (owner, 2026-10-22): it carries
  // the horse's real Horse.bondScore (30 here); the legacy column is kept but
  // ignored.
  it("ADDITIVE: every development field is present; the bond is the horse's own", () => {
    expect(data.development.currentDay).toBe(2);
    expect(data.development.bondingLevel).toBe(30);
    expect(data.development.maxDay).toBe(6);
    expect(Array.isArray(data.activityHistory)).toBe(true);
    expect(data.foal.id).toBe(yearlingFoal.id);
  });

  it('carries no player-run enrichment or activity fields (Equoria-fr2kg)', () => {
    expect(data.development).not.toHaveProperty('completedActivities');
    expect(data.development).not.toHaveProperty('enrichmentDay');
    expect(data.development).not.toHaveProperty('enrichmentWindowOpen');
    expect(data).not.toHaveProperty('availableEnrichmentActivities');
    expect(data).not.toHaveProperty('availableActivities');
  });

  it('BB.3: completedMilestones is Array<{id,timestamp}> read from the real persisted store', () => {
    expect(Array.isArray(data.completedMilestones)).toBe(true);
    expect(data.completedMilestones).toContainEqual({
      id: 'bond25',
      timestamp: SEEDED_MILESTONE_TS,
    });
  });

  it('records no named life-stage milestone for a 9-day-old foal (Equoria-fr2kg Q5)', () => {
    const ids = data.completedMilestones.map(m => m.id);
    expect(ids.filter(id => id.startsWith('stage-'))).toEqual([]);
  });
});
