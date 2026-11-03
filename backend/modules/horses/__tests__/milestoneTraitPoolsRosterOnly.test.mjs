/**
 * The nightly foal milestone scoring names only current-roster traits.
 *
 * Owner ruling 2026-11-03 (q335): "Keep it, current traits only." The milestone
 * job (utils/enhancedMilestoneEvaluationSystem.mjs, days 0-28) stays, but its
 * trait pools may hold only the twenty roster traits (utils/epigeneticTraits.mjs),
 * each in the pool of its own polarity, and no outcome may name anything else.
 */
import { describe, expect, it } from '@jest/globals';
import {
  determineTraitOutcome,
  milestoneTraitPools,
  milestoneTypes,
  traitThresholds,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import { getTraitDefinition, isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

/** Every pool entry that is off the roster or in the wrong polarity's pool. */
function poolViolations(pools) {
  const violations = [];
  for (const [milestone, pool] of Object.entries(pools)) {
    for (const polarity of ['positive', 'negative']) {
      for (const trait of pool[polarity]) {
        if (!isRosterTrait(trait)) {
          violations.push(`${milestone}.${polarity}: ${trait} (off roster)`);
        } else if (getTraitDefinition(trait).type !== polarity) {
          violations.push(`${milestone}.${polarity}: ${trait} (roster type ${getTraitDefinition(trait).type})`);
        }
      }
    }
  }
  return violations;
}

describe('milestone trait pools are roster-only (q335)', () => {
  it('the detector fires on a planted off-roster name and a wrong-polarity name', () => {
    const planted = {
      imprinting: { positive: ['bonded', 'fearful'], negative: ['fragile'] },
    };
    expect(poolViolations(planted)).toEqual([
      'imprinting.positive: bonded (off roster)',
      'imprinting.positive: fearful (roster type negative)',
    ]);
  });

  it('every milestone type has a pool, and every pooled name is a roster trait of that polarity', () => {
    for (const type of Object.values(milestoneTypes)) {
      expect(milestoneTraitPools[type]).toBeDefined();
    }
    expect(poolViolations(milestoneTraitPools)).toEqual([]);
  });

  it('no outcome names an off-roster trait, at any score, for any milestone', () => {
    const scores = [traitThresholds.DENY - 5, traitThresholds.DENY, 0, traitThresholds.CONFIRM, 10];
    for (const type of Object.values(milestoneTypes)) {
      for (const score of scores) {
        for (let draw = 0; draw < 50; draw++) {
          const { trait } = determineTraitOutcome(score, type);
          expect(trait === null || isRosterTrait(trait)).toBe(true);
        }
      }
    }
  });

  it('a milestone with no roster trait of the earned polarity names no trait', () => {
    const outcome = determineTraitOutcome(traitThresholds.DENY, milestoneTypes.SOCIALIZATION);
    expect(milestoneTraitPools[milestoneTypes.SOCIALIZATION].negative).toEqual([]);
    expect(outcome.trait).toBeNull();
    expect(outcome.type).toBe('negative');
  });
});
