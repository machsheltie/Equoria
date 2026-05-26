/**
 * flagInfluenceWired.sentinel.test.mjs (Equoria-yzqhj.1)
 *
 * Before this fix, epigenetic flags were computed + persisted to
 * Horse.epigeneticFlags but changed NO gameplay outcome — the
 * epigeneticFlagInfluence.mjs apply* functions had ZERO live callers.
 *
 * This sentinel proves the influence is now WIRED into the canonical live
 * scorers (OPTIMAL_FIX_DISCIPLINE §2 — fires on the real regression, not
 * merely passes on clean input):
 *
 *   1. Competition: a horse with a competitionBonus flag (`brave`) scores
 *      higher than an otherwise-identical unflagged horse (luck pinned).
 *   2. Competition: a competitionPenalty flag (`fearful`) scores lower.
 *   3. Bonding: a bondingResistance flag (`aloof`) reduces bond gain;
 *      a bondingRate flag (`affectionate`) raises it (module-level).
 *
 * No mocks: these call the real competitionScore + epigeneticFlagInfluence
 * functions. Luck is pinned via the _luckFn injection so the comparison is
 * deterministic. The DB-backed end-to-end proof (runEnhancedCompetition /
 * trainHorse / recordInteraction reading epigeneticFlags off a real row)
 * lives in the lead's serial integration gate; this worktree cannot run the
 * full real-DB suite (node_modules workspace deps unavailable).
 */

import { describe, it, expect } from '@jest/globals';
import { calculateCompetitionScoreDetailed } from '../../../utils/competitionScore.mjs';
import {
  applyFlagInfluencesToCompetition,
  applyFlagInfluencesToTraining,
  applyFlagInfluencesToBonding,
} from '../../../utils/epigeneticFlagInfluence.mjs';

// A fixed-luck function so the ±9% random term is identical across runs.
const pinnedLuck = () => 0.5; // → luckModifier 0 (0.5 * 0.18 - 0.09)

function baseHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestFixture-flag-influence',
    speed: 80,
    stamina: 80,
    intelligence: 80,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    epigeneticFlags: [],
    ...overrides,
  };
}

describe('Epigenetic flag influence is WIRED into the live competition scorer (Equoria-yzqhj.1)', () => {
  it('a brave (competitionBonus) horse scores HIGHER than an identical unflagged horse', () => {
    const unflagged = calculateCompetitionScoreDetailed(baseHorse(), 'Racing', 'ridden', pinnedLuck);
    const brave = calculateCompetitionScoreDetailed(
      baseHorse({ epigeneticFlags: ['brave'] }),
      'Racing',
      'ridden',
      pinnedLuck,
    );
    expect(brave.finalScore).toBeGreaterThan(unflagged.finalScore);
    // flagImpact is surfaced for the response envelope
    expect(brave.flagImpact).not.toBeNull();
    expect(brave.flagImpact.totalModifier).toBeGreaterThan(0);
    expect(unflagged.flagImpact).toBeNull();
  });

  it('a fearful (competitionPenalty) horse scores LOWER than an identical unflagged horse', () => {
    const unflagged = calculateCompetitionScoreDetailed(baseHorse(), 'Racing', 'ridden', pinnedLuck);
    const fearful = calculateCompetitionScoreDetailed(
      baseHorse({ epigeneticFlags: ['fearful'] }),
      'Racing',
      'ridden',
      pinnedLuck,
    );
    expect(fearful.finalScore).toBeLessThan(unflagged.finalScore);
    expect(fearful.flagImpact.totalModifier).toBeLessThan(0);
  });

  it('an empty/absent flag array is a no-op on the score (boundary)', () => {
    const none = calculateCompetitionScoreDetailed(baseHorse(), 'Racing', 'ridden', pinnedLuck);
    const undef = calculateCompetitionScoreDetailed(
      baseHorse({ epigeneticFlags: undefined }),
      'Racing',
      'ridden',
      pinnedLuck,
    );
    expect(none.finalScore).toBe(undef.finalScore);
  });
});

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
