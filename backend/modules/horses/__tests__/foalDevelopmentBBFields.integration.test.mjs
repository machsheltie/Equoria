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
 *   BB.1  ageInWeeks · ageStage · birthDate
 *   BB.2  availableActivities filtered to the foal's age stage
 *         (getActivitiesForStage), NOT the day-based enrichment list
 *   BB.3  completedMilestones: Array<{ id, timestamp }> read from the REAL
 *         persisted FoalDevelopment.completedMilestones store — the detection
 *         WRITE path is Equoria-oey96.18, so a fresh foal reports [] honestly;
 *         this suite SEEDS a real milestone row to prove the read path
 *         surfaces persisted data (not a hardcoded []).
 *
 * ADDITIVITY: every legacy field the FoalDetailPage flow reads
 * (development.currentDay/bondingLevel/stressLevel/maxDay/completedActivities,
 * availableEnrichmentActivities, activityHistory, foal) must remain present
 * with unchanged semantics.
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
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.com`,
      username: TAG,
      password: 'irrelevant-hash',
      firstName: 'BB',
      lastName: 'Fields',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // dob 9 real days ago → yearling stage (game-year 1; 7–13 real days).
  yearlingFoal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-${TAG}-Yearling`,
      sex: 'Filly',
      dateOfBirth: dobDaysAgo(9),
      age: 1,
      bondScore: 30,
      stressLevel: 10,
      userId: user.id,
    },
  });

  // Seed a FoalDevelopment row WITH a real completedMilestones store so the
  // read path is proven to surface persisted milestones (Constitution §2 —
  // empty is honest only after a real query; a seeded row proves non-empty).
  await prisma.foalDevelopment.create({
    data: {
      foalId: yearlingFoal.id,
      currentDay: 2,
      bondingLevel: 45,
      stressLevel: 12,
      completedActivities: { 0: ['gentle_touch'] },
      completedMilestones: { bond25: SEEDED_MILESTONE_TS },
    },
  });

  // FK-order scoped cleanup (Equoria-n7qa3): child rows → horse → user.
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: yearlingFoal.id } }), 'foalActivity');
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: yearlingFoal.id } }), 'foalDevelopment');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: yearlingFoal.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
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

  it('BB.1: exposes ageStage / ageInWeeks / birthDate on the game-year clock', () => {
    expect(data.ageStage).toBe('yearling');
    expect(data.ageInWeeks).toBe(1);
    expect(data.birthDate).toBe(yearlingFoal.dateOfBirth.toISOString());
  });

  it('ADDITIVE: every legacy development field is preserved with unchanged semantics', () => {
    expect(data.development.currentDay).toBe(2);
    expect(data.development.bondingLevel).toBe(45);
    expect(data.development.stressLevel).toBe(12);
    expect(data.development.maxDay).toBe(6);
    expect(data.development.completedActivities).toEqual({ 0: ['gentle_touch'] });
    expect(data.development).toHaveProperty('enrichmentDay');
    expect(data.development).toHaveProperty('enrichmentWindowOpen');
    expect(Array.isArray(data.availableEnrichmentActivities)).toBe(true);
    expect(Array.isArray(data.activityHistory)).toBe(true);
    expect(data.foal.id).toBe(yearlingFoal.id);
  });

  it('BB.2: availableActivities is stage-filtered (getActivitiesForStage), not the day-based list', () => {
    expect(Array.isArray(data.availableActivities)).toBe(true);
    const ids = data.availableActivities.map(a => a.id);
    expect(ids).toContain('ground_work'); // yearling stage
    expect(ids).not.toContain('imprinting'); // newborn-only
    expect(ids).not.toContain('longe_work'); // two_year_old-only
    // The day-based enrichment activity ids (gentle_touch etc.) must NOT leak
    // into the stage list — those live under availableEnrichmentActivities.
    expect(ids).not.toContain('gentle_touch');
  });

  it('BB.3: completedMilestones is Array<{id,timestamp}> read from the real persisted store', () => {
    expect(Array.isArray(data.completedMilestones)).toBe(true);
    expect(data.completedMilestones).toContainEqual({
      id: 'bond25',
      timestamp: SEEDED_MILESTONE_TS,
    });
  });
});
