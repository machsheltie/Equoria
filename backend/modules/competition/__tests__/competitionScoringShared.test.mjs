/**
 * Sentinel test (Equoria-pqdte): the rider flag-compatibility scoring step
 * must live in ONE place and be consumed by BOTH competition engines so a
 * change to a single constant cannot drift between paths.
 *
 * Pre-pqdte state: bonusCap / penaltyCap were locally re-declared inside
 * both simulateCompetition.mjs and showExecutionService.mjs#executeClosedShows.
 * Any change to riderBonus.mjs' bonusCap did NOT propagate; the local
 * mirrors had to be hand-updated, and the original drift was already noted
 * in the showController:489 comment ("mirrors simulateCompetition.mjs
 * exactly").
 *
 * After pqdte:
 *   - bonusCap and penaltyCap are exported from riderBonus.mjs (single
 *     source of truth).
 *   - modules/competition/services/competitionScoring.mjs#applyRiderCompatibility
 *     is the single helper that applies the rider flag-compat bias and
 *     clamps to those caps.
 *   - Both simulateCompetition.mjs and showController.mjs import that
 *     helper (no local cap mirrors anywhere).
 *
 * This file asserts (a) the shared helper exists and (b) it consumes the
 * exported caps.
 *
 * CONTRACT CHANGED BY THE OWNER, 2026-10-29 (q300, Equoria-efs4j): the old
 * epigeneticFlags store and every reader of it are removed. Old contract:
 * competitionScoring exported applyRiderCompatibility (the rider flag-compat
 * helper, unused by the scorer since 2026-10-23) and (a)/(b) pinned it. New
 * contract: the helper and utils/riderFlagCompatibility.mjs are gone, and this
 * file pins that they stay gone; the cap and scorer sentinels are unchanged.
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { bonusCap, penaltyCap, applyRiderModifiers } from '../../../utils/riderBonus.mjs';
import * as competitionScoring from '../services/competitionScoring.mjs';
import * as competitionModule from '../index.mjs';

const ROOT = resolve(process.cwd());

describe('competitionScoring shared helper (Equoria-pqdte)', () => {
  it('exports bonusCap and penaltyCap from riderBonus.mjs', () => {
    expect(typeof bonusCap).toBe('number');
    expect(typeof penaltyCap).toBe('number');
    // pre-pqdte hardcoded values — locks the canonical caps so a silent
    // change to riderBonus.mjs has to update this test deliberately.
    expect(bonusCap).toBe(0.1);
    expect(penaltyCap).toBe(0.08);
  });

  it('the rider flag-compat helper is gone with the flag store (Equoria-efs4j)', () => {
    expect(competitionScoring).not.toHaveProperty('applyRiderCompatibility');
    expect(competitionScoring.default).not.toHaveProperty('applyRiderCompatibility');
    expect(competitionModule).not.toHaveProperty('applyRiderCompatibility');
    expect(existsSync(resolve(ROOT, 'utils/riderFlagCompatibility.mjs'))).toBe(false);
  });

  it('SENTINEL: applyRiderModifiers still accepts inputs up to the (post-helper) caps', () => {
    // Defense-in-depth: if a future commit lowered bonusCap in riderBonus.mjs
    // but forgot to lower the same constant in the shared helper, the
    // applyRiderModifiers call inside scoring would throw on a value above
    // the new cap. This catches that drift at the call boundary.
    expect(() => applyRiderModifiers(100, bonusCap, penaltyCap)).not.toThrow();
  });
});
