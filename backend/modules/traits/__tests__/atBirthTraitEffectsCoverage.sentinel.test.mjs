/**
 * Sentinel: every at-birth-emittable epigenetic trait MUST have an entry in
 * backend/utils/traitEffects.mjs (Equoria-2mgor, review decision B7).
 *
 * WHY THIS EXISTS
 * ---------------
 * At birth, a foal can be assigned epigenetic traits from several code paths:
 *   1. applyEpigeneticTraitsAtBirth.mjs — the canonical synchronous roller
 *      wired to the live foaling path (foalingService.createFoalFromPregnancy).
 *      It emits a fixed set of trait-name string literals via `positive.push`/
 *      `negative.push`, plus a dynamically-constructed `discipline_affinity_*`
 *      name derived from lineage discipline.
 *   2. foalingService.mjs — the pregnancy feed-tier bonus rolls, which pick a
 *      trait from two module-private pools (PREGNANCY_BONUS_POSITIVE_TRAITS /
 *      PREGNANCY_BONUS_NEGATIVE_TRAITS).
 *
 * If any of those names is NOT a key in traitEffects.mjs, the trait is "dead":
 * it gets written onto a horse's epigeneticModifiers but has zero gameplay
 * effect (training/competition/display all key off traitEffects). The
 * 2026-05-21 adversarial review found concrete offenders
 * (wellNourished/vigorous/undernourished/weakImmunity/lowVigor) plus a naming
 * drift (the emitter builds discipline_affinity_show_jumping while traitEffects
 * defines discipline_affinity_jumping).
 *
 * This sentinel enumerates the FULL at-birth-emittable set straight from the
 * source-of-truth files (parsed, so it stays current as the emitters change)
 * and asserts each name is a defined traitEffects key. It permanently catches
 * any future "born trait with no effect" config gap and any casing/naming
 * drift between an emitter and the effects map.
 *
 * SENTINEL-POSITIVE PROOF (OPTIMAL_FIX_DISCIPLINE §2)
 * ---------------------------------------------------
 * A dedicated test below plants a fake dead trait into the enumerated set and
 * proves the coverage assertion FAILS for it, then proves a real trait passes.
 * This demonstrates the check actually fires on a violation rather than being
 * a placebo that only passes when nothing is wrong.
 *
 * KNOWN-GAP BASELINE (a shrink-only allowlist, NOT a skip)
 * --------------------------------------------------------
 * As of 2026-05-21 the live data already has dead at-birth traits and missing
 * discipline-affinity effects. Fixing the DATA is the explicit scope of the
 * design epic Equoria-9o3n7 (canonical vocabulary + B4 pregnancy-pool repoint
 * + B5 per-discipline affinity effects) — "NOT for the parallel cleanup team",
 * and this issue's own description says to run "after vocabulary + B5 affinity
 * coverage land". Until that lands, this sentinel cannot be all-green without
 * either weakening the assertion (forbidden, EDGE_CASE_FIX_DISCIPLINE §2) or
 * mutating game data out of scope.
 *
 * Resolution: KNOWN_MISSING_AT_BIRTH_TRAITS is an explicit, visible baseline of
 * the CURRENTLY-accepted gaps. The sentinel asserts:
 *   (a) NO at-birth-emittable trait is missing from traitEffects UNLESS it is
 *       in the baseline — so a NEW dead trait fails the build immediately; and
 *   (b) every baseline entry is STILL actually missing — so when Equoria-9o3n7
 *       adds a trait's effect, this test FAILS until the baseline entry is
 *       removed, forcing the allowlist to shrink toward empty.
 * This is a tightening guard (catches new gaps + forces old gaps to be retired
 * as they are fixed), not a skip or a relaxed assertion. When Equoria-9o3n7 is
 * complete the baseline should be emptied and (a)+(b) collapse to the pure
 * "zero missing" assertion the issue describes.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getAllTraitEffects } from '../../../utils/traitEffects.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UTILS_DIR = path.resolve(__dirname, '../../../utils');
const FOALING_SERVICE = path.resolve(__dirname, '../../horses/services/foalingService.mjs');
const AT_BIRTH_EMITTER = path.join(UTILS_DIR, 'applyEpigeneticTraitsAtBirth.mjs');

/**
 * Currently-accepted at-birth-emittable traits with NO traitEffects entry.
 * SHRINK-ONLY: every removal here must be matched by adding the trait's effect
 * in traitEffects.mjs (the work tracked by Equoria-9o3n7). When the epic lands,
 * empty this set and the test reduces to a pure "zero missing" assertion.
 *
 * The contents below were produced by RUNNING this sentinel against the live
 * data on 2026-05-21, not invented:
 *   - Dead pregnancy-bonus-pool literals (Equoria-9o3n7 B4 repoint):
 *       wellNourished, vigorous, undernourished, weakImmunity, lowVigor
 *   - Discipline-affinity names with no rich effect yet (Equoria-9o3n7 B5).
 *     traitEffects currently defines only racing / jumping / dressage; every
 *     other DISCIPLINES value the emitter can build is listed here, including
 *     the naming-drift case discipline_affinity_show_jumping (emitter builds
 *     _show_jumping; traitEffects has _jumping).
 */
const KNOWN_MISSING_AT_BIRTH_TRAITS = new Set([
  // B4 — pregnancy-bonus pool repointed (Equoria-9o3n7.4): the former dead
  // literals (wellNourished, vigorous, undernourished, weakImmunity, lowVigor)
  // were removed from PREGNANCY_BONUS_*_TRAITS in foalingService.mjs and are no
  // longer at-birth-emittable, so per the shrink-only contract (assertion (b))
  // they have been retired from this baseline.
  // B5 — discipline-affinity traits lacking a traitEffects entry
  'discipline_affinity_show_jumping',
  'discipline_affinity_cross_country',
  'discipline_affinity_western_pleasure',
  'discipline_affinity_reining',
  'discipline_affinity_cutting',
  'discipline_affinity_barrel_racing',
  'discipline_affinity_roping',
  'discipline_affinity_team_penning',
  'discipline_affinity_rodeo',
  'discipline_affinity_hunter',
  'discipline_affinity_saddleseat',
  'discipline_affinity_endurance',
  'discipline_affinity_eventing',
  'discipline_affinity_vaulting',
  'discipline_affinity_polo',
  'discipline_affinity_combined_driving',
  'discipline_affinity_fine_harness',
  'discipline_affinity_gaited',
  'discipline_affinity_gymkhana',
  'discipline_affinity_steeplechase',
  'discipline_affinity_harness_racing',
]);

/**
 * Extract the static trait-name literals an emitter pushes onto its positive/
 * negative result arrays. Catches both `positive.push('x')` and
 * `negative.push('x')` (single or double quotes). Dynamically-built names
 * (template literals) are intentionally NOT matched here — discipline affinity
 * is handled separately below from the canonical DISCIPLINES roster.
 */
function extractPushedTraitLiterals(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const re = /\b(?:positive|negative)\.push\(\s*(['"])([A-Za-z0-9_]+)\1\s*\)/g;
  const found = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    found.add(m[2]);
  }
  return found;
}

/**
 * Extract the trait-name string literals listed inside the pregnancy-bonus
 * pool arrays in foalingService.mjs. The pools are module-private `const`s, so
 * we read them from source rather than importing. Anchored on the pool
 * variable names so unrelated literals are not swept in.
 */
function extractPregnancyBonusPoolTraits() {
  const src = readFileSync(FOALING_SERVICE, 'utf8');
  const found = new Set();
  for (const poolName of ['PREGNANCY_BONUS_POSITIVE_TRAITS', 'PREGNANCY_BONUS_NEGATIVE_TRAITS']) {
    // Match `const POOL = Object.freeze([ ... ]);` (or plain `[ ... ]`).
    const blockRe = new RegExp(`${poolName}\\s*=\\s*(?:Object\\.freeze\\()?\\[([\\s\\S]*?)\\]`);
    const block = blockRe.exec(src);
    expect(block).not.toBeNull(); // guard: pool must still exist / be findable
    const literalRe = /(['"])([A-Za-z0-9_]+)\1/g;
    let lm;
    while ((lm = literalRe.exec(block[1])) !== null) {
      found.add(lm[2]);
    }
  }
  return found;
}

/**
 * Build the discipline-affinity trait names exactly the way the emitter does:
 *   `discipline_affinity_${discipline.toLowerCase().replace(/\s+/g, '_')}`
 * for every canonical competition discipline. The emitter derives the
 * discipline from lineage at runtime, so any DISCIPLINES value is reachable.
 */
function buildEmittableAffinityTraits() {
  const found = new Set();
  for (const discipline of Object.values(DISCIPLINES)) {
    found.add(`discipline_affinity_${discipline.toLowerCase().replace(/\s+/g, '_')}`);
  }
  return found;
}

/**
 * The complete set of trait names any at-birth path can emit.
 * Discipline-affinity names are tagged separately so the failure message can
 * distinguish "missing rich-effect affinity" (a known B5 gap) from a plain
 * dead trait.
 */
function collectAtBirthEmittableTraits() {
  const literal = new Set([...extractPushedTraitLiterals(AT_BIRTH_EMITTER), ...extractPregnancyBonusPoolTraits()]);
  const affinity = buildEmittableAffinityTraits();
  return { literal, affinity, all: new Set([...literal, ...affinity]) };
}

describe('at-birth-emittable trait → traitEffects coverage (sentinel, Equoria-2mgor)', () => {
  const effects = getAllTraitEffects();
  const effectKeys = new Set(Object.keys(effects));
  const { literal, affinity, all } = collectAtBirthEmittableTraits();

  it('enumerates a non-empty at-birth-emittable trait set from the source-of-truth files', () => {
    // Guards against a parsing regression silently emptying the set (which
    // would make every coverage assertion vacuously pass).
    expect(literal.size).toBeGreaterThan(0);
    expect(affinity.size).toBeGreaterThan(0);
    // Spot-check that known emitter literals are actually captured.
    expect(literal.has('resilient')).toBe(true);
    expect(literal.has('legacyTalent')).toBe(true); // §C: canonical camelCase emitter literal
    expect(affinity.has('discipline_affinity_racing')).toBe(true);
  });

  it('no at-birth-emittable trait is missing from traitEffects EXCEPT documented known gaps', () => {
    // (a) Any NEW gap (not in the known-gap baseline) fails the build. This is
    //     the permanent "born trait with no effect" catch the issue asks for.
    const missing = [...all].filter(name => !effectKeys.has(name));
    const unexpectedMissing = missing.filter(name => !KNOWN_MISSING_AT_BIRTH_TRAITS.has(name)).sort();

    // Diagnostic split so a future failure tells you which class of gap it is.
    const unexpectedLiterals = unexpectedMissing.filter(n => literal.has(n));
    const unexpectedAffinity = unexpectedMissing.filter(n => affinity.has(n));

    expect({ unexpectedMissing, unexpectedLiterals, unexpectedAffinity }).toEqual({
      unexpectedMissing: [],
      unexpectedLiterals: [],
      unexpectedAffinity: [],
    });
  });

  it('the known-gap baseline can only shrink: every baseline entry is still actually missing', () => {
    // (b) When Equoria-9o3n7 adds a trait's effect, this fails until the stale
    //     baseline entry is removed — forcing the allowlist toward empty. Also
    //     guards against a baseline entry that is no longer emittable at all
    //     (drifted away from the source-of-truth files).
    const staleBaseline = [...KNOWN_MISSING_AT_BIRTH_TRAITS]
      .filter(name => effectKeys.has(name) || !all.has(name))
      .sort();

    expect(staleBaseline).toEqual([]);
  });
});

describe('sentinel-positive proof: the coverage check fires on a violation (Equoria-2mgor)', () => {
  const effects = getAllTraitEffects();
  const effectKeys = new Set(Object.keys(effects));

  // Reproduces assertion (a) exactly: an emittable trait that is missing from
  // traitEffects AND not in the known-gap baseline is an "unexpected" gap.
  function unexpectedMissingFor(emittableSet) {
    return [...emittableSet]
      .filter(name => !effectKeys.has(name))
      .filter(name => !KNOWN_MISSING_AT_BIRTH_TRAITS.has(name))
      .sort();
  }

  it('FAILS when a fake dead trait is emittable (proves assertion (a) is not a placebo)', () => {
    const planted = new Set(['__fake_dead_trait_for_sentinel__']);
    // Not in traitEffects and not baselined → must be flagged unexpected.
    expect(unexpectedMissingFor(planted)).toEqual(['__fake_dead_trait_for_sentinel__']);
  });

  it('PASSES for a real effect-backed trait (planted trait removed)', () => {
    expect(unexpectedMissingFor(new Set(['resilient']))).toEqual([]);
  });

  it('PASSES for a known-gap trait while it stays in the baseline (no false alarm on documented gaps)', () => {
    // A baselined still-missing trait is tolerated by assertion (a)...
    // discipline_affinity_show_jumping is emitted (Show Jumping → _show_jumping)
    // but traitEffects only defines discipline_affinity_jumping — a B5 naming
    // gap still tracked in the baseline.
    expect(unexpectedMissingFor(new Set(['discipline_affinity_show_jumping']))).toEqual([]);
    // ...but it is genuinely missing from traitEffects right now (real gap).
    expect(effectKeys.has('discipline_affinity_show_jumping')).toBe(false);
  });
});
