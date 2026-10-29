/**
 * markingGenerationService.mjs
 *
 * Pure-function service for generating and inheriting horse coat markings.
 * Handles face markings, leg markings, advanced markings, and boolean modifiers.
 *
 * All probabilities are driven by the breed's breedGeneticProfile JSONB:
 *   - markingBias.face                      — face marking weights
 *   - markingBias.legsGeneralProbability  — per-leg chance of any marking
 *   - markingBias.legSpecificProbabilities — type weights when a leg is marked
 *   - markingBias.maxLegsMarked           — cap on number of marked legs
 *   - advancedMarkingsBias                 — multipliers for rare advanced markings
 *   - booleanModifiersPrevalence           — per-modifier probability overrides
 *
 * Used by: horseRoutes.mjs (POST /horses)
 * Story: 31E-3 — Marking System
 *
 * Owner ruling 2026-10-28 (q252, Equoria-tcata): snowflake and frost spotting
 * appear only on horses that carry the appaloosa gene (LP at the
 * LP_LeopardComplex locus). Callers pass the horse's colour genotype; with no
 * genotype a horse cannot be shown to carry LP, so neither marking appears.
 * The rolls are still drawn, so a seeded generator yields the same later
 * values (sex, other markings) as before.
 */

// ---------------------------------------------------------------------------
// Exported constants (defaults used when breed profile is absent)
// ---------------------------------------------------------------------------

/** Default face marking weights when no breed profile is available. */
export const FACE_MARKING_DEFAULTS = {
  none: 0.6,
  star: 0.15,
  strip: 0.12,
  blaze: 0.08,
  snip: 0.05,
};

/** Default leg marking configuration when no breed profile is available. */
export const LEG_MARKING_DEFAULTS = {
  legsGeneralProbability: 0.25,
  legSpecificProbabilities: { coronet: 0.4, pastern: 0.3, sock: 0.2, stocking: 0.1 },
  maxLegsMarked: 4,
};

/** Base probabilities for advanced markings (before breed multiplier). */
export const ADVANCED_MARKING_BASE_RATES = {
  bloody_shoulder: 0.02,
  snowflake: 0.03,
  frost: 0.03,
};

/** Default boolean modifier probabilities when no breed profile is available. */
export const MODIFIER_DEFAULTS = {
  sooty: 0.3,
  flaxen: 0.1,
  pangare: 0.1,
  rabicano: 0.05,
};

/**
 * Whether a colour genotype carries the appaloosa gene (LP, one or two copies).
 *
 * @param {Object|null} colorGenotype - e.g. { LP_LeopardComplex: 'LP/lp', ... }
 * @returns {boolean}
 */
export function carriesAppaloosaGene(colorGenotype) {
  if (!colorGenotype || typeof colorGenotype !== 'object' || Array.isArray(colorGenotype)) {
    return false;
  }
  const lp = colorGenotype.LP_LeopardComplex;
  return typeof lp === 'string' && lp.split('/').includes('LP');
}

// Ordered leg names used for both generation and inheritance.
const LEG_NAMES = ['frontLeft', 'frontRight', 'hindLeft', 'hindRight'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Select a key from a probability weight map using the provided RNG.
 * The weight map is `{ key: probability }` where probabilities should sum to 1.
 * Returns null if the map is null/empty/invalid.
 *
 * @param {Object|null} weightMap
 * @param {Function} rng - random number generator (0 ≤ rng() < 1)
 * @returns {string|null}
 */
export function sampleWeightedFromMap(weightMap, rng) {
  if (!weightMap || typeof weightMap !== 'object') {
    return null;
  }
  const entries = Object.entries(weightMap);
  if (entries.length === 0) {
    return null;
  }

  // Normalize weights so sub-1.0 maps distribute correctly (D-2).
  // Negative weights are clamped to 0 before summing (D-1 defence-in-depth).
  const total = entries.reduce((sum, [, prob]) => sum + Math.max(0, prob), 0);
  if (total <= 0) {
    return entries[0][0];
  }

  const roll = rng() * total;
  let cumulative = 0;

  for (const [key, prob] of entries) {
    cumulative += Math.max(0, prob);
    if (roll < cumulative) {
      // P-3: strict < (not <=) to avoid first-key boundary bias
      return key;
    }
  }
  // Floating-point safety: return last key if nothing matched
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Face marking
// ---------------------------------------------------------------------------

/**
 * Generate a face marking for a horse.
 *
 * @param {Object|null} markingBias - breedGeneticProfile.markingBias
 * @param {Function} rng
 * @returns {string} face marking: 'none'|'star'|'strip'|'blaze'|'snip'
 */
export function generateFaceMarking(markingBias, rng) {
  const faceWeights = markingBias?.face ?? FACE_MARKING_DEFAULTS;
  return sampleWeightedFromMap(faceWeights, rng) ?? 'none';
}

// ---------------------------------------------------------------------------
// Leg markings
// ---------------------------------------------------------------------------

/**
 * The breed's cap on marked legs (markingBias.maxLegsMarked, default 4).
 *
 * @param {Object|null} markingBias
 * @returns {number}
 */
function maxMarkedLegs(markingBias) {
  return markingBias?.maxLegsMarked ?? LEG_MARKING_DEFAULTS.maxLegsMarked;
}

/**
 * Generate independent leg markings for all 4 legs.
 * Each leg first rolls against `legsGeneralProbability`.
 * If a leg is marked, the type is drawn from `legSpecificProbabilities`.
 * The total number of marked legs is capped at `maxLegsMarked`.
 *
 * @param {Object|null} markingBias - breedGeneticProfile.markingBias
 * @param {Function} rng
 * @returns {{ frontLeft: string, frontRight: string, hindLeft: string, hindRight: string }}
 */
export function generateLegMarkings(markingBias, rng) {
  const generalProb =
    markingBias?.legsGeneralProbability ?? LEG_MARKING_DEFAULTS.legsGeneralProbability;
  const typeWeights =
    markingBias?.legSpecificProbabilities ?? LEG_MARKING_DEFAULTS.legSpecificProbabilities;
  const maxLegs = maxMarkedLegs(markingBias);

  const result = {};
  let markedCount = 0;

  for (const leg of LEG_NAMES) {
    if (markedCount >= maxLegs) {
      result[leg] = 'none';
      continue;
    }

    if (rng() < generalProb) {
      const type = sampleWeightedFromMap(typeWeights, rng) ?? 'coronet';
      result[leg] = type;
      markedCount++;
    } else {
      result[leg] = 'none';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Advanced markings
// ---------------------------------------------------------------------------

/**
 * Generate rare advanced markings (bloody shoulder, snowflake, frost).
 * Effective probability = base rate × breed multiplier. Snowflake and frost
 * need the appaloosa gene (q252).
 *
 * @param {Object|null} advancedMarkingsBias - breedGeneticProfile.advancedMarkingsBias
 * @param {Function} rng
 * @param {boolean} [hasAppaloosaGene=false] - the horse carries LP
 * @returns {{ bloodyShoulderPresent: boolean, snowflakePresent: boolean, frostPresent: boolean }}
 */
export function generateAdvancedMarkings(advancedMarkingsBias, rng, hasAppaloosaGene = false) {
  const bsMultiplier = advancedMarkingsBias?.bloodyShoulderProbabilityMultiplier ?? 1.0;
  const swMultiplier = advancedMarkingsBias?.snowflakeProbabilityMultiplier ?? 1.0;
  const frMultiplier = advancedMarkingsBias?.frostProbabilityMultiplier ?? 1.0;

  // D-1: Math.max(0, ...) clamps negative multipliers to 0 probability
  const bsProb = Math.min(
    1,
    Math.max(0, ADVANCED_MARKING_BASE_RATES.bloody_shoulder * bsMultiplier),
  );
  const swProb = Math.min(1, Math.max(0, ADVANCED_MARKING_BASE_RATES.snowflake * swMultiplier));
  const frProb = Math.min(1, Math.max(0, ADVANCED_MARKING_BASE_RATES.frost * frMultiplier));

  // Every roll is drawn whatever the gene, so later seeded rolls do not shift.
  const bloodyShoulderPresent = rng() < bsProb;
  const snowflakeRolled = rng() < swProb;
  const frostRolled = rng() < frProb;
  return {
    bloodyShoulderPresent,
    snowflakePresent: hasAppaloosaGene && snowflakeRolled,
    frostPresent: hasAppaloosaGene && frostRolled,
  };
}

// ---------------------------------------------------------------------------
// Boolean modifiers
// ---------------------------------------------------------------------------

/**
 * Determine whether a color name represents a true chestnut (eligible for flaxen).
 * Gold/Amber/Classic Champagne variants, Palomino, and other diluted chestnuts
 * are excluded — flaxen only applies to base chestnut.
 * Equoria-7woyj: the owner's chestnut names (Red Chestnut, Liver Chestnut...) are
 * base chestnut; Chestnut Pearl (formerly Apricot) and the new snowdrop/sunshine
 * chestnuts stay excluded, so flaxen keeps its old reach (q314 defers modifiers).
 *
 * @param {string} colorName
 * @returns {boolean}
 */
function isBaseChestnut(colorName) {
  if (!colorName || typeof colorName !== 'string') {
    return false;
  }
  const lower = colorName.toLowerCase();
  return (
    lower.includes('chestnut') &&
    !['champagne', 'pearl', 'snowdrop', 'sunshine'].some(word => lower.includes(word))
  );
}

/**
 * Generate boolean modifier flags: sooty, flaxen (chestnuts only), pangare, rabicano.
 *
 * @param {Object|null} modifierPrevalence - breedGeneticProfile.booleanModifiersPrevalence
 * @param {string|null} colorName - calculated phenotype color name
 * @param {Function} rng
 * @returns {{ isSooty: boolean, isFlaxen: boolean, hasPangare: boolean, isRabicano: boolean }}
 */
export function generateBooleanModifiers(modifierPrevalence, colorName, rng) {
  const sooty = modifierPrevalence?.sooty ?? MODIFIER_DEFAULTS.sooty;
  const flaxen = modifierPrevalence?.flaxen ?? MODIFIER_DEFAULTS.flaxen;
  const pangare = modifierPrevalence?.pangare ?? MODIFIER_DEFAULTS.pangare;
  const rabicano = modifierPrevalence?.rabicano ?? MODIFIER_DEFAULTS.rabicano;

  return {
    isSooty: rng() < sooty,
    isFlaxen: isBaseChestnut(colorName) && rng() < flaxen,
    hasPangare: rng() < pangare,
    isRabicano: rng() < rabicano,
  };
}

// ---------------------------------------------------------------------------
// Full marking generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete set of markings for a horse.
 *
 * @param {Object|null} breedGeneticProfile - full breed profile JSONB
 * @param {string|null} colorName - calculated phenotype color name (for flaxen guard)
 * @param {Function} [rng=Math.random]
 * @param {Object|null} [colorGenotype=null] - the horse's colour genotype (LP gate, q252)
 * @returns {{ faceMarking, legMarkings, advancedMarkings, modifiers }}
 */
export function generateMarkings(
  breedGeneticProfile = null,
  colorName = null,
  rng = Math.random,
  colorGenotype = null,
) {
  const markingBias = breedGeneticProfile?.markingBias ?? null;
  const advancedBias = breedGeneticProfile?.advancedMarkingsBias ?? null;
  const modifierPrevalence = breedGeneticProfile?.booleanModifiersPrevalence ?? null;

  return {
    faceMarking: generateFaceMarking(markingBias, rng),
    legMarkings: generateLegMarkings(markingBias, rng),
    advancedMarkings: generateAdvancedMarkings(
      advancedBias,
      rng,
      carriesAppaloosaGene(colorGenotype),
    ),
    modifiers: generateBooleanModifiers(modifierPrevalence, colorName, rng),
  };
}

// ---------------------------------------------------------------------------
// Breeding inheritance of markings
// ---------------------------------------------------------------------------

/**
 * Inherit markings for a foal based on sire and dam markings.
 * For each marking slot independently:
 *   - 40% chance: inherit from sire
 *   - 40% chance: inherit from dam
 *   - 20% chance: random reroll from breed bias
 *
 * If a parent's markings are null/missing, that parent's slot is replaced
 * by a random reroll (effectively increasing the reroll share to 60% or 100%).
 *
 * @param {Object|null} sireMarkings - sire's phenotype marking fields
 * @param {Object|null} damMarkings - dam's phenotype marking fields
 * @param {Object|null} breedGeneticProfile
 * @param {string|null} colorName
 * @param {Function} [rng=Math.random]
 * @param {Object|null} [colorGenotype=null] - the foal's colour genotype (LP gate, q252)
 * @returns {{ faceMarking, legMarkings, advancedMarkings, modifiers }}
 */
export function inheritMarkings(
  sireMarkings = null,
  damMarkings = null,
  breedGeneticProfile = null,
  colorName = null,
  rng = Math.random,
  colorGenotype = null,
) {
  // If both parents have no markings, fall back to fresh random generation
  if (!sireMarkings && !damMarkings) {
    return generateMarkings(breedGeneticProfile, colorName, rng, colorGenotype);
  }
  const hasAppaloosaGene = carriesAppaloosaGene(colorGenotype);

  const markingBias = breedGeneticProfile?.markingBias ?? null;
  const advancedBias = breedGeneticProfile?.advancedMarkingsBias ?? null;
  const modifierPrevalence = breedGeneticProfile?.booleanModifiersPrevalence ?? null;

  /**
   * Pick between sire value, dam value, or a fresh random value.
   * Normalises the 40/40/20 split based on which parents are available.
   *
   * @param {*} sireVal
   * @param {*} damVal
   * @param {Function} randomFn - zero-arg function that returns a fresh random value
   * @returns {*}
   */
  function pickInherited(sireVal, damVal, randomFn) {
    const hasSire = sireVal !== undefined && sireVal !== null;
    const hasDam = damVal !== undefined && damVal !== null;

    if (!hasSire && !hasDam) {
      return randomFn();
    }

    const roll = rng();
    if (!hasSire) {
      // Only dam available: 80% dam, 20% random
      return roll < 0.8 ? damVal : randomFn();
    }
    if (!hasDam) {
      // Only sire available: 80% sire, 20% random
      return roll < 0.8 ? sireVal : randomFn();
    }
    // Both available: 40% sire, 40% dam, 20% random
    if (roll < 0.4) {
      return sireVal;
    }
    if (roll < 0.8) {
      return damVal;
    }
    return randomFn();
  }

  // Face marking
  const faceMarking = pickInherited(sireMarkings?.faceMarking, damMarkings?.faceMarking, () =>
    generateFaceMarking(markingBias, rng),
  );

  // Leg markings — inherit or reroll each leg independently
  const legMarkings = {};
  for (const leg of LEG_NAMES) {
    legMarkings[leg] = pickInherited(
      sireMarkings?.legMarkings?.[leg],
      damMarkings?.legMarkings?.[leg],
      () => {
        // Single-leg random: roll general probability once
        const generalProb =
          markingBias?.legsGeneralProbability ?? LEG_MARKING_DEFAULTS.legsGeneralProbability;
        const typeWeights =
          markingBias?.legSpecificProbabilities ?? LEG_MARKING_DEFAULTS.legSpecificProbabilities;
        if (rng() < generalProb) {
          return sampleWeightedFromMap(typeWeights, rng) ?? 'coronet';
        }
        return 'none';
      },
    );
  }

  // Equoria-2r7xv: the breed's cap on marked legs holds for inherited foals too.
  // Legs are inherited one by one, so parents marked on different legs could
  // give a cap-1 breed a foal with two or more; keep the first marked legs in
  // leg order (as generateLegMarkings does) and clear the rest. Applied after
  // the loop so every roll is still drawn and later seeded values do not shift.
  const maxLegs = maxMarkedLegs(markingBias);
  let markedLegs = 0;
  // legMarkings was filled in leg order above.
  for (const leg of Object.keys(legMarkings)) {
    if (
      legMarkings[leg] === 'none' ||
      legMarkings[leg] === null ||
      legMarkings[leg] === undefined
    ) {
      continue;
    }
    if (markedLegs >= maxLegs) {
      legMarkings[leg] = 'none';
    } else {
      markedLegs++;
    }
  }

  // P-2: Pre-compute per-flag probabilities so each reroll uses exactly 1 rng() draw
  // (calling generateAdvancedMarkings() would consume 3 draws but discard 2)
  const bsMult = advancedBias?.bloodyShoulderProbabilityMultiplier ?? 1.0;
  const swMult = advancedBias?.snowflakeProbabilityMultiplier ?? 1.0;
  const frMult = advancedBias?.frostProbabilityMultiplier ?? 1.0;
  const bsProb = Math.min(1, Math.max(0, ADVANCED_MARKING_BASE_RATES.bloody_shoulder * bsMult));
  const swProb = Math.min(1, Math.max(0, ADVANCED_MARKING_BASE_RATES.snowflake * swMult));
  const frProb = Math.min(1, Math.max(0, ADVANCED_MARKING_BASE_RATES.frost * frMult));

  // Advanced markings — inherit or reroll each flag independently
  const advancedMarkings = {
    bloodyShoulderPresent: pickInherited(
      sireMarkings?.advancedMarkings?.bloodyShoulderPresent,
      damMarkings?.advancedMarkings?.bloodyShoulderPresent,
      () => rng() < bsProb,
    ),
    // q252: a foal without the appaloosa gene never shows snowflake or frost,
    // whatever its parents show (the inheritance roll is still drawn).
    snowflakePresent:
      pickInherited(
        sireMarkings?.advancedMarkings?.snowflakePresent,
        damMarkings?.advancedMarkings?.snowflakePresent,
        () => rng() < swProb,
      ) === true && hasAppaloosaGene,
    frostPresent:
      pickInherited(
        sireMarkings?.advancedMarkings?.frostPresent,
        damMarkings?.advancedMarkings?.frostPresent,
        () => rng() < frProb,
      ) === true && hasAppaloosaGene,
  };

  // Boolean modifiers — inherit or reroll each independently
  const modifiers = {
    isSooty: pickInherited(
      sireMarkings?.modifiers?.isSooty,
      damMarkings?.modifiers?.isSooty,
      () => rng() < (modifierPrevalence?.sooty ?? MODIFIER_DEFAULTS.sooty),
    ),
    // P-1: Apply chestnut guard to inherited value too — a non-chestnut foal must
    // never carry isFlaxen=true even if a chestnut parent had it.
    isFlaxen: isBaseChestnut(colorName)
      ? pickInherited(
          sireMarkings?.modifiers?.isFlaxen,
          damMarkings?.modifiers?.isFlaxen,
          () => rng() < (modifierPrevalence?.flaxen ?? MODIFIER_DEFAULTS.flaxen),
        )
      : false,
    hasPangare: pickInherited(
      sireMarkings?.modifiers?.hasPangare,
      damMarkings?.modifiers?.hasPangare,
      () => rng() < (modifierPrevalence?.pangare ?? MODIFIER_DEFAULTS.pangare),
    ),
    isRabicano: pickInherited(
      sireMarkings?.modifiers?.isRabicano,
      damMarkings?.modifiers?.isRabicano,
      () => rng() < (modifierPrevalence?.rabicano ?? MODIFIER_DEFAULTS.rabicano),
    ),
  };

  return { faceMarking, legMarkings, advancedMarkings, modifiers };
}
