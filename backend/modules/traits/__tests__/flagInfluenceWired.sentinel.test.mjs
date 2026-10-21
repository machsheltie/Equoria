/**
 * flagInfluenceWired.sentinel.test.mjs (Equoria-yzqhj.1)
 *
 * Before yzqhj.1, epigenetic flags were computed and persisted to
 * Horse.epigeneticFlags but changed NO gameplay outcome.
 *
 * What is wired today (checked 2026-10-21): bonding (groomInteractionController,
 * enhancedGroomController -> applyFlagInfluencesToBonding) and training
 * (trainingController -> applyFlagInfluencesToTraining). These tests pin the
 * helper behaviour those paths rely on.
 *
 * NOT wired: competition. applyFlagInfluencesToCompetition has no live caller.
 * This file used to "prove" competition wiring through utils/competitionScore.mjs,
 * but no show ever scored through that file; it was deleted as dead code on
 * 2026-10-21 and the gap is tracked for the owner's ruling (Equoria-k4j8r).
 *
 * No mocks: real epigeneticFlagInfluence functions.
 */

import { describe, it, expect } from '@jest/globals';
import {
  applyFlagInfluencesToCompetition,
  applyFlagInfluencesToTraining,
  applyFlagInfluencesToBonding,
} from '../../../utils/epigeneticFlagInfluence.mjs';

describe('Flag influence helpers behave for the training + bonding live paths (Equoria-yzqhj.1)', () => {
  it('confident raises training stat-gain efficiency (trainingEfficiency modifier)', () => {
    const flagged = applyFlagInfluencesToTraining(0.15, ['confident']);
    expect(flagged.modifiedEfficiency).toBeGreaterThan(0.15);
    expect(flagged.totalModifier).toBeGreaterThan(0);
    // boundary: no flags = unchanged
    expect(applyFlagInfluencesToTraining(0.15, []).modifiedEfficiency).toBe(0.15);
  });

  it('affectionate raises bond gain; aloof reduces it', () => {
    const affectionate = applyFlagInfluencesToBonding(10, ['affectionate']);
    const aloof = applyFlagInfluencesToBonding(10, ['aloof']);
    expect(affectionate.modifiedBondingChange).toBeGreaterThan(10);
    expect(aloof.modifiedBondingChange).toBeLessThan(10);
    expect(applyFlagInfluencesToBonding(10, []).modifiedBondingChange).toBe(10);
  });

  it('competition helper is a pure no-op for the unflagged path', () => {
    const r = applyFlagInfluencesToCompetition(100, [], 'Racing');
    expect(r.modifiedScore).toBe(100);
    expect(r.totalModifier).toBe(0);
  });
});
