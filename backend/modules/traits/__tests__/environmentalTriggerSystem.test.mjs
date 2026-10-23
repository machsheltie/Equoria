/**
 * environmentalTriggerSystem branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path / non-existent horse:
 *   detectEnvironmentalTriggers — no interactions → empty return (not a throw)
 *   calculateTriggerThresholds — non-existent horseId → throws 'Horse not found'
 *   trackCumulativeExposure — no interactions → empty return
 *
 * DB-fixture branch coverage:
 *   calculateTriggerThresholds age branches:
 *     ageInDays ≤7  → ageModifier=0.6
 *     ageInDays ≤30 → ageModifier=0.7
 *     ageInDays ≤90 → ageModifier=0.8
 *     ageInDays >90 → ageModifier=1.0
 *   evaluateTraitExpressionProbability — expressive likelihood label branches
 *   generateEnvironmentalReport — full aggregated report
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
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
// Equoria-twmpa: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. Prefix-scoped horses -> grooms -> user;
// groomInteractions cascade via Horse.foalId onDelete: Cascade (schema:419),
// and horses are deleted before the user (Horse.userId onDelete: Restrict,
// schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

// ── No-fixture pure paths ─────────────────────────────────────────────────────

describe('detectEnvironmentalTriggers — no interactions (non-existent horse)', () => {
  it('returns empty detectedTriggers for non-existent horseId (no DB error)', async () => {
    const result = await analyze(999999999, detectTriggers);
    expect(result.horseId).toBe(999999999);
    expect(result.detectedTriggers).toHaveLength(0);
    expect(result.triggerStrength).toBe(0);
    expect(result.interactionCount).toBe(0);
  });
});

describe('calculateTriggerThresholds — non-existent horse', () => {
  it('throws "Horse not found" for non-existent horseId', async () => {
    await expect(analyze(999999999, triggerThresholds)).rejects.toThrow('Horse not found');
  });
});

describe('trackCumulativeExposure — no interactions', () => {
  it('returns empty totalExposure=0 for non-existent horseId', async () => {
    const result = await analyze(999999999, cumulativeExposure);
    expect(result.totalExposure).toBe(0);
    expect(result.exposureTimeline).toHaveLength(0);
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('environmentalTriggerSystem — DB fixture branch coverage (Equoria-jkht)', () => {
  let etsUser;
  let etsHorseNewborn; // 1 day old → ageInDays ≤7 (ageModifier=0.6) + imprinting critical period
  let etsHorseYoung; // 15 days old → ageInDays ≤30 (ageModifier=0.7)
  let etsHorseDeveloping; // 45 days old → ageInDays ≤90 (ageModifier=0.8)
  let etsHorseMature; // 200 days old → ageInDays >90 (ageModifier=1.0) + past critical periods
  let etsGroom1; // epigeneticInfluenceType='calm' → routine_stability branch coverage
  let etsGroom2; // second groom for multiple-groom fixture interactions
  let etsHorseNewFoal; // 1 day old → ageModifier=0.6, sensitivity=0.7 for generateEnvironmentalReport
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    etsUser = await prisma.user.create({
      data: {
        email: `ets-${ts}-${rand()}@test.com`,
        username: `ets${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ETS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    const daysAgo = days => gameCalendarDate(new Date(ts), -days);

    etsHorseNewborn = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-Newborn-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(1),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseYoung = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-Young-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(15),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseDeveloping = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-Developing-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(45),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseMature = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-Mature-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(200),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsGroom1 = await prisma.groom.create({
      data: {
        name: `TestFixture-ETS-Groom1-${ts}`,
        speciality: 'general',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        userId: etsUser.id,
      },
    });

    etsGroom2 = await prisma.groom.create({
      data: {
        name: `TestFixture-ETS-Groom2-${ts}`,
        speciality: 'general',
        personality: 'energetic',
        userId: etsUser.id,
      },
    });

    // 1 day old → ageModifier=0.6 → finalThreshold=0.3 → sensitivity=0.7
    etsHorseNewFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-NewFoal-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(1),
        age: 0,
        userId: etsUser.id,
      },
    });

    // 6 groomInteractions for etsHorseMature (all within last 30 days via default createdAt)
    // Exercises calculateTriggerScore, identifyActiveTriggerFactors, calculateInteractionExposure,
    // and analyzeCumulativeEffects (fires at index 4)
    await prisma.groomInteraction.createMany({
      data: [
        // harsh_environment: quality=poor✓, bondingChange<0✓ → interactionScore=0.4 → fires (avg=0.4>0.3)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'handling',
          duration: 20,
          quality: 'poor',
          bondingChange: -1,
        },
        // confidence_building: bondingChange>1✓, quality=excellent✓ → fires (avg=0.5>0.3)
        // calculateInteractionExposure: bondingChange=3>2✓ (*1.3), quality=excellent✓ (*1.2)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'enrichment',
          duration: 45,
          quality: 'excellent',
          bondingChange: 3,
        },
        // isolation: bondingChange<-1✓, duration<15✓ → fires (avg=0.5>0.3)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom2.id,
          interactionType: 'grooming',
          duration: 10,
          quality: 'good',
          bondingChange: -2,
        },
        // sensory_enrichment taskType=desensitization branch; routine_stability groom.calm✓ branch
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'training',
          duration: 30,
          quality: 'good',
          bondingChange: 0,
          taskType: 'desensitization',
        },
        // routine_stability quality=excellent✓; analyzeCumulativeEffects fires at index=4 (5th interaction)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'grooming',
          duration: 35,
          quality: 'excellent',
          bondingChange: 1,
        },
        // sensory_enrichment taskType=showgroundExposure branch
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom2.id,
          interactionType: 'training',
          duration: 8,
          quality: 'poor',
          bondingChange: -2,
          taskType: 'showgroundExposure',
        },
      ],
    });

    // groomInteractions cascade via horse onDelete: Cascade (foalId FK);
    // horses (prefix-scoped) deleted before the user (Horse.userId Restrict).
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ETS-' } } }),
      'horses(prefix)',
    );
    cleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-ETS-' } } }),
      'grooms(prefix)',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: etsUser?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  // ── calculateTriggerThresholds age branches ──────────────────────────────

  it('calculateTriggerThresholds: ageInDays ≤7 → ageModifier=0.6', async () => {
    const result = await analyze(etsHorseNewborn.id, triggerThresholds);
    expect(result.ageModifier).toBe(0.6);
    expect(result.horseId).toBe(etsHorseNewborn.id);
    expect(typeof result.finalThreshold).toBe('number');
  });

  it('calculateTriggerThresholds: ageInDays ≤30 → ageModifier=0.7', async () => {
    const result = await analyze(etsHorseYoung.id, triggerThresholds);
    expect(result.ageModifier).toBe(0.7);
  });

  it('calculateTriggerThresholds: ageInDays ≤90 → ageModifier=0.8', async () => {
    const result = await analyze(etsHorseDeveloping.id, triggerThresholds);
    expect(result.ageModifier).toBe(0.8);
  });

  it('calculateTriggerThresholds: ageInDays >90 → ageModifier=1.0', async () => {
    const result = await analyze(etsHorseMature.id, triggerThresholds);
    expect(result.ageModifier).toBe(1.0);
  });

  // ── generateEnvironmentalReport ──────────────────────────────────────────

  it('generateEnvironmentalReport: returns aggregated report for mature horse', async () => {
    const result = await generateEnvironmentalReport(etsHorseMature.id);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.environmentalTriggers).toBeDefined();
    expect(result.triggerThresholds).toBeDefined();
    // Owner ruling 2026-10-07 (Equoria-huuaf): no forecasts. Old contract: traitExpressionProbabilities, one per trait.
    expect(result).not.toHaveProperty('traitExpressionProbabilities');
    expect(result.cumulativeExposure).toBeDefined();
    // Owner ruling 2026-10-07 (Equoria-5nxw0): no advice, windows or forecasts (old contract: criticalPeriodSensitivity and recommendations defined).
    expect(result).not.toHaveProperty('criticalPeriodSensitivity');
    expect(result).not.toHaveProperty('recommendations');
    expect(result.reportTimestamp).toBeDefined();
  });

  // ── detectEnvironmentalTriggers — horse with interactions ─────────────────

  it('detectEnvironmentalTriggers: harsh_environment + confidence_building + isolation detected', async () => {
    const result = await analyze(etsHorseMature.id, detectTriggers);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.detectedTriggers.length).toBeGreaterThan(0);
    expect(result.interactionCount).toBe(6);
    const types = result.detectedTriggers.map(t => t.type);
    expect(types).toContain('harsh_environment');
    expect(types).toContain('confidence_building');
    expect(Array.isArray(result.environmentalFactors)).toBe(true);
    const harshTrigger = result.detectedTriggers.find(t => t.type === 'harsh_environment');
    expect(Array.isArray(harshTrigger.factors)).toBe(true);
  });

  // ── trackCumulativeExposure — horse with interactions ─────────────────────

  it('trackCumulativeExposure: totalExposure>0, timeline populated, analyzeCumulativeEffects fired', async () => {
    const result = await analyze(etsHorseMature.id, cumulativeExposure);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.totalExposure).toBeGreaterThan(0);
    expect(result.exposureTimeline).toHaveLength(6);
    expect(typeof result.exposureByType).toBe('object');
    // analyzeCumulativeEffects fires at index 4 (5th interaction): (4+1)%5===0
    expect(result.cumulativeEffects['interaction_5']).toBeDefined();
    expect(['positive', 'negative', 'neutral']).toContain(result.cumulativeEffects['interaction_5'].bondingTrend);
  });

  // ── evaluateTraitExpressionProbability — with detected triggers ───────────

  // ── generateEnvironmentalReport — highly sensitive horse ─────────────────

  it('generateEnvironmentalReport: a highly sensitive young foal still gets no advice or windows', async () => {
    const result = await generateEnvironmentalReport(etsHorseNewFoal.id);
    // thresholds.sensitivity=0.7 used to add a 'highly sensitive' recommendation and the
    // foal's age a 'critical developmental period' one. Owner ruling 2026-10-07 (Equoria-5nxw0): no advice, windows or forecasts.
    expect(result.triggerThresholds.sensitivity).toBeCloseTo(0.7);
    expect(result).not.toHaveProperty('recommendations');
    expect(result).not.toHaveProperty('criticalPeriodSensitivity');
  });
});
