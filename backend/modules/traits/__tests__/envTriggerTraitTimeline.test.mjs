/**
 * environmentalTriggerSystem unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal (age 0, no interactions).
 * Zero-interaction paths exercise the empty-data branches.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  generateEnvironmentalReport,
  loadEnvironmentalTriggerSnapshot,
  cumulativeExposure,
  detectTriggers,
  triggerThresholds,
} from '../services/environmentalTriggerSystem.mjs';
const analyze = async (horseId, project, ...rest) => project(await loadEnvironmentalTriggerSnapshot(horseId), ...rest);
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { realDateOrReason } from '../../../__tests__/helpers/expectRealDate.mjs';

let user;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `envtrigger-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `envtrigger${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EnvTrigger',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnvTriggerHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). Horse before user (FK Restrict).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── environmentalTriggerSystem ────────────────────────────────────────────────

describe('detectEnvironmentalTriggers', () => {
  it('returns empty trigger set for horse with no interactions', async () => {
    const result = await analyze(horse.id, detectTriggers);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.detectedTriggers)).toBe(true);
    expect(result.detectedTriggers).toHaveLength(0);
    expect(result.triggerStrength).toBe(0);
    expect(result.interactionCount).toBe(0);
    expect(Array.isArray(result.environmentalFactors)).toBe(true);
    expect(result.analysisWindow).toBe(30);
  });
});

describe('calculateTriggerThresholds', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyze(999999999, triggerThresholds)).rejects.toThrow();
  });

  it('returns threshold shape for newborn foal', async () => {
    const result = await analyze(horse.id, triggerThresholds);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.baseThreshold).toBe('number');
    expect(typeof result.ageInDays).toBe('number');
    expect(typeof result.finalThreshold).toBe('number');
    expect(typeof result.sensitivity).toBe('number');
    expect(result.finalThreshold).toBeGreaterThanOrEqual(0.1);
    expect(result.finalThreshold).toBeLessThanOrEqual(1.0);
  });

  it('newborn has high sensitivity (finalThreshold < 0.5)', async () => {
    const result = await analyze(horse.id, triggerThresholds);
    expect(result.finalThreshold).toBeLessThan(0.5);
  });
});

describe('trackCumulativeExposure', () => {
  it('returns zero exposure for horse with no interactions', async () => {
    const result = await analyze(horse.id, cumulativeExposure);
    expect(result.horseId).toBe(horse.id);
    expect(result.totalExposure).toBe(0);
    expect(typeof result.exposureByType).toBe('object');
    expect(Array.isArray(result.exposureTimeline)).toBe(true);
    expect(result.exposureTimeline).toHaveLength(0);
  });
});

describe('generateEnvironmentalReport', () => {
  it('returns comprehensive report for newborn foal', async () => {
    const result = await generateEnvironmentalReport(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.environmentalTriggers).toBe('object');
    expect(typeof result.triggerThresholds).toBe('object');
    // Owner ruling 2026-10-07 (Equoria-huuaf): no forecasts. Old contract: traitExpressionProbabilities.
    expect(result).not.toHaveProperty('traitExpressionProbabilities');
    expect(typeof result.cumulativeExposure).toBe('object');
    // Owner ruling 2026-10-07 (Equoria-5nxw0): no advice, windows or forecasts (old contract: criticalPeriodSensitivity and recommendations present).
    expect(result).not.toHaveProperty('criticalPeriodSensitivity');
    expect(result).not.toHaveProperty('recommendations');
    expect(realDateOrReason(result.reportTimestamp)).toBe('valid date');
  });
});

// traitTimelineService and its tests were removed with the trait reports
// (owner ruling 2026-10-28, q152; Equoria-a7f1p).

// ── calculateTriggerThresholds / evaluateTraitExpressionProbability /
//    assessCriticalPeriodSensitivity — age-bracket + residual-sensitivity
//    branches (Equoria-jkht) ────────────────────────────────────────────────────
//
// calculateTriggerThresholds ageModifier tiers:
//   <= 7  → 0.6  (covered by newborn fixture above)
//   <= 30 → 0.7  ← horse10d
//   <= 90 → 0.8  ← horse60d
//   > 90  → 1.0  ← horse100d
//
// evaluateTraitExpressionProbability ageModifier tiers:
//   <= 30 → 1.5  (covered by newborn fixture above)
//   <= 90 → 1.2  ← horse60d
//   > 90  → 0.8  ← horse100d (finalP≈0.08 → 'very_unlikely')

describe('age-bracket branches (Equoria-jkht)', () => {
  let ageUser;
  const ageCleanup = createCleanupTracker();
  let horse10d;
  let horse60d;
  let horse100d;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ageUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `et-ageb-${ts}-${rand()}@test.com`,
        username: `etageb${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ET',
        lastName: 'AgeBranch',
        money: 1000,
      },
    });

    const makeHorse = (name, daysAgo) =>
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name,
          sex: 'Filly',
          dateOfBirth: gameCalendarDate(new Date(ts), -daysAgo),
          age: 0,
          userId: ageUser.id,
        },
      });

    [horse10d, horse60d, horse100d] = await Promise.all([
      makeHorse(`TestFixture-ET-Age10-${ts}`, 10),
      makeHorse(`TestFixture-ET-Age60-${ts}`, 60),
      makeHorse(`TestFixture-ET-Age100-${ts}`, 100),
    ]);
  }, 30000);

  afterAll(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys). Horses (name-prefix) before user.
    ageCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ET-Age' } } }), 'horses');
    ageCleanup.add(() => prisma.user.delete({ where: { id: ageUser.id } }), 'user');
    await ageCleanup.run();
  }, 30000);

  // ── calculateTriggerThresholds ageModifier ──────────────────────────────────

  it('calculateTriggerThresholds: ageModifier=0.7 for horse 10 days old (8-30d bracket)', async () => {
    const result = await analyze(horse10d.id, triggerThresholds);
    expect(result.ageModifier).toBe(0.7);
    expect(result.ageInDays).toBeGreaterThanOrEqual(9);
    expect(result.ageInDays).toBeLessThanOrEqual(11);
  });

  it('calculateTriggerThresholds: ageModifier=0.8 for horse 60 days old (31-90d bracket)', async () => {
    const result = await analyze(horse60d.id, triggerThresholds);
    expect(result.ageModifier).toBe(0.8);
  });

  it('calculateTriggerThresholds: ageModifier=1.0 for horse 100 days old (>90d bracket)', async () => {
    const result = await analyze(horse100d.id, triggerThresholds);
    expect(result.ageModifier).toBe(1.0);
  });
});

// ── poor-quality interactions (Equoria-jkht) ──
// Covers the trackCumulativeExposure non-empty path.

describe('poor-quality interactions (Equoria-jkht)', () => {
  let harshUser;
  let harshGroom;
  let harshHorse;
  const harshCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    harshUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `et-hsh-${ts}-${rand()}@test.com`,
        username: `ethsh${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ET',
        lastName: 'HarshB',
        money: 1000,
      },
    });

    harshGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-ET-HshGroom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: harshUser.id,
        isActive: true,
      },
    });

    harshHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ET-HshHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: harshUser.id,
      },
    });

    // 2 poor bathing interactions and 2 fair feeding interactions
    for (let i = 0; i < 2; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: harshHorse.id,
          groomId: harshGroom.id,
          interactionType: 'dailyCare',
          duration: 30,
          bondingChange: 0,
          quality: 'poor',
          taskType: 'bathing',
          createdAt: new Date(ts - (i + 1) * 60000),
          timestamp: new Date(ts - (i + 1) * 60000),
        },
      });
    }
    for (const [n, minutes] of [
      [0, 3],
      [1, 4],
    ]) {
      await prisma.groomInteraction.create({
        data: {
          foalId: harshHorse.id,
          groomId: harshGroom.id,
          interactionType: 'dailyCare',
          duration: 20,
          bondingChange: 0,
          quality: 'fair',
          taskType: 'feeding',
          createdAt: new Date(ts - minutes * 60000 - n),
          timestamp: new Date(ts - minutes * 60000 - n),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys). Dependency order:
    // groomInteraction -> horse + groom -> user.
    harshCleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { foalId: harshHorse.id } }),
      'groomInteraction',
    );
    harshCleanup.add(() => prisma.horse.delete({ where: { id: harshHorse.id } }), 'horse');
    harshCleanup.add(() => prisma.groom.delete({ where: { id: harshGroom.id } }), 'groom');
    harshCleanup.add(() => prisma.user.delete({ where: { id: harshUser.id } }), 'user');
    await harshCleanup.run();
  }, 30000);

  it('trackCumulativeExposure returns non-zero exposure for horse with 4 interactions', async () => {
    const result = await analyze(harshHorse.id, cumulativeExposure);
    expect(result.totalExposure).toBeGreaterThan(0);
    expect(result.exposureTimeline).toHaveLength(4);
    expect(Object.keys(result.exposureByType).length).toBeGreaterThan(0);
  });
});
