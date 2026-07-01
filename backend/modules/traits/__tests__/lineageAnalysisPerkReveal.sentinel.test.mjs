/**
 * Lineage-Analysis Perk Reveal — sentinel (Equoria-245bt)
 *
 * Proves the intentional lineage-analysis half of the
 * 'lineage_analysis_or_2_triggers' reveal condition is wired end-to-end:
 *
 *   (a) NO lineage signal + triggerCount < 2 → perk stays HIDDEN
 *   (b) WITH lineage signal + triggerCount < 2 → perk REVEALS (the new branch)
 *   (c) triggerCount >= 2 → perk REVEALS regardless of the signal
 *
 * The reveal is exercised through the public `applyRareTraitBoosterEffects`
 * (which threads `conditions` into the private `shouldRevealPerk`). The
 * fey-touched perk is the only booster whose revealCondition is
 * 'lineage_analysis_or_2_triggers', so it is the perk under test.
 *
 * Real-DB half: the persistence + query helpers
 * (recordLineageAnalysisPerformed / hasLineageAnalysisBeenPerformed) are
 * exercised against the canonical DB with a scoped TestFixture- horse and
 * id-scoped, cascade-covered cleanup — proving the intentional per-horse
 * signal round-trips through the existing UltraRareTraitEvent event log with
 * NO schema migration.
 *
 * Sentinel discipline (OPTIMAL_FIX_DISCIPLINE §2): each case asserts the reveal
 * FIRES when it should and STAYS FALSE when it should not — not merely that the
 * happy path passes.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { applyRareTraitBoosterEffects, RARE_TRAIT_BOOSTER_PERKS } from '../../../utils/groomRareTraitPerks.mjs';
import { recordLineageAnalysisPerformed, hasLineageAnalysisBeenPerformed } from '../services/ultraRareTraitQueries.mjs';

// fey-touched is the ONLY perk with revealCondition 'lineage_analysis_or_2_triggers'.
const FEY_PERK = 'fey-touched';
const FEY_TRAIT = RARE_TRAIT_BOOSTER_PERKS[FEY_PERK].targetTrait; // 'fey-kissed'

function groomWithFey(perkOverrides = {}) {
  return {
    id: 999999,
    rareTraitPerks: {
      [FEY_PERK]: {
        ...RARE_TRAIT_BOOSTER_PERKS[FEY_PERK],
        triggerCount: 0,
        revealed: false,
        ...perkOverrides,
      },
    },
  };
}

describe('lineage_analysis_or_2_triggers reveal — conditions threading (Equoria-245bt)', () => {
  // Guard: the perk under test must actually use the branch we are proving.
  it('fey-touched uses the lineage_analysis_or_2_triggers reveal condition', () => {
    expect(RARE_TRAIT_BOOSTER_PERKS[FEY_PERK].revealCondition).toBe('lineage_analysis_or_2_triggers');
  });

  // ── (a) NO signal + triggerCount < 2 → stays hidden ──────────────────────
  it('(a) does NOT reveal with no lineage signal and triggerCount < 2', () => {
    // triggerCount starts at 0; a single call increments it to 1 (< 2), and no
    // lineage signal is supplied → perk must stay hidden.
    const groomData = groomWithFey({ triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, {});
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(false);
  });

  it('(a) does NOT reveal when lineageAnalysisPerformed is explicitly false', () => {
    const groomData = groomWithFey({ triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, {
      lineageAnalysisPerformed: false,
    });
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(false);
  });

  // ── (b) WITH signal + triggerCount < 2 → reveals (the new branch) ─────────
  it('(b) REVEALS with lineage signal even though triggerCount < 2 (new branch)', () => {
    // triggerCount 0 → 1 after the call (still < 2). The ONLY thing that can
    // flip revealed here is the lineage signal — so this asserts the new branch.
    const groomData = groomWithFey({ triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, {
      lineageAnalysisPerformed: true,
    });
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(true);
  });

  // ── (c) triggerCount >= 2 → reveals regardless of the signal ─────────────
  it('(c) REVEALS when triggerCount reaches 2 with no lineage signal', () => {
    const groomData = groomWithFey({ triggerCount: 1, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, {});
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(true);
  });

  it('(c) REVEALS when triggerCount reaches 2 AND lineage signal present', () => {
    const groomData = groomWithFey({ triggerCount: 1, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, {
      lineageAnalysisPerformed: true,
    });
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(true);
  });

  // Regression guard: the OTHER reveal condition must NOT be affected by the
  // lineage signal — a lineage signal alone must not reveal an
  // after_2_successful_triggers perk (phoenix-born-booster).
  it('does NOT reveal an after_2_successful_triggers perk from the lineage signal alone', () => {
    const PHOENIX_PERK = 'phoenix-born-booster';
    const PHOENIX_TRAIT = RARE_TRAIT_BOOSTER_PERKS[PHOENIX_PERK].targetTrait;
    const groomData = {
      id: 999998,
      rareTraitPerks: {
        [PHOENIX_PERK]: {
          ...RARE_TRAIT_BOOSTER_PERKS[PHOENIX_PERK],
          triggerCount: 0,
          revealed: false,
        },
      },
    };
    applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData, {
      lineageAnalysisPerformed: true,
    });
    // after_2_successful_triggers ignores the lineage signal → still hidden at count 1.
    expect(groomData.rareTraitPerks[PHOENIX_PERK].revealed).toBe(false);
  });
});

describe('lineage-analysis signal persistence round-trip (Equoria-245bt, real DB)', () => {
  const createdHorseIds = [];

  afterAll(async () => {
    // Cascade on UltraRareTraitEvent.horseId cleans the events; id-scoped delete.
    await cleanupTestHorses(prisma, createdHorseIds);
  }, 30000);

  it('hasLineageAnalysisBeenPerformed is false BEFORE any analysis, true AFTER', async () => {
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-lineageSignal-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
      },
      createdHorseIds,
    );

    // Before the deliberate action: no signal.
    await expect(hasLineageAnalysisBeenPerformed(horse.id)).resolves.toBe(false);

    // The deliberate action persists the signal.
    const event = await recordLineageAnalysisPerformed(horse.id, {
      pairedWith: 12345,
      generations: 3,
    });
    expect(event.eventType).toBe('lineage_analysis');
    expect(event.horseId).toBe(horse.id);

    // After: the signal is queryable.
    await expect(hasLineageAnalysisBeenPerformed(horse.id)).resolves.toBe(true);
  }, 30000);

  it('the persisted signal drives the reveal end-to-end (query → conditions → reveal)', async () => {
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-lineageReveal-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2019-06-01'),
      },
      createdHorseIds,
    );

    await recordLineageAnalysisPerformed(horse.id, { generations: 2 });

    // Source the signal exactly as the evaluate route does.
    const lineageAnalysisPerformed = await hasLineageAnalysisBeenPerformed(horse.id);
    expect(lineageAnalysisPerformed).toBe(true);

    const groomData = groomWithFey({ triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData, { lineageAnalysisPerformed });
    // triggerCount is 1 (< 2) after the call, so ONLY the sourced signal reveals it.
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(true);
  }, 30000);
});
