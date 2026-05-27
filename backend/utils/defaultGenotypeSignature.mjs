/**
 * defaultGenotypeSignature.mjs (Equoria-kfgep)
 *
 * Shared, pure helper extracted from two one-shot canonical-DB scripts that
 * each had their own copy of this predicate:
 *   - backend/scripts/seed-breed-genetic-profile.mjs (Equoria-v08z, step-2 re-roll)
 *   - backend/scripts/recolor-starter-horses.mjs       (Equoria-wvdya, scoped recolor)
 *
 * Both scripts decide "is this row's colorGenotype the minted-before-color-system
 * default signature?" to scope their writes (CLAUDE.md Rule 2 — never recolor a
 * genotype a user/tester has already customized). The two copies were
 * behaviorally identical under the current GENERIC_DEFAULTS (17 loci, no Prl/BR1),
 * so the recolor copy's SIGNATURE_OPTIONAL_LOCI carve-out was a no-op in practice.
 * This shared helper KEEPS that carve-out because it is the strict superset: it
 * preserves the seed script's exact present-day behavior while correctly treating
 * a legacy row that is MISSING Prl_Pearl / BR1_Brindle1 as default (wild-type
 * 'n/n' = no expression) should those loci ever be added to GENERIC_DEFAULTS.
 */

import { GENERIC_DEFAULTS } from '../modules/horses/services/genotypeGenerationService.mjs';

/**
 * Loci added in Equoria-26qjf.1. Legacy starter rows predate them, so a MISSING
 * key for one of these counts as the default signature (the wild-type IS 'n/n' =
 * no expression). Only consulted when the locus is present in GENERIC_DEFAULTS
 * AND absent from the candidate genotype.
 */
export const SIGNATURE_OPTIONAL_LOCI = new Set(['Prl_Pearl', 'BR1_Brindle1']);

/**
 * Returns true iff `genotype` is the "minted-before-color-system" default
 * signature: every GENERIC_DEFAULTS locus equals its wild-type default pair,
 * with a missing Prl_Pearl / BR1_Brindle1 treated as default. A non-default
 * value at any GENERIC_DEFAULTS locus disqualifies (preserves real / customized
 * color). Keys NOT in GENERIC_DEFAULTS are not inspected — a stray Prl/BR1 key
 * is invisible until those loci join GENERIC_DEFAULTS (Equoria-26qjf.1); see the
 * Equoria-3x7j3 follow-up on whether to reject such stray keys in the meantime.
 *
 * Non-object input (null, undefined, primitives, arrays) returns false.
 *
 * @param {unknown} genotype - candidate colorGenotype (JSONB object) to test.
 * @returns {boolean}
 */
export function isDefaultSignature(genotype) {
  if (!genotype || typeof genotype !== 'object' || Array.isArray(genotype)) {
    return false;
  }
  for (const [locus, defaultPair] of Object.entries(GENERIC_DEFAULTS)) {
    const value = genotype[locus];
    if (value === undefined && SIGNATURE_OPTIONAL_LOCI.has(locus)) {
      continue;
    }
    if (value !== defaultPair) {
      return false;
    }
  }
  return true;
}
