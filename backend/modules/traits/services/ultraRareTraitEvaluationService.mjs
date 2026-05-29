/**
 * Ultra-Rare Trait Evaluation Service
 *
 * Thin wrapper around the ultra-rare trigger engine that also persists
 * UltraRareTraitEvent rows. Lets non-route callers (cron jobs, milestone
 * hooks, competition hooks) trigger ultra-rare evaluation without
 * duplicating the event-write logic that previously lived only in
 * ultraRareTraitRoutes.mjs.
 *
 * Equoria-d4tl: extracted so milestone evaluation can auto-trigger
 * ultra-rare checks at organic developmental boundaries instead of
 * requiring an explicit POST /api/v1/ultra-rare-traits/evaluate/:horseId.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  evaluateUltraRareTriggers,
  evaluateExoticUnlocks,
} from '../../../utils/ultraRareTriggerEngine.mjs';

/**
 * Evaluate ultra-rare + exotic triggers for a horse and persist
 * UltraRareTraitEvent rows for every triggered trait.
 *
 * @param {number} horseId
 * @param {Object} evaluationContext - { source: 'milestone' | 'competition' | 'cron' | 'manual', ...other context }
 * @returns {Promise<{ ultraRareResults: Array, exoticResults: Array, eventsCreated: number }>}
 */
export async function evaluateAndPersistUltraRareTraits(horseId, evaluationContext = {}) {
  const source = evaluationContext.source || 'unknown';
  let ultraRareResults = [];
  let exoticResults = [];

  try {
    ultraRareResults = await evaluateUltraRareTriggers(horseId, evaluationContext);
  } catch (error) {
    logger.error(
      `[ultraRareTraitEvaluationService] evaluateUltraRareTriggers failed for horse ${horseId} (source=${source}): ${error.message}`,
    );
  }

  try {
    exoticResults = await evaluateExoticUnlocks(horseId, evaluationContext);
  } catch (error) {
    logger.error(
      `[ultraRareTraitEvaluationService] evaluateExoticUnlocks failed for horse ${horseId} (source=${source}): ${error.message}`,
    );
  }

  const allResults = [...ultraRareResults, ...exoticResults];
  let eventsCreated = 0;

  for (const result of allResults) {
    try {
      await prisma.ultraRareTraitEvent.create({
        data: {
          horseId,
          traitName: result.name,
          traitTier: result.tier,
          eventType: 'evaluation_triggered',
          baseChance: result.baseChance || null,
          finalChance: result.baseChance || null,
          triggerConditions: evaluationContext,
          success: true,
          notes: `Trait ${result.tier} evaluation completed (source=${source})`,
        },
      });
      eventsCreated++;
    } catch (error) {
      logger.error(
        `[ultraRareTraitEvaluationService] Failed to persist UltraRareTraitEvent for horse ${horseId} trait ${result.name}: ${error.message}`,
      );
    }
  }

  if (allResults.length > 0) {
    logger.info(
      `[ultraRareTraitEvaluationService] Horse ${horseId} (source=${source}): ${ultraRareResults.length} ultra-rare, ${exoticResults.length} exotic, ${eventsCreated} events persisted.`,
    );
  }

  return { ultraRareResults, exoticResults, eventsCreated };
}

export default { evaluateAndPersistUltraRareTraits };
