import { calculateCompetitionScoreDetailed } from '../../../utils/competitionScore.mjs';
import { disciplineAffinityKey, normalizeTraitKey } from '../../../utils/epigeneticTraitKeyMap.mjs';
import { resolveTackBonus } from '../../economy/index.mjs';
import { asFlagArray, asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Helper function to detect trait bonuses for a horse in a specific discipline
 * @param {Object} horse - Horse object with epigeneticModifiers
 * @param {string} discipline - Competition discipline
 * @returns {Object} Trait bonus information
 */
function detectTraitBonuses(horse, discipline) {
  const result = {
    hasTraitBonus: false,
    traitBonusAmount: 0,
    appliedTraits: [],
    bonusDescription: '',
  };

  // Check for discipline affinity traits.
  // Equoria-liy7c: full four-part JSONB guard. `epigeneticModifiers` can be
  // null / a primitive / an array on legacy or bare-created rows, and even when
  // it is an object the `positive` sub-value may not be an array. asFlagObject +
  // asFlagArray make the `.includes()` read safe unconditionally.
  const positiveTraits = asFlagArray(asFlagObject(horse.epigeneticModifiers).positive).map(
    normalizeTraitKey,
  );
  if (positiveTraits.length > 0) {
    // Canonical camelCase affinity key (§C/§F); stored traits normalized above
    // so legacy snake-case rows still match until the DB backfill runs.
    const affinityTrait = disciplineAffinityKey(discipline);

    if (positiveTraits.includes(affinityTrait)) {
      result.hasTraitBonus = true;
      result.traitBonusAmount = 5;
      result.appliedTraits.push(affinityTrait);
      result.bonusDescription = `+5 trait match bonus applied (${affinityTrait})`;
    }
  }

  return result;
}

/**
 * Enhanced competition scoring using the new calculateCompetitionScore function
 * @param {Array} horses - Array of horse objects
 * @param {Object} show - Show object with discipline
 * @returns {Array} Sorted array of results with detailed scoring information
 */
function runEnhancedCompetition(horses, show) {
  logger.info(
    `[runEnhancedCompetition] Starting enhanced competition for ${horses.length} horses in ${show.discipline}`,
  );

  // Calculate scores for each horse using the new scoring system
  const results = horses.map(horse => {
    try {
      // Use the detailed calculator so we can surface temperamentImpact on the
      // response (Equoria-hv1y, prerequisite for Equoria-pkga frontend display).
      // Equoria-qszs: pass show.showType so conformation shows correctly use the
      // conformation temperament modifier instead of silently defaulting to ridden.
      const { finalScore, temperamentImpact } = calculateCompetitionScoreDetailed(
        horse,
        show.discipline,
        show.showType,
      );

      // Detect trait bonuses for transparency
      const traitInfo = detectTraitBonuses(horse, show.discipline);

      // Create detailed result object
      const result = {
        horseId: horse.id,
        name: horse.name,
        score: finalScore,
        placement: null, // Will be assigned after sorting
        discipline: show.discipline,

        // Equoria-hv1y — surface temperament impact so the frontend can render
        // "Bold temperament: +5% ridden score" attribution chips on results.
        // null when horse has no temperament (legacy rows).
        temperamentImpact,

        // Enhanced scoring details for transparency
        scoringDetails: {
          finalScore,
          traitBonus: traitInfo.traitBonusAmount,
          hasTraitAdvantage: traitInfo.hasTraitBonus,
          appliedTraits: traitInfo.appliedTraits,
          bonusDescription: traitInfo.bonusDescription,

          // Base stats used in calculation.
          // Equoria-182zv: bare `||` falls back when stat is legitimately 0,
          // silently boosting an intentional zero. `??` falls back only on
          // null/undefined, preserving genuine stat-0 values. See Equoria-xngqe
          // (parent doctrine) for the 10 canonical horse stat columns.
          baseStats: {
            speed: horse.speed ?? 0,
            stamina: horse.stamina ?? 0,
            focus: horse.focus ?? 0,
            precision: horse.precision ?? 0,
            agility: horse.agility ?? 0,
            boldness: horse.boldness ?? 0,
            balance: horse.balance ?? 0,
          },

          // Additional factors
          stressLevel: horse.stressLevel || 0,
          health: horse.health || 'Good',
          tackBonuses: (() => {
            const resolved = resolveTackBonus(horse.tack);
            return { saddle: resolved.saddleBonus, bridle: resolved.bridleBonus };
          })(),
        },
      };

      logger.info(
        `[runEnhancedCompetition] Horse ${horse.name}: Score ${finalScore}${traitInfo.bonusDescription ? `, ${traitInfo.bonusDescription}` : ''}`,
      );

      return result;
    } catch (error) {
      logger.error(
        `[runEnhancedCompetition] Error calculating score for horse ${horse.id}: ${error.message}`,
      );
      return {
        horseId: horse.id,
        name: horse.name || 'Unknown',
        score: null,
        placement: null,
        discipline: show.discipline,
        scoringDetails: {
          finalScore: null,
          error: error.message,
        },
      };
    }
  });

  // Sort by score (highest first); error-sentinel (null) horses rank last
  results.sort((a, b) => {
    if (a.score === null && b.score === null) {
      return 0;
    }
    if (a.score === null) {
      return 1;
    }
    if (b.score === null) {
      return -1;
    }
    return b.score - a.score;
  });

  // Assign placements to top 3 (only horses with valid scores)
  const placements = ['1st', '2nd', '3rd'];
  results.forEach((result, index) => {
    if (index < 3 && result.score !== null) {
      result.placement = placements[index];
    }
  });

  logger.info(
    `[runEnhancedCompetition] Competition completed. Winner: ${results[0]?.name} with score ${results[0]?.score}`,
  );

  return results;
}

// Equoria-709qm: the legacy instant-competition controller `enterAndRunShow`
// was retired here. Its HTTP routes (POST /enter-show, POST /execute) were
// already hard-deprecated to 410 Gone under Equoria-kacla, and its award logic
// (horse XP / owner XP / stat gain) was extracted to competitionAwards.mjs under
// Equoria-oey96.4. The only sanctioned executor is now the overnight
// `executeClosedShows` cron path in showController.mjs. `runEnhancedCompetition`
// remains the shared, pre-DB scoring pipeline and is exported for integration
// testing of the show.showType → temperament-modifier flow (Equoria-u0mz).
export { runEnhancedCompetition };
