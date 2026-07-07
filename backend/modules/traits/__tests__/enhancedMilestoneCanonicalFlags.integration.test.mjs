/**
 * enhancedMilestoneCanonicalFlags.integration.test.mjs (Equoria-oey96.32)
 *
 * SENTINEL (real DB, no mocks): a horse hitting the LIVE milestone path
 * (POST /api/v1/epigenetic-traits/evaluate-milestone/:horseId ->
 * getHorseWithActiveGroomAssignments -> evaluateEnhancedMilestone) must
 * surface the flags the CANONICAL engine assigned (horse.epigeneticFlags,
 * written by the weekly flagEvaluationEngine), NOT the permanent stub's
 * always-empty output.
 *
 * PRE-FIX (RED): enhancedMilestoneEvaluation.mjs:66 called the stub
 * evaluator, whose inner trigger evaluators returned constant false, so
 * result.epigeneticFlags was ALWAYS [] regardless of the horse's real
 * canonical flags — dead code producing false coverage on the live
 * milestone path.
 *
 * POST-FIX (GREEN): the milestone path reads asFlagArray(horse.epigeneticFlags),
 * so a horse the canonical engine flagged ['brave','confident'] surfaces those
 * exact flags at milestone time. Read-only: no second flag-ASSIGNMENT engine
 * (that stays the weekly cron's job — PRD-04 §2.2).
 *
 * Lives in the traits module: it exercises the traits-module route fetch
 * helper (epigeneticTraitQueries) + the milestone util the traits route calls.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { getHorseWithActiveGroomAssignments } from '../services/epigeneticTraitQueries.mjs';
import { evaluateEnhancedMilestone } from '../../../utils/enhancedMilestoneEvaluation.mjs';

const CANONICAL_FLAGS = ['brave', 'confident']; // real epigeneticFlagDefinitions.mjs names
const milestoneData = { type: 'imprinting', completed: true, score: 80 };

let user;
const createdHorseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `oey9632-${randomBytes(4).toString('hex')}@test.com`,
      username: `oey9632${randomBytes(5).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Oey9632',
      lastName: 'CanonicalFlags',
      money: 1000,
    },
  });
}, 30000);

afterAll(async () => {
  await cleanupTestHorses(prisma, createdHorseIds);
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
}, 30000);

describe('Equoria-oey96.32: milestone path surfaces CANONICAL flags, not the stub empty output', () => {
  it('a young horse carrying canonical flags surfaces them at milestone time (not [])', async () => {
    // A horse the canonical weekly engine flagged brave+confident. Under 1095
    // elapsed days so the enhanced (foal) path runs.
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-oey9632-${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days
        age: 0,
        userId: user.id,
        epigeneticFlags: CANONICAL_FLAGS,
      },
      createdHorseIds,
    );

    // Fetch through the SAME helper the live route uses.
    const fetched = await getHorseWithActiveGroomAssignments(horse.id);
    expect(fetched).not.toBeNull();

    const result = await evaluateEnhancedMilestone(fetched, { interactions: [] }, null, milestoneData);

    // The enhanced path must be reached (l06yb gate: field present when < 1095d).
    expect(result).toHaveProperty('epigeneticFlags');
    // The load-bearing assertion: flags come from the canonical column, not the
    // stub's always-empty []. RED pre-fix (stub -> []), GREEN post-fix.
    expect(result.epigeneticFlags).toEqual(CANONICAL_FLAGS);
  }, 30000);

  it('a young horse with no canonical flags surfaces [] (honest empty, not fabricated)', async () => {
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-oey9632-empty-${randomBytes(4).toString('hex')}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: user.id,
        epigeneticFlags: [],
      },
      createdHorseIds,
    );

    const fetched = await getHorseWithActiveGroomAssignments(horse.id);
    const result = await evaluateEnhancedMilestone(fetched, { interactions: [] }, null, milestoneData);

    expect(result).toHaveProperty('epigeneticFlags');
    expect(result.epigeneticFlags).toEqual([]);
  }, 30000);
});
