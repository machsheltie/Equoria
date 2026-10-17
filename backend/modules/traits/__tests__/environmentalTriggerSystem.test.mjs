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
 *   assessCriticalPeriodSensitivity:
 *     horse in active critical period (age 0-3 days) → sensitivityLevel > 0
 *     horse past all critical periods, recent (age 121-149) → sensitivityLevel=0.3
 *     horse past all critical periods, old (age > 150) → sensitivityLevel=0.1
 *   evaluateTraitExpressionProbability — expressive likelihood label branches
 *   generateEnvironmentalReport — full aggregated report
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  generateEnvironmentalReport,
  loadEnvironmentalTriggerSnapshot,
  criticalPeriodSensitivity,
  cumulativeExposure,
  detectTriggers,
  traitExpressionProbability,
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
  let etsHorseRecent; // 130 days old → past critical periods, daysSinceLastPeriod < 30 (residual=0.3)
  let etsGroom1; // epigeneticInfluenceType='calm' → routine_stability branch coverage
  let etsGroom2; // second groom for multiple-groom fixture interactions
  let etsHorseStressedFoal; // 1 day, stressLevel=8 → sensitivity=0.82>0.7 for generateEnvironmentalReport line 931
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

    // 130 days old: past last critical period (ends day 120), daysSinceLastPeriod=10 < 30 → sensitivityLevel=0.3
    etsHorseRecent = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-Recent-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(130),
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

    // 1 day old, stressLevel=8 → ageModifier=0.6, stressModifier=0.6 → finalThreshold=0.18 → sensitivity=0.82>0.7
    etsHorseStressedFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ETS-StressedFoal-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(1),
        age: 0,
        stressLevel: 8,
        userId: etsUser.id,
      },
    });

    // 6 groomInteractions for etsHorseMature (all within last 30 days via default createdAt)
    // Exercises calculateTriggerScore, identifyActiveTriggerFactors, calculateInteractionExposure,
    // and analyzeCumulativeEffects (fires at index 4)
    await prisma.groomInteraction.createMany({
      data: [
        // stress_inducing: stressChange>2✓, quality=poor✓, bondingChange<0✓ → interactionScore=0.7 → fires (avg=0.7>0.3)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'handling',
          duration: 20,
          stressChange: 4,
          quality: 'poor',
          bondingChange: -1,
        },
        // confidence_building: bondingChange>1✓, quality=excellent✓, stressChange<=0✓ → fires (avg=0.7>0.3)
        // calculateInteractionExposure: bondingChange=3>2✓ (*1.3), quality=excellent✓ (*1.2)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'enrichment',
          duration: 45,
          stressChange: 0,
          quality: 'excellent',
          bondingChange: 3,
        },
        // isolation_stress: bondingChange<-1✓, duration<15✓ → fires (avg=0.5>0.3)
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom2.id,
          interactionType: 'grooming',
          duration: 10,
          stressChange: 1,
          quality: 'good',
          bondingChange: -2,
        },
        // sensory_enrichment taskType=desensitization branch; routine_stability groom.calm✓ branch
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom1.id,
          interactionType: 'training',
          duration: 30,
          stressChange: 0,
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
          stressChange: 0,
          quality: 'excellent',
          bondingChange: 1,
        },
        // sensory_enrichment taskType=showground_exposure branch; stressChange=4 → analyzeStressEnv severity=high
        {
          foalId: etsHorseMature.id,
          groomId: etsGroom2.id,
          interactionType: 'training',
          duration: 8,
          stressChange: 4,
          quality: 'poor',
          bondingChange: -2,
          taskType: 'showground_exposure',
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

  // ── assessCriticalPeriodSensitivity branches ─────────────────────────────

  it('assessCriticalPeriodSensitivity: newborn (age 1d) is in active critical period', async () => {
    const result = await analyze(etsHorseNewborn.id, criticalPeriodSensitivity);
    // Age 1 day: within imprinting (0-3), early_socialization (1-14) → activeWindows.length > 0
    expect(result.activeWindows.length).toBeGreaterThan(0);
    expect(result.sensitivityLevel).toBeGreaterThan(0);
    expect(Array.isArray(result.criticalPeriods)).toBe(true);
  });

  it('assessCriticalPeriodSensitivity: recent past periods (130d) → sensitivityLevel=0.3', async () => {
    const result = await analyze(etsHorseRecent.id, criticalPeriodSensitivity);
    // Age 130: past all critical periods (last ends at 120), daysSinceLastPeriod=10 < 30 → 0.3
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.3);
  });

  it('assessCriticalPeriodSensitivity: old horse (200d) → sensitivityLevel=0.1', async () => {
    const result = await analyze(etsHorseMature.id, criticalPeriodSensitivity);
    // Age 200: daysSinceLastPeriod=80 >= 30 → sensitivityLevel=0.1
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.1);
  });

  // ── evaluateTraitExpressionProbability ───────────────────────────────────

  it('evaluateTraitExpressionProbability: returns expressionLikelihood for brave (positive trait)', async () => {
    const result = await analyze(etsHorseMature.id, traitExpressionProbability, 'brave');
    expect(result.traitName).toBe('brave');
    expect(typeof result.finalProbability).toBe('number');
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
    expect(result.finalProbability).toBeLessThanOrEqual(1);
    expect(
      ['very_likely', 'likely', 'possible', 'unlikely', 'very_unlikely'].includes(result.expressionLikelihood),
    ).toBe(true);
  });

  it('evaluateTraitExpressionProbability: fearful (negative trait) has stress modifier applied', async () => {
    const result = await analyze(etsHorseMature.id, traitExpressionProbability, 'fearful');
    expect(result.traitName).toBe('fearful');
    // stressModifier > 1.0 since fearful is in negativeTraits list (even for stressLevel=50)
    expect(result.stressModifier).toBeGreaterThan(0);
  });

  it('evaluateTraitExpressionProbability: neutral trait (not in negative/positive list)', async () => {
    const result = await analyze(etsHorseMature.id, traitExpressionProbability, 'curious');
    expect(result.traitName).toBe('curious');
    // curious is in positiveTraits → stressModifier applied; finalProbability still in [0,1]
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
  });

  it('evaluateTraitExpressionProbability: young foal ageModifier=1.5 (≤30 days)', async () => {
    const result = await analyze(etsHorseYoung.id, traitExpressionProbability, 'brave');
    // ageInDays=15 ≤30 → ageModifier=1.5
    expect(result.ageModifier).toBe(1.5);
  });

  it('evaluateTraitExpressionProbability: developing foal ageModifier=1.2 (≤90 days)', async () => {
    const result = await analyze(etsHorseDeveloping.id, traitExpressionProbability, 'brave');
    // ageInDays=45 ≤90 → ageModifier=1.2
    expect(result.ageModifier).toBe(1.2);
  });

  it('evaluateTraitExpressionProbability: mature horse ageModifier=0.8 (>90 days)', async () => {
    const result = await analyze(etsHorseMature.id, traitExpressionProbability, 'calm');
    // ageInDays=200 >90 → ageModifier=0.8
    expect(result.ageModifier).toBe(0.8);
  });

  // ── generateEnvironmentalReport ──────────────────────────────────────────

  it('generateEnvironmentalReport: returns aggregated report for mature horse', async () => {
    const result = await generateEnvironmentalReport(etsHorseMature.id);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.environmentalTriggers).toBeDefined();
    expect(result.triggerThresholds).toBeDefined();
    expect(Array.isArray(result.traitExpressionProbabilities)).toBe(true);
    expect(result.traitExpressionProbabilities.length).toBeGreaterThan(0);
    expect(result.cumulativeExposure).toBeDefined();
    expect(result.criticalPeriodSensitivity).toBeDefined();
    expect(result.reportTimestamp).toBeDefined();
  });

  // ── detectEnvironmentalTriggers — horse with interactions ─────────────────

  it('detectEnvironmentalTriggers: stress_inducing + confidence_building + isolation_stress detected', async () => {
    const result = await analyze(etsHorseMature.id, detectTriggers);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.detectedTriggers.length).toBeGreaterThan(0);
    expect(result.interactionCount).toBe(6);
    const types = result.detectedTriggers.map(t => t.type);
    expect(types).toContain('stress_inducing');
    expect(types).toContain('confidence_building');
    expect(Array.isArray(result.environmentalFactors)).toBe(true);
    // identifyActiveTriggerFactors: loud_noises/unfamiliar_surroundings cases (stressChange>2✓)
    const stressTrigger = result.detectedTriggers.find(t => t.type === 'stress_inducing');
    expect(Array.isArray(stressTrigger.factors)).toBe(true);
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

  it('evaluateTraitExpressionProbability: fearful with stress_inducing → relevantTriggers populated (line 288)', async () => {
    const result = await analyze(etsHorseMature.id, traitExpressionProbability, 'fearful');
    // stress_inducing.traits_affected includes 'fearful' → environmentalModifier increases
    expect(result.relevantTriggers.length).toBeGreaterThan(0);
    expect(result.relevantTriggers[0].type).toBe('stress_inducing');
    expect(result.environmentalModifier).toBeGreaterThan(1.0);
  });

  // ── assessCriticalPeriodSensitivity — additional critical period cases ────

  it('assessCriticalPeriodSensitivity: young horse (15d) → curiosity_development window active', async () => {
    const result = await analyze(etsHorseYoung.id, criticalPeriodSensitivity);
    const windowNames = result.activeWindows.map(w => w.name);
    expect(windowNames).toContain('curiosity_development');
    expect(result.recommendations.some(r => r.includes('exploration'))).toBe(true);
  });

  it('assessCriticalPeriodSensitivity: developing horse (45d) → social_hierarchy window active', async () => {
    const result = await analyze(etsHorseDeveloping.id, criticalPeriodSensitivity);
    const windowNames = result.activeWindows.map(w => w.name);
    expect(windowNames).toContain('social_hierarchy');
    expect(result.recommendations.some(r => r.includes('social'))).toBe(true);
  });

  // ── generateEnvironmentalReport — highly sensitive horse ─────────────────

  it('generateEnvironmentalReport: stressedFoal sensitivity=0.82>0.7 and sensitivityLevel=1.0>0.7', async () => {
    const result = await generateEnvironmentalReport(etsHorseStressedFoal.id);
    // thresholds.sensitivity=0.82>0.7 → line 931: 'highly sensitive' recommendation added
    expect(result.recommendations.some(r => r.includes('highly sensitive'))).toBe(true);
    // criticalPeriodSensitivity.sensitivityLevel=1.0>0.7 → line 947: 'critical developmental' recommendation added
    expect(result.recommendations.some(r => r.includes('critical developmental period'))).toBe(true);
  });
});
