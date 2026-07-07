/**
 * ultraRareTriggerEngine — FIRING integration tests (Equoria-oey96.9)
 *
 * Sentinel-positive coverage for the two ultra-rare traits whose evaluators
 * previously read NONEXISTENT relations (horse.dailyCareLogs / horse.groomTaskLogs)
 * and therefore could NEVER fire:
 *   - Born Leader   (was reading horse.dailyCareLogs + nonexistent milestone fields)
 *   - Stormtouched  (was reading horse.dailyCareLogs + horse.groomTaskLogs)
 *
 * Each trait has a POSITIVE arm (seed real qualifying data → trait FIRES) and a
 * NEGATIVE arm (one condition unmet → trait does NOT fire). Before the fix these
 * positive arms fail (the evaluators read undefined relations → never trigger).
 *
 * Real DB, no mocks. All fixtures use the TestFixture- prefix. Cleanup is scoped
 * and fail-loud (Equoria-0y9f5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { evaluateUltraRareTriggers } from '../../../utils/ultraRareTriggerEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const cleanup = createCleanupTracker();

let user;
let groom;
let bornLeaderHorse;
let bornLeaderNegHorse;
let stormtouchedHorse;
let stormtouchedNegHorse;

const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  user = await prisma.user.create({
    data: {
      email: `urfire-${ts}-${rand()}@test.com`,
      username: `urfire${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'URFire',
      lastName: 'Tester',
      money: 1000,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-URFire-Groom-${ts}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  // ── Born Leader (POSITIVE): top bond + steady temperament + top-tier
  //    conformation + 2 leadership moments ────────────────────────────────────
  bornLeaderHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URFire-BornLeader-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(ts - 400 * DAY),
      age: 1,
      userId: user.id,
      temperament: 'Steady',
      bondScore: 90, // >= 85 top tier
      conformationScores: {
        head: 85,
        neck: 85,
        shoulders: 85,
        back: 85,
        legs: 85,
        hooves: 85,
        topline: 85,
        hindquarters: 85,
        overallConformation: 85,
      },
    },
  });
  // 2 leadership moments recorded in milestone logs (finalTrait / reasoning)
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: bornLeaderHorse.id,
      milestoneType: 'confidence_reactivity',
      score: 4,
      finalTrait: 'confident',
      reasoning: 'foal displayed leadership in the herd',
      ageInDays: 30,
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: bornLeaderHorse.id,
      milestoneType: 'trust_handling',
      score: 4,
      finalTrait: 'confident',
      reasoning: 'natural leader tendencies observed',
      ageInDays: 60,
    },
  });

  // ── Born Leader (NEGATIVE): identical EXCEPT bond below top tier ────────────
  bornLeaderNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URFire-BornLeaderNeg-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(ts - 400 * DAY),
      age: 1,
      userId: user.id,
      temperament: 'Steady',
      bondScore: 50, // below 85 → topBond FALSE
      conformationScores: {
        head: 85,
        overallConformation: 85,
      },
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: bornLeaderNegHorse.id,
      milestoneType: 'confidence_reactivity',
      score: 4,
      finalTrait: 'confident',
      ageInDays: 30,
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: bornLeaderNegHorse.id,
      milestoneType: 'trust_handling',
      score: 4,
      finalTrait: 'confident',
      ageInDays: 60,
    },
  });

  // ── Stormtouched (POSITIVE): reactive temperament + >=7-day care gap +
  //    novelty task + 2 stress spikes (via groomInteractions) ─────────────────
  stormtouchedHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URFire-Stormtouched-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(ts - 300 * DAY),
      age: 1,
      userId: user.id,
      temperament: 'Reactive',
    },
  });
  // interaction at base, base+1d (novelty + spike), then base+11d → 10-day gap
  await prisma.groomInteraction.create({
    data: {
      foalId: stormtouchedHorse.id,
      groomId: groom.id,
      interactionType: 'desensitization',
      duration: 30,
      taskType: 'desensitization',
      stressChange: 8, // spike #1
      timestamp: new Date(ts - 40 * DAY),
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: stormtouchedHorse.id,
      groomId: groom.id,
      interactionType: 'novelty_exposure',
      duration: 30,
      taskType: 'novelty_exposure', // novelty event
      stressChange: 7, // spike #2
      timestamp: new Date(ts - 39 * DAY),
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: stormtouchedHorse.id,
      groomId: groom.id,
      interactionType: 'grooming',
      duration: 30,
      taskType: 'grooming',
      stressChange: 0,
      timestamp: new Date(ts - 29 * DAY), // 10-day gap from previous → missed care week
    },
  });

  // ── Stormtouched (NEGATIVE): NOT reactive temperament (else identical) ──────
  stormtouchedNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URFire-StormtouchedNeg-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(ts - 300 * DAY),
      age: 1,
      userId: user.id,
      temperament: 'Calm', // NOT reactive → Stormtouched FALSE
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: stormtouchedNegHorse.id,
      groomId: groom.id,
      interactionType: 'novelty_exposure',
      duration: 30,
      taskType: 'novelty_exposure',
      stressChange: 8,
      timestamp: new Date(ts - 40 * DAY),
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: stormtouchedNegHorse.id,
      groomId: groom.id,
      interactionType: 'grooming',
      duration: 30,
      taskType: 'grooming',
      stressChange: 8,
      timestamp: new Date(ts - 29 * DAY),
    },
  });

  const horseIds = [bornLeaderHorse.id, bornLeaderNegHorse.id, stormtouchedHorse.id, stormtouchedNegHorse.id];
  for (const id of horseIds) {
    cleanup.add(() => prisma.horse.delete({ where: { id } }), `horse:${id}`);
  }
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 30000);

describe('Born Leader — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: top bond + steady temperament + top-tier conformation + 2 leadership moments', async () => {
    const result = await evaluateUltraRareTriggers(bornLeaderHorse.id);
    const names = result.map(t => t.name);
    expect(names).toContain('Born Leader');
  }, 20000);

  it('does NOT fire when bond is below the top tier (negative arm)', async () => {
    const result = await evaluateUltraRareTriggers(bornLeaderNegHorse.id);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Born Leader');
  }, 20000);
});

describe('Stormtouched — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: reactive temperament + missed care week + novelty event + 2 stress spikes', async () => {
    const result = await evaluateUltraRareTriggers(stormtouchedHorse.id);
    const names = result.map(t => t.name);
    expect(names).toContain('Stormtouched');
  }, 20000);

  it('does NOT fire when temperament is not reactive (negative arm)', async () => {
    const result = await evaluateUltraRareTriggers(stormtouchedNegHorse.id);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Stormtouched');
  }, 20000);
});
