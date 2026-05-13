/**
 * milestoneTraitEvaluator — unit tests (Equoria-rr7)
 *
 * Pure functions: no DB required — only logger + taskTraitInfluenceMap (config).
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateTraitMilestones,
  checkMilestoneEligibility,
  getMilestoneSummary,
  calculateTraitScores,
  applyTraitToHorse,
  MILESTONE_AGES,
  TRAIT_THRESHOLDS,
} from '../../../utils/milestoneTraitEvaluator.mjs';

// Age helpers — milestoneAge = Math.floor(horse.age / 365)
const AGE_YEAR_1 = 365; // milestoneAge = 1
const AGE_YEAR_2 = 730; // milestoneAge = 2
const AGE_YEAR_3 = 1095; // milestoneAge = 3
const AGE_NON_MILESTONE = 200; // milestoneAge = 0 — not a milestone

// Valid task names from TASK_TRAIT_INFLUENCE_MAP
const BRUSHING = 'brushing'; // encourages: bonded, patient | discourages: aloof
const EARLY_TOUCH = 'early_touch'; // from config
const UNKNOWN_TASK = 'not_a_real_task_xyz';

const emptyHorse = (age, milestones = {}) => ({
  id: 999,
  age,
  task_log: [],
  trait_milestones: milestones,
  epigeneticModifiers: { positive: [], negative: [], hidden: [], epigenetic: [] },
});

// ---------------------------------------------------------------------------
// MILESTONE_AGES & TRAIT_THRESHOLDS (exported constants)
// ---------------------------------------------------------------------------
describe('exported constants', () => {
  it('MILESTONE_AGES contains [1, 2, 3]', () => {
    expect(MILESTONE_AGES).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(MILESTONE_AGES).toHaveLength(3);
  });

  it('TRAIT_THRESHOLDS has POSITIVE_THRESHOLD >= 1', () => {
    expect(TRAIT_THRESHOLDS.POSITIVE_THRESHOLD).toBeGreaterThanOrEqual(1);
  });

  it('TRAIT_THRESHOLDS has NEGATIVE_THRESHOLD <= -1', () => {
    expect(TRAIT_THRESHOLDS.NEGATIVE_THRESHOLD).toBeLessThanOrEqual(-1);
  });
});

// ---------------------------------------------------------------------------
// checkMilestoneEligibility
// ---------------------------------------------------------------------------
describe('checkMilestoneEligibility', () => {
  it('returns eligible=true for age 365 (year 1)', () => {
    const result = checkMilestoneEligibility(emptyHorse(AGE_YEAR_1));
    expect(result.eligible).toBe(true);
    expect(result.milestoneAge).toBe(1);
    expect(result.isMilestoneAge).toBe(true);
  });

  it('returns eligible=true for age 730 (year 2)', () => {
    const result = checkMilestoneEligibility(emptyHorse(AGE_YEAR_2));
    expect(result.eligible).toBe(true);
    expect(result.milestoneAge).toBe(2);
  });

  it('returns eligible=true for age 1095 (year 3)', () => {
    const result = checkMilestoneEligibility(emptyHorse(AGE_YEAR_3));
    expect(result.eligible).toBe(true);
    expect(result.milestoneAge).toBe(3);
  });

  it('returns eligible=false for non-milestone age', () => {
    const result = checkMilestoneEligibility(emptyHorse(AGE_NON_MILESTONE));
    expect(result.eligible).toBe(false);
    expect(result.isMilestoneAge).toBe(false);
  });

  it('returns eligible=false when milestone already evaluated', () => {
    const horse = emptyHorse(AGE_YEAR_1, { age_1: true });
    const result = checkMilestoneEligibility(horse);
    expect(result.eligible).toBe(false);
    expect(result.alreadyEvaluated).toBe(true);
  });

  it('includes milestoneKey in result', () => {
    const result = checkMilestoneEligibility(emptyHorse(AGE_YEAR_2));
    expect(result.milestoneKey).toBe('age_2');
  });
});

// ---------------------------------------------------------------------------
// getMilestoneSummary
// ---------------------------------------------------------------------------
describe('getMilestoneSummary', () => {
  it('returns expected shape', () => {
    const summary = getMilestoneSummary(emptyHorse(AGE_YEAR_1));
    expect(summary).toHaveProperty('currentAge');
    expect(summary).toHaveProperty('completedMilestones');
    expect(summary).toHaveProperty('pendingMilestones');
    expect(summary).toHaveProperty('nextMilestone');
    expect(summary).toHaveProperty('allMilestonesComplete');
  });

  it('currentAge matches Math.floor(age/365)', () => {
    const summary = getMilestoneSummary(emptyHorse(AGE_YEAR_2));
    expect(summary.currentAge).toBe(2);
  });

  it('completedMilestones lists completed keys', () => {
    const horse = emptyHorse(AGE_YEAR_2, { age_1: true });
    const summary = getMilestoneSummary(horse);
    expect(summary.completedMilestones).toContain('age_1');
  });

  it('pendingMilestones includes milestones up to current age not yet completed', () => {
    const horse = emptyHorse(AGE_YEAR_2, { age_1: true });
    const summary = getMilestoneSummary(horse);
    expect(summary.pendingMilestones).toContain('age_2');
    expect(summary.pendingMilestones).not.toContain('age_1');
  });

  it('allMilestonesComplete is true when all milestone ages done', () => {
    const horse = emptyHorse(AGE_YEAR_3, { age_1: true, age_2: true, age_3: true });
    const summary = getMilestoneSummary(horse);
    expect(summary.allMilestonesComplete).toBe(true);
  });

  it('allMilestonesComplete is false when a milestone is missing', () => {
    const horse = emptyHorse(AGE_YEAR_3, { age_1: true });
    const summary = getMilestoneSummary(horse);
    expect(summary.allMilestonesComplete).toBe(false);
  });

  it('nextMilestone is undefined when age is past all milestones', () => {
    const horse = emptyHorse(1500); // milestoneAge = 4, beyond all milestones
    const summary = getMilestoneSummary(horse);
    expect(summary.nextMilestone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateTraitScores
// ---------------------------------------------------------------------------
describe('calculateTraitScores', () => {
  it('returns empty object for empty task log', () => {
    expect(calculateTraitScores([])).toEqual({});
  });

  it('accumulates encourages from known task', () => {
    // brushing encourages: bonded, patient
    const scores = calculateTraitScores([{ task: BRUSHING }]);
    expect(scores.bonded).toBe(1);
    expect(scores.patient).toBe(1);
  });

  it('accumulates discourages as negative scores', () => {
    // brushing discourages: aloof
    const scores = calculateTraitScores([{ task: BRUSHING }]);
    expect(scores.aloof).toBe(-1);
  });

  it('stacks scores from repeated tasks', () => {
    const log = [{ task: BRUSHING }, { task: BRUSHING }, { task: BRUSHING }];
    const scores = calculateTraitScores(log);
    expect(scores.bonded).toBe(3);
    expect(scores.aloof).toBe(-3);
  });

  it('ignores unknown task names', () => {
    const scores = calculateTraitScores([{ task: UNKNOWN_TASK }]);
    expect(Object.keys(scores)).toHaveLength(0);
  });

  it('combines scores from different tasks', () => {
    // brushing encourages bonded; early_touch encourages trusting, brave
    const scores = calculateTraitScores([{ task: BRUSHING }, { task: EARLY_TOUCH }]);
    expect(scores.bonded).toBeGreaterThanOrEqual(1);
    expect(scores.trusting).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// applyTraitToHorse
// ---------------------------------------------------------------------------
describe('applyTraitToHorse', () => {
  it('applies trait to positive array when not epigenetic', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = applyTraitToHorse(horse, 'bonded', { epigenetic: false });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.positive).toContain('bonded');
  });

  it('applies to epigenetic array when metadata.epigenetic is true', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = applyTraitToHorse(horse, 'resilient', { epigenetic: true });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.epigenetic.some(t => t.name === 'resilient')).toBe(true);
  });

  it('applies to negative array when traitName starts with "resists_"', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = applyTraitToHorse(horse, 'resists_nervous', { epigenetic: false });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.negative).toContain('resists_nervous');
  });

  it('returns { applied: false, reason: duplicate_trait } when trait already exists', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    horse.epigeneticModifiers.positive = ['bonded'];
    const result = applyTraitToHorse(horse, 'bonded', { epigenetic: false });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('duplicate_trait');
  });

  it('initializes epigeneticModifiers if not present', () => {
    const horse = { id: 1, age: AGE_YEAR_1, task_log: [] };
    const result = applyTraitToHorse(horse, 'calm', { epigenetic: false });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.positive).toContain('calm');
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitMilestones
// ---------------------------------------------------------------------------
describe('evaluateTraitMilestones', () => {
  it('returns success=false with reason not_milestone_age for non-milestone age', () => {
    const horse = emptyHorse(AGE_NON_MILESTONE);
    const result = evaluateTraitMilestones(horse);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_milestone_age');
    expect(result.evaluationPerformed).toBe(false);
  });

  it('returns success=false with reason already_evaluated when milestone done', () => {
    const horse = emptyHorse(AGE_YEAR_1, { age_1: true });
    const result = evaluateTraitMilestones(horse);
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_evaluated');
  });

  it('returns success=true for eligible milestone with empty task_log', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = evaluateTraitMilestones(horse);
    expect(result.success).toBe(true);
    expect(result.traitsApplied).toHaveLength(0);
    expect(result.evaluationPerformed).toBe(true);
  });

  it('marks milestone as completed in updatedMilestones', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = evaluateTraitMilestones(horse);
    expect(result.updatedMilestones.age_1).toBe(true);
  });

  it('isEpigenetic=true for milestoneAge < 3', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = evaluateTraitMilestones(horse);
    expect(result.isEpigenetic).toBe(true);
  });

  it('isEpigenetic=false for milestoneAge === 3', () => {
    const horse = emptyHorse(AGE_YEAR_3);
    const result = evaluateTraitMilestones(horse);
    expect(result.isEpigenetic).toBe(false);
  });

  it('applies positive traits when task log reaches positive threshold', () => {
    // brushing x3 → bonded:3, patient:3 — both hit POSITIVE_THRESHOLD (3)
    const horse = emptyHorse(AGE_YEAR_2);
    horse.task_log = [{ task: BRUSHING }, { task: BRUSHING }, { task: BRUSHING }];
    const result = evaluateTraitMilestones(horse);
    expect(result.success).toBe(true);
    const appliedNames = result.traitsApplied.map(t => t.name);
    expect(appliedNames).toContain('bonded');
    expect(appliedNames).toContain('patient');
  });

  it('applies resistance trait when discourages hits negative threshold', () => {
    // brushing x3 → aloof:-3 → resists_aloof
    const horse = emptyHorse(AGE_YEAR_2);
    horse.task_log = [{ task: BRUSHING }, { task: BRUSHING }, { task: BRUSHING }];
    const result = evaluateTraitMilestones(horse);
    const appliedNames = result.traitsApplied.map(t => t.name);
    expect(appliedNames).toContain('resists_aloof');
  });

  it('returns traitScores in result', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    horse.task_log = [{ task: BRUSHING }];
    const result = evaluateTraitMilestones(horse);
    expect(typeof result.traitScores).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitMilestones — error catch branch (lines 167-170)
// ---------------------------------------------------------------------------
describe('evaluateTraitMilestones — error catch branch (lines 167-170)', () => {
  it('re-throws when horse is null (triggers catch at line 167 via horse.id TypeError)', () => {
    // null.id throws in the logger call at the top of the try block.
    // The catch block logs and re-throws — test confirms the throw propagates.
    expect(() => evaluateTraitMilestones(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyTraitToHorse — error catch branch (lines 288-291)
// ---------------------------------------------------------------------------
describe('applyTraitToHorse — error catch branch (lines 288-291)', () => {
  it('re-throws when epigeneticModifiers lacks epigenetic array (triggers catch at line 288)', () => {
    // horse.epigeneticModifiers is truthy (so || default is skipped),
    // but has no `epigenetic` property → currentModifiers.epigenetic.push() throws.
    const horse = {
      id: 1,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    };
    expect(() => applyTraitToHorse(horse, 'calm', { epigenetic: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Uncovered branch targets (Equoria-jkht)
// ---------------------------------------------------------------------------

describe('evaluateTraitMilestones — task_log||[] right-branch', () => {
  it('horse with no task_log property exercises task_log||[] right-branch', () => {
    // task_log is absent → task_log || [] defaults to [] → empty scores → no traits
    const horse = {
      id: 1,
      age: AGE_YEAR_1,
      trait_milestones: {},
      epigeneticModifiers: { positive: [], negative: [], hidden: [], epigenetic: [] },
    };
    const result = evaluateTraitMilestones(horse);
    expect(result.success).toBe(true);
    expect(result.traitsApplied).toHaveLength(0);
  });
});

describe('evaluateTraitMilestones — traitResult.applied false-branches', () => {
  it('positive trait already present: traitResult.applied=false branch at line 118', () => {
    // brushing x3 → bonded score=3 (=POSITIVE_THRESHOLD), patient score=3
    // pre-seed bonded → applyTraitToHorse returns applied=false for bonded
    const horse = emptyHorse(AGE_YEAR_2);
    horse.task_log = [{ task: BRUSHING }, { task: BRUSHING }, { task: BRUSHING }];
    horse.epigeneticModifiers.positive = ['bonded']; // already has bonded
    const result = evaluateTraitMilestones(horse);
    // bonded won't be applied (false branch) but patient will be
    expect(result.success).toBe(true);
    const names = result.traitsApplied.map(t => t.name);
    expect(names).not.toContain('bonded');
    expect(names).toContain('patient');
  });

  it('resistance trait already present: traitResult.applied=false branch at line 136', () => {
    // brushing x3 → aloof score=-3 (=NEGATIVE_THRESHOLD) → resists_aloof
    // pre-seed resists_aloof → applyTraitToHorse returns applied=false
    const horse = emptyHorse(AGE_YEAR_2);
    horse.task_log = [{ task: BRUSHING }, { task: BRUSHING }, { task: BRUSHING }];
    horse.epigeneticModifiers.negative = ['resists_aloof']; // already has it
    const result = evaluateTraitMilestones(horse);
    const names = result.traitsApplied.map(t => t.name);
    expect(names).not.toContain('resists_aloof');
  });
});

describe('applyTraitToHorse — default metadata parameter branch', () => {
  it('calling without 3rd argument exercises metadata={} default parameter', () => {
    const horse = emptyHorse(AGE_YEAR_1);
    const result = applyTraitToHorse(horse, 'calm');
    // metadata defaults to {} → epigenetic=false, source='milestone_evaluation'
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.positive).toContain('calm');
  });
});

describe('hasExistingTraitInHorse — sparse epigeneticModifiers || [] branches', () => {
  it('missing negative array exercises negative||[] right-branch (uses resists_ trait to push to negative)', () => {
    // no negative key → negative||[] right-branch covered; push goes to negative after being created by code
    // We apply 'resists_brave' (starts with resists_) so push targets negative, which we provide
    const horse = {
      id: 1,
      epigeneticModifiers: { positive: ['something_else'], negative: [], hidden: [], epigenetic: [] },
    };
    // Remove negative to trigger the || [] branch during hasExistingTraitInHorse check
    // but restore type so push succeeds — achieved by setting negative: undefined for CHECK
    // and then code uses || default ... actually we need a different approach:
    // Pass epigeneticModifiers with negative explicitly undefined but positive present
    horse.epigeneticModifiers = { positive: ['something_else'] };
    // Apply a resists_ trait — check uses positive||[] (found) + negative||[] (undefined→[]) etc.
    // But push target: since resists_ → tries negative.push(), negative is undefined → throws
    // Switch to non-resists trait, push goes to positive which IS present
    horse.epigeneticModifiers = { positive: [], negative: undefined, hidden: [], epigenetic: [] };
    // 'calm' is non-resists, non-epigenetic → push to positive (which exists as [])
    // check: positive||[] → [] (left branch, fine); negative||[] → undefined→[] (right branch covered)
    const result = applyTraitToHorse(horse, 'calm', { epigenetic: false });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.positive).toContain('calm');
  });

  it('missing hidden array exercises hidden||[] right-branch', () => {
    const horse = {
      id: 1,
      epigeneticModifiers: { positive: [], negative: [], hidden: undefined, epigenetic: [] },
    };
    const result = applyTraitToHorse(horse, 'brave', { epigenetic: false });
    expect(result.applied).toBe(true);
  });

  it('missing epigenetic array exercises epigenetic||[] right-branch', () => {
    const horse = {
      id: 1,
      epigeneticModifiers: { positive: [], negative: [], hidden: [], epigenetic: undefined },
    };
    const result = applyTraitToHorse(horse, 'resilient', { epigenetic: false });
    expect(result.applied).toBe(true);
  });

  it('missing positive array exercises positive||[] right-branch (uses resists_ to push to negative)', () => {
    // positive is falsy → positive||[] right-branch covered; push targets negative (present)
    const horse = {
      id: 1,
      epigeneticModifiers: { positive: undefined, negative: [], hidden: [], epigenetic: [] },
    };
    // 'resists_calm' starts with 'resists_' → push to negative (negative exists)
    const result = applyTraitToHorse(horse, 'resists_calm', { epigenetic: false });
    expect(result.applied).toBe(true);
    expect(horse.epigeneticModifiers.negative).toContain('resists_calm');
  });
});

describe('getMilestoneSummary — trait_milestones||{} right-branch', () => {
  it('horse with null trait_milestones exercises || {} right-branch', () => {
    const horse = { id: 1, age: AGE_YEAR_1, trait_milestones: null };
    const summary = getMilestoneSummary(horse);
    expect(Array.isArray(summary.completedMilestones)).toBe(true);
    expect(summary.completedMilestones).toHaveLength(0);
  });

  it('horse with undefined trait_milestones exercises || {} right-branch', () => {
    const horse = { id: 1, age: AGE_YEAR_2 };
    const summary = getMilestoneSummary(horse);
    expect(summary.completedMilestones).toHaveLength(0);
    expect(summary.pendingMilestones).toContain('age_1');
    expect(summary.pendingMilestones).toContain('age_2');
  });
});
