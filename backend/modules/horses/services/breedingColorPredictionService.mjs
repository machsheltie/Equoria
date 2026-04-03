// Breeding Color Prediction Service (Story 31E-5)
// Pure-function service that calculates Mendelian probability charts for offspring coat colors.
// No DB calls — all data passed in from controller layer.
//
// Performance strategy (AC7):
//   1. Normalize allele pairs (sort alphabetically) — E/e and e/E collapse to one entry
//   2. Skip fixed loci (both parents homozygous same) — only 1 outcome, no branching
//   3. Safety cap at MAX_GENOTYPE_ENTRIES to prevent OOM on pathological inputs

import {
  splitAlleles,
  isLethalCombination,
  LETHAL_COMBINATIONS,
} from './breedingColorInheritanceService.mjs';
import { calculatePhenotype } from './phenotypeCalculationService.mjs';
import { CORE_LOCI, GENERIC_DEFAULTS } from './genotypeGenerationService.mjs';

// Safety cap — if Cartesian product exceeds this, stop expanding and aggregate what we have.
// With normalization + fixed-locus skipping, real-world crosses stay well under this.
const MAX_GENOTYPE_ENTRIES = 50000;

/**
 * Normalize an allele pair by sorting the two alleles alphabetically.
 * This ensures E/e and e/E are treated as the same outcome.
 *
 * @param {string} allele1 - first allele (e.g. 'E')
 * @param {string} allele2 - second allele (e.g. 'e')
 * @returns {string} - normalized pair (e.g. 'E/e' since 'E' < 'e')
 */
function normalizeAllelePair(allele1, allele2) {
  return allele1 <= allele2 ? `${allele1}/${allele2}` : `${allele2}/${allele1}`;
}

/**
 * Generate all possible offspring allele pairs for a single locus
 * from the sire and dam allele pairs, with Mendelian probabilities.
 *
 * Each parent contributes one allele with 50/50 probability.
 * The 2×2 Punnett square produces up to 4 cells, but allele pairs are
 * normalized (sorted) so E/e and e/E collapse — max 3 distinct outcomes.
 *
 * @param {string} sireAllelePair - e.g. 'E/e'
 * @param {string} damAllelePair - e.g. 'E/e'
 * @returns {Array<{pair: string, prob: number}>} - e.g. [{pair:'E/E', prob:0.25}, {pair:'E/e', prob:0.5}, {pair:'e/e', prob:0.25}]
 */
export function generateLocusProbabilities(sireAllelePair, damAllelePair) {
  const sireAlleles = splitAlleles(sireAllelePair);
  const damAlleles = splitAlleles(damAllelePair);

  // 2×2 Punnett square — each cell has probability 0.25
  // Normalize allele pairs so E/e = e/E (phenotypically identical)
  const combos = new Map();
  for (const sAllele of sireAlleles) {
    for (const dAllele of damAlleles) {
      const pair = normalizeAllelePair(sAllele, dAllele);
      combos.set(pair, (combos.get(pair) || 0) + 0.25);
    }
  }

  return Array.from(combos.entries()).map(([pair, prob]) => ({ pair, prob }));
}

/**
 * Generate probability distributions for all loci, then compute the
 * Cartesian product to enumerate all possible offspring genotypes with probabilities.
 *
 * Optimizations (AC7):
 *   - Fixed loci (single outcome) are set directly on all genotypes without branching
 *   - Only variable loci (2+ outcomes) participate in the Cartesian product
 *   - Safety cap prevents OOM on pathological inputs
 *
 * @param {object} sireGenotype - full colorGenotype object
 * @param {object} damGenotype - full colorGenotype object
 * @returns {Array<{genotype: object, prob: number}>} - all possible genotype combos with probabilities
 */
export function generateAllGenotypeProbabilities(sireGenotype, damGenotype) {
  // Collect all loci from both parents + CORE_LOCI
  const allLoci = new Set([
    ...CORE_LOCI,
    ...Object.keys(sireGenotype),
    ...Object.keys(damGenotype),
  ]);

  // Separate fixed loci (1 outcome) from variable loci (2+ outcomes)
  const fixedLoci = {};
  const variableLoci = [];

  for (const locus of allLoci) {
    const sirePair = sireGenotype[locus] || GENERIC_DEFAULTS[locus] || 'n/n';
    const damPair = damGenotype[locus] || GENERIC_DEFAULTS[locus] || 'n/n';
    const dist = generateLocusProbabilities(sirePair, damPair);

    if (dist.length === 1) {
      // Fixed locus — only one possible outcome, no branching needed
      fixedLoci[locus] = dist[0].pair;
    } else {
      variableLoci.push({ locus, dist });
    }
  }

  // Cartesian product of ONLY variable loci (fixed loci are appended after)
  // Start with a single "empty genotype" at probability 1.0
  let results = [{ genotype: {}, prob: 1.0 }];
  let capped = false;

  for (const { locus, dist } of variableLoci) {
    const newResults = [];
    for (const existing of results) {
      for (const { pair, prob } of dist) {
        newResults.push({
          genotype: { ...existing.genotype, [locus]: pair },
          prob: existing.prob * prob,
        });
      }
    }
    results = newResults;

    // Safety cap — prevent OOM on pathological inputs
    if (results.length > MAX_GENOTYPE_ENTRIES) {
      capped = true;
      break;
    }
  }

  // Append fixed loci to all genotypes (no branching cost)
  for (const entry of results) {
    Object.assign(entry.genotype, fixedLoci);
  }

  // Tag the result so callers know if it was capped
  if (capped) {
    results._capped = true;
  }

  return results;
}

/**
 * Remove lethal genotype combinations and renormalize remaining probabilities.
 *
 * @param {Array<{genotype: object, prob: number}>} genotypeProbabilities
 * @returns {{filtered: Array<{genotype: object, prob: number}>, lethalCount: number}}
 */
export function filterLethalGenotypes(genotypeProbabilities) {
  const lethalLoci = Object.keys(LETHAL_COMBINATIONS);
  let lethalCount = 0;

  const filtered = genotypeProbabilities.filter(({ genotype }) => {
    for (const locus of lethalLoci) {
      if (genotype[locus] && isLethalCombination(locus, genotype[locus])) {
        lethalCount++;
        return false;
      }
    }
    return true;
  });

  // Renormalize probabilities to sum to 1.0
  const totalProb = filtered.reduce((sum, { prob }) => sum + prob, 0);
  if (totalProb > 0 && totalProb < 1.0) {
    for (const entry of filtered) {
      entry.prob = entry.prob / totalProb;
    }
  }

  return { filtered, lethalCount };
}

/**
 * Apply foal breed restrictions to each genotype.
 * If a locus has a restricted allele pair, replace with the breed's default (allowed[0]).
 * After replacement, allele pairs are re-normalized (sorted) so breed restriction
 * replacements don't create un-normalized duplicates.
 *
 * @param {Array<{genotype: object, prob: number}>} genotypeProbabilities
 * @param {object|null} foalBreedProfile - breedGeneticProfile with allowed_alleles
 * @returns {Array<{genotype: object, prob: number}>} - modified in place
 */
export function applyBreedRestrictions(genotypeProbabilities, foalBreedProfile) {
  if (!foalBreedProfile || !foalBreedProfile.allowed_alleles) {
    return genotypeProbabilities;
  }

  const { allowed_alleles: allowedAlleles } = foalBreedProfile;

  for (const entry of genotypeProbabilities) {
    for (const [locus, allowedList] of Object.entries(allowedAlleles)) {
      if (entry.genotype[locus] && !allowedList.includes(entry.genotype[locus])) {
        // Replace with breed default (first in allowed list)
        const replacement = allowedList[0];
        // Guard: do not replace with a lethal pair
        if (!isLethalCombination(locus, replacement)) {
          entry.genotype[locus] = replacement;
        }
      }
    }
  }

  return genotypeProbabilities;
}

/**
 * Run each genotype through calculatePhenotype(), group by colorName,
 * sum probabilities, and return sorted array.
 *
 * @param {Array<{genotype: object, prob: number}>} genotypeProbabilities
 * @param {object|null} shadeBias - from breedGeneticProfile.shade_bias
 * @returns {Array<{colorName: string, probability: number, percentage: string}>}
 */
export function aggregateByPhenotype(genotypeProbabilities, shadeBias) {
  const colorMap = new Map();

  for (const { genotype, prob } of genotypeProbabilities) {
    const phenotype = calculatePhenotype(genotype, shadeBias);
    const colorName = phenotype.colorName;
    colorMap.set(colorName, (colorMap.get(colorName) || 0) + prob);
  }

  // Convert to sorted array (highest probability first)
  const results = Array.from(colorMap.entries())
    .map(([colorName, probability]) => ({
      colorName,
      probability: Math.round(probability * 10000) / 10000, // 4 decimal precision
      percentage: `${(probability * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.probability - a.probability);

  return results;
}

/**
 * Full pipeline — generate probabilities, filter lethals, apply breed restrictions,
 * aggregate by phenotype. Returns the complete prediction result.
 *
 * @param {object} sireGenotype - full colorGenotype object
 * @param {object} damGenotype - full colorGenotype object
 * @param {object|null} foalBreedProfile - breedGeneticProfile or null
 * @returns {{possibleColors: Array, totalCombinations: number, lethalCombinationsFiltered: number}}
 */
export function predictBreedingColors(sireGenotype, damGenotype, foalBreedProfile) {
  // Step 1: Generate all possible genotype combinations with probabilities
  const allGenotypes = generateAllGenotypeProbabilities(sireGenotype, damGenotype);
  const totalCombinations = allGenotypes.length;

  // Step 2: Filter lethal combinations
  const { filtered, lethalCount } = filterLethalGenotypes(allGenotypes);

  // Step 3: Apply breed restrictions
  const restricted = applyBreedRestrictions(filtered, foalBreedProfile);

  // Step 4: Aggregate by phenotype color name
  const shadeBias = foalBreedProfile?.shade_bias ?? null;
  const possibleColors = aggregateByPhenotype(restricted, shadeBias);

  return {
    possibleColors,
    totalCombinations,
    lethalCombinationsFiltered: lethalCount,
  };
}
