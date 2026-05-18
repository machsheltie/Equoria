/**
 * Integration test (Equoria-d4tl): evaluateEnhancedMilestone now invokes
 * the ultra-rare/exotic trigger engine and persists UltraRareTraitEvent rows
 * for any triggered traits — without requiring a manual call to
 * POST /api/v1/ultra-rare-traits/evaluate/:horseId.
 *
 * Pre-fix: evaluateEnhancedMilestone returned only milestoneLog/traitOutcome;
 * no ultra-rare evaluation ran on milestone boundaries. The UltraRareTraitEvent
 * table stayed empty unless a user explicitly hit the route.
 *
 * Post-fix: every successful milestone evaluation also runs
 * evaluateAndPersistUltraRareTraits and exposes the result on
 * response.ultraRareEvaluation. Each triggered trait writes one
 * UltraRareTraitEvent row. The hook is fail-soft (engine failure does NOT
 * fail the milestone result).
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { evaluateEnhancedMilestone, MILESTONE_TYPES } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const TAG = `d4tl-${randomBytes(4).toString('hex')}`;

function dobForAge(ageInDays) {
  const d = new Date();
  d.setDate(d.getDate() - ageInDays);
  return d;
}

describe('Equoria-d4tl: evaluateEnhancedMilestone auto-runs ultra-rare evaluation', () => {
  let user;
  let foal;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: 'D4TL',
        money: 5000,
      },
    });

    // age 3d → SOCIALIZATION window (1-7)
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-Foal`,
        sex: 'colt',
        dateOfBirth: dobForAge(3),
        age: 0,
        bondScore: 60,
        stressLevel: 5,
        userId: user.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.ultraRareTraitEvent.deleteMany({ where: { horseId: foal?.id } }).catch(() => {});
    await prisma.milestoneTraitLog.deleteMany({ where: { horseId: foal?.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: foal?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user?.id } }).catch(() => {});
  }, 30000);

  it('returns an ultraRareEvaluation result from evaluateEnhancedMilestone', async () => {
    const result = await evaluateEnhancedMilestone(foal.id, MILESTONE_TYPES.SOCIALIZATION);

    // The milestone itself must still succeed.
    expect(result.success).toBe(true);
    expect(result.milestoneLog).toBeDefined();

    // NEW (Equoria-d4tl): every success path returns the ultra-rare evaluation
    // shape so the route layer / frontend / cron all see the same contract.
    expect(result.ultraRareEvaluation).toBeDefined();
    expect(result.ultraRareEvaluation).not.toBeNull();
    expect(Array.isArray(result.ultraRareEvaluation.ultraRareResults)).toBe(true);
    expect(Array.isArray(result.ultraRareEvaluation.exoticResults)).toBe(true);
    expect(typeof result.ultraRareEvaluation.eventsCreated).toBe('number');
    expect(result.ultraRareEvaluation.eventsCreated).toBeGreaterThanOrEqual(0);

    // If any traits triggered, an equal number of UltraRareTraitEvent rows
    // must now exist for this horse.
    const totalTriggered =
      result.ultraRareEvaluation.ultraRareResults.length + result.ultraRareEvaluation.exoticResults.length;
    const eventRows = await prisma.ultraRareTraitEvent.count({
      where: { horseId: foal.id },
    });
    expect(eventRows).toBe(totalTriggered);
    expect(eventRows).toBe(result.ultraRareEvaluation.eventsCreated);
  }, 60000);
});
