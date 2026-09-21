/**
 * bareDefaultGuardZeroCorruption.sentinel.test.mjs (Equoria-4maxb)
 *
 * Migration 20260530130000_507mt made 19 Horse stat/counter columns NOT NULL
 * with default 0 (bondScore 0 = unbonded, stressLevel 0 = calm, stats 0 =
 * undeveloped). A bare `||` guard with a non-zero fallback on one of those
 * columns silently rewrites a legitimate 0:
 *
 *   horse.stressLevel || 100   -> a calm horse is read as MAX stress
 *   horse.bondScore   || 50    -> an unbonded horse is read as neutral-50
 *   stallion.speed    || 50    -> an undeveloped stat is read as average
 *
 * Two arms, cross-module (utils + grooms + horses + breeding):
 *   1. REAL-DB behavioural arms: a horse row planted with 0 (not null, not
 *      undefined — the state where broken and fixed readers differ) flows
 *      through the live readers and must come out as 0.
 *   2. Grep sentinel over the Class-1 production files with a planted
 *      violation proving the detector fires. Scope is deliberately the
 *      harmful class only: `|| <non-zero>` on a Horse NOT NULL column.
 *      `|| 0` / `?? n` forms cannot corrupt a 0 and are owned by the
 *      bareDefaultGuard campaign sentinels (l99ed/ho2b9/x3dlk/...).
 *
 * Sibling unit arms live beside their services:
 *   modules/traits/__tests__/traitDiscovery.test.mjs
 *   modules/horses/__tests__/bondingModifiers.test.mjs
 *   modules/horses/__tests__/enhancedMilestoneEvaluationSystem.test.mjs
 *   modules/traits/__tests__/applyEpigeneticTraitsAtBirthUnit.test.mjs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { getDiscoveryProgress } from '../utils/traitDiscovery.mjs';
import { assessBreedingPairCompatibility } from '../modules/breeding/services/genetics/breedingCompatibility.mjs';
import { calculatePairwiseDistance } from '../modules/breeding/services/genetics/geneticDiversityMetrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..');

// ── Arm 1: real-DB behavioural ─────────────────────────────────────────────

describe('Equoria-4maxb — legitimate 0 on NOT NULL Horse columns survives the live readers', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  let userId;
  let calmUnbondedId;
  let stallionId;
  let mareId;

  beforeAll(async () => {
    const uniq = randomBytes(8).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `4maxb-${uniq}@example.com`,
        username: `4maxb-${uniq}`,
        password: 'irrelevant-hash',
        firstName: 'Zero',
        lastName: 'Semantics',
        money: 1000,
      },
    });
    userId = user.id;

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const zeroStats = { speed: 0, stamina: 0, agility: 0, intelligence: 0 };

    const calmUnbonded = await createTestHorse(
      prisma,
      {
        name: `TestFixture-4maxb-calm-${uniq}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        userId,
        bondScore: 0,
        stressLevel: 0,
      },
      horseIds,
    );
    calmUnbondedId = calmUnbonded.id;

    const stallion = await createTestHorse(
      prisma,
      {
        name: `TestFixture-4maxb-stallion-${uniq}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        userId,
        ...zeroStats,
      },
      horseIds,
    );
    stallionId = stallion.id;

    const mare = await createTestHorse(
      prisma,
      {
        name: `TestFixture-4maxb-mare-${uniq}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        userId,
        ...zeroStats,
      },
      horseIds,
    );
    mareId = mare.id;

    // Scoped, fail-loud cleanup: horses (by the ids this suite created) before
    // the user (Horse.userId is onDelete:Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the planted state is a stored 0, not null and not undefined', async () => {
    const stored = await prisma.horse.findUnique({
      where: { id: calmUnbondedId },
      select: { bondScore: true, stressLevel: true },
    });
    expect(stored).toEqual({ bondScore: 0, stressLevel: 0 });
  });

  it('trait discovery reads a calm (stressLevel 0), unbonded (bondScore 0) horse as calm and unbonded', async () => {
    const progress = await getDiscoveryProgress(calmUnbondedId);

    // Defect: `horse.stressLevel || 100` inverted 0 into max stress and
    // `horse.bondScore || 50` promoted 0 into neutral-50.
    expect(progress.currentStats.stressLevel).toBe(0);
    expect(progress.currentStats.bondScore).toBe(0);

    const met = progress.conditions.map(c => c.name);
    expect(met).toContain('LOW_STRESS');
    expect(met).toContain('MINIMAL_STRESS');
    // Unbonded: no bond-based discovery may fire.
    expect(met).not.toContain('HIGH_BOND');
    expect(met).not.toContain('PERFECT_CARE');
  }, 30000);

  it('breeding compatibility averages undeveloped (0) parent stats to 0, not to 50', async () => {
    const result = await assessBreedingPairCompatibility(stallionId, mareId);

    // Defect: `stallion.speed || 50` etc. predicted an average-stat foal from
    // two undeveloped parents.
    expect(result.expectedTraits.expectedStats).toEqual({
      speed: 0,
      stamina: 0,
      agility: 0,
      intelligence: 0,
    });
  }, 30000);
});

// ── Arm 1b: pure reader in the same class ──────────────────────────────────

describe('Equoria-4maxb — calculatePairwiseDistance keeps a 0 stat at 0', () => {
  it('distance between an all-0 horse and an all-100 horse is the full stat distance', () => {
    const undeveloped = { speed: 0, stamina: 0, agility: 0, intelligence: 0 };
    const maxed = { speed: 100, stamina: 100, agility: 100, intelligence: 100 };
    // No traits → trait distance 0; stat distance (4 × 1.0) / 4 = 1.0;
    // combined (0 + 1.0) / 2 = 0.5. The defective `horse[stat] || 50` read
    // the undeveloped horse as all-50 and produced 0.25.
    expect(calculatePairwiseDistance(undeveloped, maxed)).toBe(0.5);
  });
});

// ── Arm 2: grep sentinel over the Class-1 production files ─────────────────

// The 19 NOT NULL columns from migration 20260530130000_507mt.
const NOT_NULL_HORSE_COLUMNS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'totalEarnings',
  'bondScore',
  'stressLevel',
  'daysGroomedInARow',
  'consecutiveDaysFoalCare',
  'horseXp',
  'availableStatPoints',
];

// Production files that carried the harmful class on 2026-07-03 (issue body,
// verified 2026-07-06 and again on fix day). Relative to backend/.
const CLASS_1_FILES = [
  'utils/bondingModifiers.mjs',
  'utils/traitEvaluation.mjs',
  'utils/traitDiscovery.mjs',
  'utils/applyEpigeneticTraitsAtBirth.mjs',
  'utils/enhancedMilestoneEvaluationSystem.mjs',
  'utils/dailyCareAutomation.mjs',
  'modules/grooms/controllers/groomRosterController.mjs',
  'modules/grooms/controllers/groomInteractionController.mjs',
  'modules/grooms/controllers/enhancedGroomController.mjs',
  'modules/horses/services/foalingService.mjs',
  'modules/horses/controllers/horseOverviewController.mjs',
  'modules/breeding/services/genetics/breedingCompatibility.mjs',
  'modules/breeding/services/genetics/geneticDiversityMetrics.mjs',
  'modules/breeding/services/genetics/recommendationGenerators.mjs',
];

const COLUMN_ALT = NOT_NULL_HORSE_COLUMNS.join('|');
// `obj.col || <non-zero>` and `obj?.col || <non-zero>`.
const DOTTED_PATTERN = new RegExp(`\\b\\w+(?:\\??\\.\\w+)*\\??\\.(?:${COLUMN_ALT})\\s*\\|\\|\\s*[1-9]\\d*\\b`, 'g');
// `obj[stat] || <non-zero>` — the computed-member form found at
// geneticDiversityMetrics.calculatePairwiseDistance (index named stat*).
const COMPUTED_PATTERN = /\b\w+\[\s*stat\w*\s*\]\s*\|\|\s*[1-9]\d*\b/g;

function findZeroCorruptingGuards(source) {
  const violations = [];
  source.split('\n').forEach((line, idx) => {
    // Comments may legitimately quote the forbidden form when documenting it.
    const commentIdx = line.indexOf('//');
    const code = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    for (const pattern of [DOTTED_PATTERN, COMPUTED_PATTERN]) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(code)) !== null) {
        violations.push({ line: idx + 1, col: m.index + 1, text: m[0] });
      }
    }
  });
  return violations;
}

describe('Equoria-4maxb — `|| <non-zero>` on a NOT NULL Horse column cannot return to the Class-1 files', () => {
  it.each(CLASS_1_FILES)('%s has no zero-corrupting guard', relPath => {
    // readFileSync throws on a moved file: a dead path fails loud (Equoria-dl3kz).
    const source = readFileSync(resolve(BACKEND_ROOT, relPath), 'utf8');
    expect(findZeroCorruptingGuards(source)).toEqual([]);
  });

  it('the detector FIRES on planted violations (sentinel-positive)', () => {
    const planted = `
      const a = horse.bondScore || 50;
      const b = (foal.stressLevel || 100) <= 20;
      const c = assignment.foal.bondScore || 50;
      const d = mare?.speed || 50;
      const e = horse1[stat] || 50;
    `;
    const hits = findZeroCorruptingGuards(planted).map(v => v.text);
    expect(hits).toEqual([
      'horse.bondScore || 50',
      'foal.stressLevel || 100',
      'assignment.foal.bondScore || 50',
      'mare?.speed || 50',
      'horse1[stat] || 50',
    ]);
  });

  it('the detector ignores forms that cannot corrupt a 0', () => {
    const benign = `
      const a = horse.bondScore ?? 0;
      const b = horse.stressLevel ?? 50;
      const c = horse.bondScore || 0;
      const d = horse.bondScore;
      const e = activityData.duration || 15;
      // quoted in a comment: horse.bondScore || 50
    `;
    expect(findZeroCorruptingGuards(benign)).toEqual([]);
  });
});
