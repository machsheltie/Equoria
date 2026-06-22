/**
 * Foal trait-evaluation cluster (Equoria-urqic.3 cronJobs split).
 *
 * This module holds the heavy job-logic for the nightly foal trait-evaluation
 * pass, extracted out of the CronJobService class so the orchestrator
 * (backend/services/cronJobs.mjs) stays a thin scheduler + heartbeat +
 * persistence + health surface.
 *
 * WHY FREE FUNCTIONS THAT TAKE A `service` HANDLE:
 * The pre-split cluster (evaluateDailyFoalTraits / evaluateFoalTraits /
 * advanceFoalDevelopmentDay / notifyTraitRevelation / logTraitRevelation /
 * logAuditSummary) was a `this`-coupled call graph — evaluateDailyFoalTraits
 * called this.evaluateFoalTraits which called this.advanceFoalDevelopmentDay /
 * this.notifyTraitRevelation / this.logTraitRevelation, and the audit path
 * called this.logAuditSummary. Existing real-DB integration tests
 * (foalDevelopmentDayAdvance, foalTraitRevealHistoryLog,
 * foalTraitRevealNotification, cronJobs.test) call several of these directly on
 * the singleton (cronJobService.evaluateFoalTraits(...),
 * cronJobService.logTraitRevelation(...), cronJobService.notifyTraitRevelation(...)),
 * so those entrypoints MUST remain instance methods on the class.
 *
 * The split preserves that contract: the class keeps thin delegator methods
 * that forward into these free functions, passing `this` as the `service`
 * handle. Each free function re-enters the cluster through `service.<method>`
 * (NOT a sibling free-function call) so a test that stubs/spies one delegator
 * method on the singleton still observes the call — the `this`-coupled call
 * graph the tests depend on is intact.
 *
 * CAUTION (CLAUDE.md / GENERAL_RULES): no inline horse-age math here. This
 * cluster keys off FoalDevelopment.currentDay (an explicit development-day
 * counter), not date arithmetic, so there is no age math to route through
 * backend/utils/horseAge.mjs.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { evaluateTraitRevelation } from '../../../utils/traitEvaluation.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';
import { logTraitAssignment } from '../../../modules/traits/index.mjs';

const FINAL_DEVELOPMENT_DAY = 6;

/**
 * Main daily trait evaluation function.
 * Iterates through all foals aged 0-1 and evaluates traits for revelation.
 *
 * @param {Object} service - the CronJobService instance (for `this`-coupled
 *   re-entry into evaluateFoalTraits / logAuditSummary so test spies on the
 *   singleton still fire).
 * @returns {Promise<void>}
 */
export async function evaluateDailyFoalTraits(service) {
  const startTime = Date.now();
  logger.info('[CronJobService.evaluateDailyFoalTraits] Starting daily foal trait evaluation');

  try {
    // Get all foals aged 0-1 years (foals in development period)
    const foals = await prisma.horse.findMany({
      where: {
        age: {
          in: [0, 1], // 0 = newborn, 1 = yearling
        },
      },
      include: {
        foalDevelopment: true,
      },
    });

    if (foals.length === 0) {
      logger.info('[CronJobService.evaluateDailyFoalTraits] No foals found for evaluation');
      return;
    }

    logger.info(
      `[CronJobService.evaluateDailyFoalTraits] Found ${foals.length} foals for evaluation`,
    );

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    // Process each foal
    for (const foal of foals) {
      try {
        const result = await service.evaluateFoalTraits(foal);
        processedCount++;

        if (result.traitsRevealed > 0) {
          updatedCount++;
        }
      } catch (error) {
        errorCount++;
        logger.error(
          `[CronJobService.evaluateDailyFoalTraits] Error processing foal ${foal.id}: ${error.message}`,
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[CronJobService.evaluateDailyFoalTraits] Completed evaluation in ${duration}ms`);
    logger.info(
      `[CronJobService.evaluateDailyFoalTraits] Summary: ${processedCount} processed, ${updatedCount} updated, ${errorCount} errors`,
    );

    // Log audit summary
    await service.logAuditSummary({
      timestamp: new Date(),
      foalsProcessed: processedCount,
      foalsUpdated: updatedCount,
      errors: errorCount,
      duration,
    });
  } catch (error) {
    logger.error(`[CronJobService.evaluateDailyFoalTraits] Critical error: ${error.message}`);
    throw error;
  }
}

/**
 * Evaluate traits for a single foal.
 *
 * @param {Object} service - the CronJobService instance (re-enters
 *   advanceFoalDevelopmentDay / logTraitRevelation / notifyTraitRevelation on
 *   `this` so test spies fire).
 * @param {Object} foal - Foal data with development information.
 * @returns {Promise<Object>} - Evaluation result.
 */
export async function evaluateFoalTraits(service, foal) {
  try {
    logger.info(`[CronJobService.evaluateFoalTraits] Evaluating foal ${foal.id} (${foal.name})`);

    // Get current development day
    const currentDay = foal.foalDevelopment?.currentDay || 0;

    // Skip foals that have completed development (day > 6)
    if (currentDay > FINAL_DEVELOPMENT_DAY) {
      logger.info(
        `[CronJobService.evaluateFoalTraits] Foal ${foal.id} has completed development (day ${currentDay})`,
      );
      return { traitsRevealed: 0, reason: 'development_complete' };
    }

    // Get current epigenetic modifiers
    const currentTraits = foal.epigeneticModifiers || {
      positive: [],
      negative: [],
      hidden: [],
    };

    // Evaluate new traits
    const newTraits = evaluateTraitRevelation(foal, currentTraits, currentDay);

    // Check if any new traits were revealed
    const totalNewTraits =
      newTraits.positive.length + newTraits.negative.length + newTraits.hidden.length;

    if (totalNewTraits === 0) {
      logger.info(`[CronJobService.evaluateFoalTraits] No new traits revealed for foal ${foal.id}`);
      // Equoria-3lb8q: still advance development day so the foal reaches the
      // next minAge gate on the next nightly run, even on a no-reveal night.
      const advancedDay = await service.advanceFoalDevelopmentDay(foal.id, currentDay);
      return { traitsRevealed: 0, reason: 'no_new_traits', currentDay: advancedDay };
    }

    // Merge new traits with existing traits
    const updatedTraits = {
      positive: [...(currentTraits.positive || []), ...newTraits.positive],
      negative: [...(currentTraits.negative || []), ...newTraits.negative],
      hidden: [...(currentTraits.hidden || []), ...newTraits.hidden],
    };

    // Update the horse record
    await prisma.horse.update({
      where: { id: foal.id },
      data: {
        epigeneticModifiers: updatedTraits,
      },
    });

    // Log the action for auditing
    await service.logTraitRevelation(foal.id, foal.name, newTraits, currentDay, foal);

    // Equoria-yy1a5: notify the foal's owner when one or more VISIBLE traits
    // were revealed by the nightly job. Hidden traits remain a discovery and
    // intentionally do NOT notify. Owner is foal.userId (the canonical owner
    // field — Horse has no ownerId). Fire-and-forget at the service level:
    // createNotification already swallows its own errors, but guard anyway so
    // a notification failure never aborts the trait persistence.
    await service.notifyTraitRevelation(foal, newTraits, currentDay);

    logger.info(
      `[CronJobService.evaluateFoalTraits] Updated foal ${foal.id} with ${totalNewTraits} new traits`,
    );

    // Equoria-3lb8q: advance development day AFTER persisting this day's
    // reveals, so the foal reaches the next minAge gate on the next run.
    const advancedDay = await service.advanceFoalDevelopmentDay(foal.id, currentDay);

    return {
      traitsRevealed: totalNewTraits,
      newTraits,
      updatedTraits,
      currentDay: advancedDay,
    };
  } catch (error) {
    logger.error(
      `[CronJobService.evaluateFoalTraits] Error evaluating foal ${foal.id}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Equoria-3lb8q: Advance a foal's development day by one (capped at 6) AFTER
 * the current night's trait evaluation has run for the existing day. See the
 * original method doc in cronJobs.mjs history for the full rationale (DECISION
 * (b) automatic advance; advance-at-END so each night reaches the next gate;
 * upsert because some foals predate the FoalDevelopment row).
 *
 * @param {number} foalId
 * @param {number} currentDay - the day that was just evaluated
 * @returns {Promise<number>} the new currentDay
 */
export async function advanceFoalDevelopmentDay(foalId, currentDay) {
  if (currentDay >= FINAL_DEVELOPMENT_DAY) {
    return currentDay;
  }
  const nextDay = currentDay + 1;
  await prisma.foalDevelopment.upsert({
    where: { foalId },
    update: { currentDay: nextDay },
    create: { foalId, currentDay: nextDay },
  });
  logger.info(
    `[CronJobService.advanceFoalDevelopmentDay] Foal ${foalId} development day ${currentDay} -> ${nextDay}`,
  );
  return nextDay;
}

/**
 * Equoria-yy1a5: Fire a player-facing notification when the nightly job
 * reveals one or more VISIBLE traits for a foal. Only positive + negative
 * traits notify — hidden traits remain an undiscovered surprise by design. If
 * the foal has no owner (userId null) we skip. Best-effort: guarded so a
 * notification failure never aborts the surrounding trait-persistence flow.
 *
 * @param {Object} foal - foal record (needs id, name, userId)
 * @param {Object} newTraits - { positive: [], negative: [], hidden: [] }
 * @param {number} currentDay - development day the reveal happened on
 */
export async function notifyTraitRevelation(foal, newTraits, currentDay) {
  try {
    const ownerUserId = foal.userId;
    if (!ownerUserId) {
      return;
    }
    const visibleTraits = [...(newTraits.positive || []), ...(newTraits.negative || [])];
    if (visibleTraits.length === 0) {
      // Only hidden traits revealed — intentionally no notification.
      return;
    }
    await createNotification(ownerUserId, 'trait_discovery', {
      foalId: foal.id,
      foalName: foal.name,
      traits: visibleTraits,
      developmentDay: currentDay,
    });
    logger.info(
      `[CronJobService.notifyTraitRevelation] Notified owner ${ownerUserId} of ${visibleTraits.length} revealed trait(s) for foal ${foal.id}`,
    );
  } catch (error) {
    logger.error(
      `[CronJobService.notifyTraitRevelation] Error notifying owner for foal ${foal?.id}: ${error.message}`,
    );
  }
}

/**
 * Log trait revelation for auditing purposes.
 *
 * Equoria-bfo1t: emits a Winston line AND persists each revealed trait
 * (positive + negative + hidden) to the queryable TraitHistoryLog model via
 * traitHistoryService.logTraitAssignment, with sourceType 'daily_evaluation'.
 * Persistence is best-effort per-trait — a single failed insert is logged and
 * does not abort the others or the surrounding flow.
 *
 * @param {number} foalId - Foal ID
 * @param {string} foalName - Foal name
 * @param {Object} newTraits - New traits revealed
 * @param {number} currentDay - Current development day
 * @param {Object} [foal] - Full foal record (for bondScore / stressLevel)
 */
export async function logTraitRevelation(foalId, foalName, newTraits, currentDay, foal = null) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      foalId,
      foalName,
      developmentDay: currentDay,
      traitsRevealed: {
        positive: newTraits.positive,
        negative: newTraits.negative,
        hidden: newTraits.hidden,
      },
      totalCount: newTraits.positive.length + newTraits.negative.length + newTraits.hidden.length,
    };

    // Log to application logs
    logger.info(`[CronJobService.AUDIT] Trait revelation: ${JSON.stringify(logEntry)}`);

    // Equoria-bfo1t: persist each revealed trait to the queryable
    // TraitHistoryLog model. All revelation categories are recorded so the
    // history is complete for analytics (Equoria-yznve).
    const allRevealed = [
      ...(newTraits.positive || []),
      ...(newTraits.negative || []),
      ...(newTraits.hidden || []),
    ];
    const bondScore = foal?.bondScore ?? null;
    const stressLevel = foal?.stressLevel ?? null;
    for (const traitName of allRevealed) {
      try {
        await logTraitAssignment({
          horseId: foalId,
          traitName,
          sourceType: 'daily_evaluation',
          isEpigenetic: true,
          bondScore,
          stressLevel,
        });
      } catch (persistError) {
        logger.error(
          `[CronJobService.logTraitRevelation] Failed to persist trait '${traitName}' for foal ${foalId} to TraitHistoryLog: ${persistError.message}`,
        );
      }
    }
  } catch (error) {
    logger.error(
      `[CronJobService.logTraitRevelation] Error logging trait revelation: ${error.message}`,
    );
  }
}

/**
 * Log daily audit summary.
 * @param {Object} summary - Summary data
 */
export async function logAuditSummary(summary) {
  try {
    const auditSummary = {
      type: 'DAILY_TRAIT_EVALUATION_SUMMARY',
      timestamp: summary.timestamp.toISOString(),
      statistics: {
        foalsProcessed: summary.foalsProcessed,
        foalsUpdated: summary.foalsUpdated,
        errors: summary.errors,
        duration: summary.duration,
      },
    };

    logger.info(`[CronJobService.AUDIT] Daily summary: ${JSON.stringify(auditSummary)}`);
  } catch (error) {
    logger.error(`[CronJobService.logAuditSummary] Error logging audit summary: ${error.message}`);
  }
}
