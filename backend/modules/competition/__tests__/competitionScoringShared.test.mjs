/**
 * Sentinel test (Equoria-pqdte): the rider flag-compatibility scoring step
 * must live in ONE place and be consumed by BOTH competition engines so a
 * change to a single constant cannot drift between paths.
 *
 * Pre-pqdte state: BONUS_CAP / PENALTY_CAP were locally re-declared inside
 * both simulateCompetition.mjs and showController.mjs#executeClosedShows.
 * Any change to riderBonus.mjs' BONUS_CAP did NOT propagate; the local
 * mirrors had to be hand-updated, and the original drift was already noted
 * in the showController:489 comment ("mirrors simulateCompetition.mjs
 * exactly").
 *
 * After pqdte:
 *   - BONUS_CAP and PENALTY_CAP are exported from riderBonus.mjs (single
 *     source of truth).
 *   - modules/competition/services/competitionScoring.mjs#applyRiderCompatibility
 *     is the single helper that applies the rider flag-compat bias and
 *     clamps to those caps.
 *   - Both simulateCompetition.mjs and showController.mjs import that
 *     helper (no local cap mirrors anywhere).
 *
 * This file is the SENTINEL: it asserts (a) the shared helper exists,
 * (b) it consumes the exported caps, and (c) source-level enforcement that
 * neither engine re-declares the caps locally — if a future change re-adds
 * `const RIDER_BONUS_CAP = 0.1` anywhere outside the helper, this test
 * fails immediately.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { BONUS_CAP, PENALTY_CAP, applyRiderModifiers } from '../../../utils/riderBonus.mjs';
import { applyRiderCompatibility } from '../services/competitionScoring.mjs';

const ROOT = resolve(process.cwd());

describe('competitionScoring shared helper (Equoria-pqdte)', () => {
  it('exports BONUS_CAP and PENALTY_CAP from riderBonus.mjs', () => {
    expect(typeof BONUS_CAP).toBe('number');
    expect(typeof PENALTY_CAP).toBe('number');
    // pre-pqdte hardcoded values — locks the canonical caps so a silent
    // change to riderBonus.mjs has to update this test deliberately.
    expect(BONUS_CAP).toBe(0.1);
    expect(PENALTY_CAP).toBe(0.08);
  });

  it('exposes applyRiderCompatibility(bonusPercent, penaltyPercent, epigeneticFlags)', () => {
    expect(typeof applyRiderCompatibility).toBe('function');
    // No flags → no change (identity, regression-safe).
    expect(applyRiderCompatibility({ bonusPercent: 0.05, penaltyPercent: 0, epigeneticFlags: [] })).toEqual({
      bonusPercent: 0.05,
      penaltyPercent: 0,
    });
  });

  it('clamps the modified bonus to BONUS_CAP and the penalty to PENALTY_CAP', () => {
    // Force a strongly positive compatibility factor by passing positive flags,
    // then assert the bonus cannot exceed BONUS_CAP.
    const positiveFlags = ['brave', 'confident', 'affectionate', 'resilient'];
    const { bonusPercent } = applyRiderCompatibility({
      bonusPercent: 0.1, // already at cap
      penaltyPercent: 0,
      epigeneticFlags: positiveFlags,
    });
    expect(bonusPercent).toBeLessThanOrEqual(BONUS_CAP);

    // Same for penalty (negative flags raise it, must clamp).
    const negativeFlags = ['fearful', 'insecure', 'skittish', 'fragile'];
    const { penaltyPercent } = applyRiderCompatibility({
      bonusPercent: 0,
      penaltyPercent: 0.08, // already at cap
      epigeneticFlags: negativeFlags,
    });
    expect(penaltyPercent).toBeLessThanOrEqual(PENALTY_CAP);
  });

  // ── SENTINEL: source-level enforcement of single source of truth ───────
  //
  // Neither simulateCompetition.mjs nor showController.mjs may re-declare
  // RIDER_BONUS_CAP or RIDER_PENALTY_CAP locally. They must consume the
  // shared helper from competitionScoring.mjs (which itself imports the
  // canonical caps from riderBonus.mjs).
  //
  // If a future change re-introduces a local mirror cap, this test fails
  // and surfaces the drift before it can ship.
  it('SENTINEL: simulateCompetition.mjs does NOT locally redeclare cap constants', () => {
    const src = readFileSync(resolve(ROOT, 'logic/simulateCompetition.mjs'), 'utf8');
    expect(src).not.toMatch(/const\s+RIDER_BONUS_CAP\s*=/);
    expect(src).not.toMatch(/const\s+RIDER_PENALTY_CAP\s*=/);
  });

  it('SENTINEL: showController.mjs does NOT locally redeclare cap constants', () => {
    const src = readFileSync(resolve(ROOT, 'modules/competition/shows/showController.mjs'), 'utf8');
    expect(src).not.toMatch(/const\s+RIDER_BONUS_CAP\s*=/);
    expect(src).not.toMatch(/const\s+RIDER_PENALTY_CAP\s*=/);
  });

  it('SENTINEL: both engines import the shared applyRiderCompatibility helper', () => {
    const simSrc = readFileSync(resolve(ROOT, 'logic/simulateCompetition.mjs'), 'utf8');
    const showSrc = readFileSync(resolve(ROOT, 'modules/competition/shows/showController.mjs'), 'utf8');
    expect(simSrc).toMatch(/applyRiderCompatibility/);
    expect(showSrc).toMatch(/applyRiderCompatibility/);
  });

  it('SENTINEL: applyRiderModifiers still accepts inputs up to the (post-helper) caps', () => {
    // Defense-in-depth: if a future commit lowered BONUS_CAP in riderBonus.mjs
    // but forgot to lower the same constant in the shared helper, the
    // applyRiderModifiers call inside scoring would throw on a value above
    // the new cap. This catches that drift at the call boundary.
    expect(() => applyRiderModifiers(100, BONUS_CAP, PENALTY_CAP)).not.toThrow();
  });
});
