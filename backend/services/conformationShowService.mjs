/**
 * Conformation Show Service
 *
 * Handles conformation-based competitions where grooms act as handlers.
 * This is a SEPARATE competition system from performance disciplines.
 *
 * Scoring formula (65/20/8/7 per PRD-03 §3.6):
 *   finalScore = (conformationScore * 0.65)
 *              + (handlerScore * 0.20)
 *              + (horse.bondScore * 0.08)
 *              + (synergyScore * 0.07)
 *   Clamped to integer [0, 100].
 *
 * Bond note: No GroomHorseBond model exists — horse.bondScore (Int 0-100) is used directly.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { CONFORMATION_CLASSES } from '../constants/schema.mjs';
import { calculateOverallConformation } from '../modules/horses/services/conformationService.mjs';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Scoring weights per spec (must sum to 1.00) */
export const CONFORMATION_SHOW_CONFIG = Object.freeze({
  CONFORMATION_WEIGHT: 0.65,
  HANDLER_WEIGHT: 0.2,
  BOND_WEIGHT: 0.08,
  TEMPERAMENT_WEIGHT: 0.07,

  /** Minimum days groom must be assigned before show */
  MIN_GROOM_ASSIGNMENT_DAYS: 2,

  /**
   * Minimum age for show entry (0 = Weanlings allowed).
   * Reject only age < 0 (negative age is invalid).
   */
  MIN_AGE: 0,
});

// ---------------------------------------------------------------------------
// showHandlingSkill → handler score (0-100) — AC5
// ---------------------------------------------------------------------------

/**
 * Maps Prisma enum `groom.showHandlingSkill` to a 0-100 numeric handler score.
 * Unknown values default to the novice score (20).
 */
export const SHOW_HANDLING_SKILL_SCORES = {
  novice: 20,
  competent: 40,
  skilled: 60,
  expert: 80,
  master: 100,
};

// ---------------------------------------------------------------------------
// Age classes — AC4
// ---------------------------------------------------------------------------

/**
 * Age class definitions for conformation shows.
 * SEPARATE from CONFORMATION_CLASSES (sex/category) in schema.mjs — do NOT merge.
 */
export const CONFORMATION_AGE_CLASSES = {
  WEANLING: 'Weanling',
  YEARLING: 'Yearling',
  YOUNGSTOCK: 'Youngstock',
  JUNIOR: 'Junior',
  SENIOR: 'Senior',
};

// ---------------------------------------------------------------------------
// Temperament synergy table (PRD-03 §3.6) — AC2
// Returns 0-100+ scale value; the finalScore formula clamps the aggregate to [0, 100].
// ---------------------------------------------------------------------------

// Synergy scores are on a [0, 100] scale (normalized from PRD-03 §3.6 0.80–1.15 multiplier range).
// Formula: Math.round((oldMultiplier * 100 - 80) / 35 * 100)
// neutral (0.80) → 0, nervous+beneficial (1.15) → 100
const SYNERGY_TABLE = {
  calm: {
    beneficial: ['gentle', 'patient', 'calm'],
    detrimental: ['energetic', 'strict'],
    beneficialScore: 86,
    detrimentalScore: 23,
  },
  spirited: {
    beneficial: ['energetic', 'confident', 'strict'],
    detrimental: ['gentle', 'patient'],
    beneficialScore: 91,
    detrimentalScore: 23,
  },
  nervous: {
    beneficial: ['gentle', 'patient', 'calm'],
    detrimental: ['energetic', 'strict', 'confident'],
    beneficialScore: 100,
    detrimentalScore: 14,
  },
  aggressive: {
    beneficial: ['strict', 'confident'],
    detrimental: ['gentle', 'patient'],
    beneficialScore: 80,
    detrimentalScore: 34,
  },
};

const NEUTRAL_SYNERGY_SCORE = 0;

// ---------------------------------------------------------------------------
// Pure scoring functions
// ---------------------------------------------------------------------------

/**
 * Check if a class name is a valid conformation show class (sex/category).
 * @param {string} className
 * @returns {boolean}
 */
export function isValidConformationClass(className) {
  return Object.values(CONFORMATION_CLASSES).includes(className);
}

/**
 * Calculate the conformation score component using arithmetic mean of all 8 regions.
 * Delegates to `calculateOverallConformation` from conformationService.mjs.
 * Returns 50 (neutral) when conformationScores is null or invalid.
 *
 * @param {Object|null} conformationScores - Horse's 8-region conformation scores
 * @returns {number} Integer arithmetic mean (0-100)
 */
export function calculateConformationScore(conformationScores) {
  try {
    if (!conformationScores || typeof conformationScores !== 'object') {
      logger.warn('[conformationShowService] Invalid conformation scores — returning neutral 50');
      return 50;
    }
    return calculateOverallConformation(conformationScores);
  } catch (error) {
    logger.error(
      `[conformationShowService] Error calculating conformation score: ${error.message}`,
    );
    return 50;
  }
}

/**
 * Map groom.showHandlingSkill enum to a 0-100 handler score — AC5.
 * @param {string|null|undefined} showHandlingSkill
 * @returns {number} Handler score (0-100); defaults to novice (20) for unknown values
 */
export function getHandlerScore(showHandlingSkill) {
  return SHOW_HANDLING_SKILL_SCORES[showHandlingSkill] ?? SHOW_HANDLING_SKILL_SCORES.novice;
}

/**
 * Assign an age class to a horse based on age in years — AC4.
 * @param {number} ageInYears
 * @returns {string} One of CONFORMATION_AGE_CLASSES values
 */
export function getConformationAgeClass(ageInYears) {
  if (!Number.isFinite(ageInYears) || ageInYears < 0) {
    return CONFORMATION_AGE_CLASSES.WEANLING;
  }
  if (ageInYears < 1) {
    return CONFORMATION_AGE_CLASSES.WEANLING;
  }
  if (ageInYears < 2) {
    return CONFORMATION_AGE_CLASSES.YEARLING;
  }
  if (ageInYears < 3) {
    return CONFORMATION_AGE_CLASSES.YOUNGSTOCK;
  }
  if (ageInYears < 6) {
    return CONFORMATION_AGE_CLASSES.JUNIOR;
  }
  return CONFORMATION_AGE_CLASSES.SENIOR;
}

/**
 * Calculate temperament synergy between horse and groom — AC2.
 * Returns a [0, 100] scale value (normalized from PRD-03 §3.6 0.80–1.15 range).
 *
 * @param {string} temperament - Horse temperament (calm|spirited|nervous|aggressive, case-insensitive)
 * @param {string} personality - Groom personality
 * @returns {number} Synergy score [0, 100]
 */
export function calculateSynergy(temperament, personality) {
  // Normalize temperament to lowercase — DB stores title-case ('Calm') but table uses lowercase
  const config = SYNERGY_TABLE[typeof temperament === 'string' ? temperament.toLowerCase() : ''];
  if (!config) {
    return NEUTRAL_SYNERGY_SCORE;
  }
  const p = typeof personality === 'string' ? personality : '';
  if (config.beneficial.includes(p)) {
    return config.beneficialScore;
  }
  if (config.detrimental.includes(p)) {
    return config.detrimentalScore;
  }
  return NEUTRAL_SYNERGY_SCORE;
}

/**
 * Calculate final conformation show score — AC1.
 *
 * Formula:
 *   finalScore = (conformationScore * 0.65)
 *              + (handlerScore * 0.20)
 *              + (horse.bondScore * 0.08)
 *              + (synergyScore * 0.07)
 *   Result is clamped to integer [0, 100]. No random factor.
 *
 * @param {Object} horse - Horse with conformationScores, bondScore, temperament
 * @param {Object} groom - Groom with showHandlingSkill, personality
 * @param {string} className - Conformation class name (validated against CONFORMATION_CLASSES)
 * @returns {Object} Scoring breakdown including finalScore
 */
export function calculateConformationShowScore(horse, groom, className) {
  try {
    if (!horse || !groom) {
      throw new Error('horse and groom are required');
    }
    if (!isValidConformationClass(className)) {
      throw new Error(`${className} is not a valid conformation show class`);
    }

    // 1. Conformation component (65%) — arithmetic mean of 8 regions
    const conformationScore = calculateConformationScore(horse.conformationScores);
    const conformationComponent = conformationScore * CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT;

    // 2. Handler component (20%) — showHandlingSkill mapped to 0-100
    const handlerScore = getHandlerScore(groom.showHandlingSkill);
    const handlerComponent = handlerScore * CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT;

    // 3. Bond component (8%) — horse.bondScore used directly (0-100), clamped to valid range
    const bondScore = Math.min(100, Math.max(0, horse.bondScore ?? 0));
    const bondComponent = bondScore * CONFORMATION_SHOW_CONFIG.BOND_WEIGHT;

    // 4. Temperament synergy component (7%)
    const temperament = horse.temperament ?? 'calm';
    const personality = groom.personality ?? 'gentle';
    const synergyScore = calculateSynergy(temperament, personality);
    const synergyComponent = synergyScore * CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT;

    // 5. Final score — integer clamped to [0, 100], no random factor
    const rawScore = conformationComponent + handlerComponent + bondComponent + synergyComponent;
    const finalScore = Math.round(Math.min(100, Math.max(0, rawScore)));

    logger.info(
      `[conformationShowService] Score: ${finalScore} for horse ${horse.name ?? horse.id} with handler ${groom.name ?? groom.id}`,
    );

    return {
      finalScore,
      breakdown: {
        conformationScore,
        conformationComponent: Math.round(conformationComponent * 10) / 10,
        handlerScore,
        handlerComponent: Math.round(handlerComponent * 10) / 10,
        bondScore,
        bondComponent: Math.round(bondComponent * 10) / 10,
        synergyScore,
        synergyComponent: Math.round(synergyComponent * 10) / 10,
      },
      weights: {
        conformation: CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT,
        handler: CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT,
        bond: CONFORMATION_SHOW_CONFIG.BOND_WEIGHT,
        temperament: CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT,
      },
    };
  } catch (error) {
    logger.error(`[conformationShowService] Error calculating show score: ${error.message}`);
    return {
      finalScore: 0,
      error: error.message,
      breakdown: {
        conformationScore: 0,
        conformationComponent: 0,
        handlerScore: 0,
        handlerComponent: 0,
        bondScore: 0,
        bondComponent: 0,
        synergyScore: 0,
        synergyComponent: 0,
      },
      weights: {
        conformation: CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT,
        handler: CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT,
        bond: CONFORMATION_SHOW_CONFIG.BOND_WEIGHT,
        temperament: CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Entry validation (async — requires DB)
// ---------------------------------------------------------------------------

/**
 * Validate conformation show entry requirements — AC3, AC4.
 *
 * Rejects if:
 *  - className is not a valid conformation sex/category class
 *  - horse is not owned by userId
 *  - groom is not owned by userId
 *  - groom is not actively assigned to the horse
 *  - groom assignment is younger than MIN_GROOM_ASSIGNMENT_DAYS
 *  - horse.age < 0 (negative age is invalid)
 *  - horse.health is not "Excellent" or "Good"
 *
 * Note: No training score or discipline prerequisite — conformation is innate (AC3).
 *
 * @param {Object} horse
 * @param {Object} groom
 * @param {string} className
 * @param {string} userId
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[], assignment: Object|null, ageClass: string|null}>}
 */
export async function validateConformationEntry(horse, groom, className, userId) {
  try {
    if (!horse || !groom) {
      return {
        valid: false,
        errors: ['Horse and groom are required'],
        warnings: [],
        assignment: null,
        ageClass: null,
      };
    }

    const errors = [];
    const warnings = [];

    // Validate class
    if (!isValidConformationClass(className)) {
      errors.push(`${className} is not a valid conformation show class`);
    }

    // Ownership
    if (horse.userId !== userId) {
      errors.push('You do not own this horse');
    }
    if (groom.userId !== userId) {
      errors.push('You do not own this groom');
    }

    // Groom assignment to horse — guard undefined IDs before querying
    let assignment = null;
    if (
      horse.id !== null &&
      horse.id !== undefined &&
      groom.id !== null &&
      groom.id !== undefined
    ) {
      assignment = await prisma.groomAssignment.findFirst({
        where: {
          groomId: groom.id,
          foalId: horse.id,
          userId,
          isActive: true,
        },
      });
    }

    if (!assignment) {
      errors.push('Groom must be assigned to this horse before entering conformation shows');
    } else {
      const createdAtTime = assignment.createdAt ? new Date(assignment.createdAt).getTime() : NaN;
      if (!Number.isFinite(createdAtTime)) {
        errors.push('Groom assignment record is missing a valid date');
      } else {
        const daysSinceAssignment = (Date.now() - createdAtTime) / (1000 * 60 * 60 * 24);
        if (daysSinceAssignment < CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS) {
          errors.push(
            `Groom must be assigned to horse for at least ${CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS} days before show entry`,
          );
        }
      }
    }

    // Age validation — reject only invalid (< 0); Weanlings (0-<1) are allowed — AC4
    const age = horse.age ?? 0;
    if (age < CONFORMATION_SHOW_CONFIG.MIN_AGE) {
      errors.push('Horse age is invalid (negative)');
    }

    // Assign age class for the entry
    const ageClass = age >= 0 ? getConformationAgeClass(age) : null;

    // Health — "Excellent" or "Good" map to healthy; all others rejected — AC3
    // Note: Prisma schema field is `healthStatus`; handle both for compatibility
    const healthValue = horse.healthStatus ?? horse.health;
    if (healthValue !== 'Excellent' && healthValue !== 'Good') {
      errors.push('Horse must be healthy (Excellent or Good health) to enter conformation shows');
    }

    // Stress advisory warning (does not block entry)
    if (horse.stressLevel && horse.stressLevel > 80) {
      warnings.push('Horse has high stress levels — may affect performance');
    }

    // Conformation scores advisory (show will use default 50 if missing)
    if (!horse.conformationScores) {
      warnings.push('Horse has no conformation scores — neutral score (50) will be used');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      assignment,
      ageClass,
    };
  } catch (error) {
    logger.error(`[conformationShowService] Error validating conformation entry: ${error.message}`);
    return {
      valid: false,
      errors: ['Validation error occurred'],
      warnings: [],
      assignment: null,
      ageClass: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Reward table and title thresholds (PRD-03 §3.6 / FR-40)
// ---------------------------------------------------------------------------

/**
 * Reward by placement.
 * Placement 1/2/3 = podium; 4+ = participation.
 */
export const REWARD_TABLE = Object.freeze({
  1: { ribbon: 'Blue', titlePoints: 10, breedingBoostDelta: 0.05 },
  2: { ribbon: 'Red', titlePoints: 7, breedingBoostDelta: 0.03 },
  3: { ribbon: 'Yellow', titlePoints: 5, breedingBoostDelta: 0.01 },
  default: { ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 },
});

/** Maximum breedingValueBoost a horse can accumulate (FR-41). */
export const BREEDING_BOOST_CAP = 0.15;

/**
 * Title thresholds — sorted descending so we find the highest reached.
 * @type {Array<{points: number, title: string}>}
 */
export const TITLE_THRESHOLDS = Object.freeze([
  { points: 200, title: 'Grand Champion' },
  { points: 100, title: 'Champion' },
  { points: 50, title: 'Distinguished' },
  { points: 25, title: 'Noteworthy' },
]);

// ---------------------------------------------------------------------------
// Pure reward helpers
// ---------------------------------------------------------------------------

/**
 * Return ribbon, titlePoints, and breedingBoostDelta for a given placement.
 * @param {number} placement - 1-indexed ranking (1 = first)
 * @returns {{ ribbon: string, titlePoints: number, breedingBoostDelta: number }}
 */
export function resolveReward(placement) {
  return REWARD_TABLE[placement] ?? REWARD_TABLE.default;
}

/**
 * Return the highest title string earned for accumulated points, or null.
 * Titles are permanent — once the threshold is passed the title is granted.
 *
 * @param {number} accumulatedPoints - Total title points after this show
 * @returns {string|null}
 */
export function resolveTitle(accumulatedPoints) {
  for (const { points, title } of TITLE_THRESHOLDS) {
    if (accumulatedPoints >= points) {
      return title;
    }
  }
  return null;
}

/**
 * Apply breeding value boost increment, capped at BREEDING_BOOST_CAP.
 *
 * @param {number} currentBoost - Horse's existing breedingValueBoost (0.0 – 0.15)
 * @param {number} delta - Boost amount to add (0.05 / 0.03 / 0.01 / 0)
 * @returns {number} New capped boost value
 */
export function applyBreedingValueBoost(currentBoost, delta) {
  if (delta <= 0) {
    return currentBoost;
  }
  return Math.min(BREEDING_BOOST_CAP, currentBoost + delta);
}

// ---------------------------------------------------------------------------
// executeConformationShow (AC1)
// ---------------------------------------------------------------------------

/**
 * Execute a conformation show: score all entries, rank, distribute rewards,
 * persist CompetitionResult per horse, update Horse title fields.
 *
 * Returns the full results array so the controller can build the HTTP response.
 *
 * @param {number} showId
 * @returns {Promise<Array<{horseId, placement, score, ribbon, titlePoints, newTitle, breedingValueBoost}>>}
 * @throws {Error} with .statusCode set to 400 for bad showId / wrong show type
 */
export async function executeConformationShow(showId) {
  // Load show
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) {
    const err = new Error('Show not found');
    err.statusCode = 400;
    throw err;
  }
  if (show.showType !== 'conformation') {
    const err = new Error('Show is not a conformation show');
    err.statusCode = 400;
    throw err;
  }

  // Load all entries with horse + active groom assignment + groom
  const entries = await prisma.showEntry.findMany({
    where: { showId },
    include: {
      horse: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (entries.length === 0) {
    return [];
  }

  // Score each entry
  const scored = await Promise.all(
    entries.map(async entry => {
      const horse = entry.horse;

      // Resolve active groom assignment for this horse
      const assignment = await prisma.groomAssignment.findFirst({
        where: { foalId: horse.id, isActive: true },
        include: { groom: true },
      });

      const groom = assignment?.groom ?? null;

      // Use a minimal placeholder groom when none is assigned
      const effectiveGroom = groom ?? {
        showHandlingSkill: 'novice',
        personality: 'gentle',
      };

      // Use first valid conformation class as placeholder (class doesn't affect score)
      const { finalScore } = calculateConformationShowScore(horse, effectiveGroom, 'Mares');

      return { entry, horse, finalScore };
    }),
  );

  // Rank by score descending, ties broken by entry creation order (already asc)
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Build results and persist via transaction
  const results = [];

  await prisma.$transaction(async tx => {
    for (let i = 0; i < scored.length; i++) {
      const { horse, finalScore } = scored[i];
      const placement = i + 1;
      const { ribbon, titlePoints: tpAwarded, breedingBoostDelta } = resolveReward(placement);

      // Accumulate title points
      const newTitlePoints = (horse.titlePoints ?? 0) + tpAwarded;
      const newTitle = resolveTitle(newTitlePoints);
      const newBoost = applyBreedingValueBoost(horse.breedingValueBoost ?? 0, breedingBoostDelta);

      // Update horse title fields
      await tx.horse.update({
        where: { id: horse.id },
        data: {
          titlePoints: newTitlePoints,
          currentTitle: newTitle,
          breedingValueBoost: newBoost,
        },
      });

      // Create CompetitionResult — no prizeWon (AC4)
      await tx.competitionResult.create({
        data: {
          horseId: horse.id,
          showId,
          score: finalScore,
          placement: String(placement),
          discipline: 'conformation',
          runDate: new Date(),
          showName: show.name ?? `Show #${showId}`,
          prizeWon: null,
          statGains: { ribbon, titlePoints: tpAwarded },
        },
      });

      results.push({
        horseId: horse.id,
        placement,
        score: finalScore,
        ribbon,
        titlePoints: tpAwarded,
        newTitle,
        breedingValueBoost: newBoost,
      });
    }
  });

  return results;
}
