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
 * counter). Its one age question — how many whole days has this foal lived? —
 * goes through backend/utils/horseAge.mjs#getHorseAgeDays (Equoria-3i34b).
 *
 * NO PREMATURE AGING (Equoria-3i34b, owner ruling 2026-10-06): a development
 * day is evaluated and advanced only once it has fully elapsed, so currentDay
 * never exceeds the foal's age in whole Eastern calendar days. The pass is reachable
 * on demand (admin POST /api/admin/traits/evaluate → manualTraitEvaluation) and
 * the cron can fire twice; both are now no-ops for a foal whose day is not due.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { evaluateTraitRevelation } from '../../../utils/traitEvaluation.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';
import { appendEpigeneticTraits, logTraitAssignment } from '../../../modules/traits/index.mjs';

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

  // Get all foals aged 0-1 years (foals in development period)
  const foals = await prisma.horse.findMany({
    where: {
      age: {
        in: [0, 1], // game-years 0 and 1
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

  // Process each foal. The per-foal try/catch swallows-and-continues so one
  // bad foal does not abort the whole nightly pass — this inner catch STAYS.
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
  logger.info(`[CronJobService.evaluateFoalTraits] Evaluating foal ${foal.id} (${foal.name})`);

  // Get current development day
  const currentDay = foal.foalDevelopment?.currentDay || 0;

  // Skip foals that have completed development: day 6 already evaluated
  // (Equoria-mwjst: finalDayEvaluatedAt), or a day past the last one.
  if (foal.foalDevelopment?.finalDayEvaluatedAt || currentDay > FINAL_DEVELOPMENT_DAY) {
    logger.info(
      `[CronJobService.evaluateFoalTraits] Foal ${foal.id} has completed development (day ${currentDay})`,
    );
    return { traitsRevealed: 0, reason: 'development_complete' };
  }

  // Equoria-3i34b: no premature aging. Day N is evaluated (its reveals rolled)
  // and then advanced only once the foal has lived more than N whole Eastern game days.
  // A second run the same day — the admin trigger, a repeated cron fire — finds
  // currentDay already equal to the elapsed days and does nothing.
  const elapsedDays = getHorseAgeDays(foal.dateOfBirth);
  if (currentDay >= elapsedDays) {
    return { traitsRevealed: 0, reason: 'day_not_elapsed', currentDay };
  }

  // Equoria-mwjst: claim the day, roll it, and record the reveals in ONE
  // transaction. The claim comes first and is a compare-and-swap on the day the
  // caller saw, so of two concurrent passes exactly one rolls; the loser waits
  // on the row lock, matches nothing and returns. The roll reads the foal's
  // traits inside the transaction, never the caller's snapshot. Any failure
  // rolls back the claim with the reveals and their history rows, so the day
  // stays due and nothing is half-recorded.
  const outcome = await prisma.$transaction(async tx => {
    const claimed = await claimDevelopmentDay(tx, foal.id, currentDay);
    if (!claimed) {
      return null;
    }

    const fresh = await tx.horse.findUnique({ where: { id: foal.id } });
    const currentTraits = normalizeTraits(fresh.epigeneticModifiers);
    const newTraits = evaluateTraitRevelation(fresh, currentTraits, currentDay);
    const totalNewTraits =
      newTraits.positive.length + newTraits.negative.length + newTraits.hidden.length;
    if (totalNewTraits === 0) {
      return { fresh, newTraits, totalNewTraits, updatedTraits: currentTraits };
    }

    // Equoria-m1sf8: append in one statement against the row's current value,
    // never write back the object read above. Another writer of this column
    // (the age-1 milestone's tags) may commit between that read and this write.
    const stored = await appendEpigeneticTraits(tx, foal.id, newTraits);
    const updatedTraits = normalizeTraits(stored);
    await service.logTraitRevelation(foal.id, foal.name, newTraits, currentDay, fresh, tx);
    return { fresh, newTraits, totalNewTraits, updatedTraits };
  });

  if (!outcome) {
    logger.info(
      `[CronJobService.evaluateFoalTraits] Foal ${foal.id} day ${currentDay} was already evaluated by another run`,
    );
    return { traitsRevealed: 0, reason: 'already_evaluated', currentDay };
  }

  const nextDay = Math.min(currentDay + 1, FINAL_DEVELOPMENT_DAY);
  if (outcome.totalNewTraits === 0) {
    logger.info(`[CronJobService.evaluateFoalTraits] No new traits revealed for foal ${foal.id}`);
    return { traitsRevealed: 0, reason: 'no_new_traits', currentDay: nextDay };
  }

  // Equoria-yy1a5: notify the foal's owner when one or more VISIBLE traits
  // were revealed. Hidden traits remain a discovery and do NOT notify. Only
  // after commit (Equoria-mwjst), so a rolled-back reveal never notifies.
  await service.notifyTraitRevelation(outcome.fresh, outcome.newTraits, currentDay);

  logger.info(
    `[CronJobService.evaluateFoalTraits] Updated foal ${foal.id} with ${outcome.totalNewTraits} new traits`,
  );

  return {
    traitsRevealed: outcome.totalNewTraits,
    newTraits: outcome.newTraits,
    updatedTraits: outcome.updatedTraits,
    currentDay: nextDay,
  };
}

/** The foal's epigenetic modifiers as three arrays, whatever the stored Json holds. */
function normalizeTraits(raw) {
  const value = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    positive: Array.isArray(value.positive) ? value.positive : [],
    negative: Array.isArray(value.negative) ? value.negative : [],
    hidden: Array.isArray(value.hidden) ? value.hidden : [],
  };
}

/**
 * Claim development day `day` for evaluation inside `tx` (Equoria-mwjst).
 * Days 0-5 claim by stepping currentDay forward from `day`; day 6 claims by
 * setting finalDayEvaluatedAt while the day stays 6. Either is a
 * compare-and-swap, so it matches only for the first pass. A foal that
 * predates its FoalDevelopment row (Equoria-3lb8q) gets one first; ON CONFLICT
 * DO NOTHING keeps a concurrent creator from aborting this transaction.
 *
 * @returns {Promise<boolean>} true when this pass owns the day
 */
async function claimDevelopmentDay(tx, foalId, day) {
  await tx.foalDevelopment.createMany({
    data: [{ foalId, currentDay: day }],
    skipDuplicates: true,
  });
  const claim =
    day >= FINAL_DEVELOPMENT_DAY
      ? await tx.foalDevelopment.updateMany({
          where: { foalId, currentDay: day, finalDayEvaluatedAt: null },
          data: { finalDayEvaluatedAt: new Date() },
        })
      : await tx.foalDevelopment.updateMany({
          where: { foalId, currentDay: day, finalDayEvaluatedAt: null },
          data: { currentDay: day + 1 },
        });
  if (claim.count === 1) {
    logger.info(
      `[CronJobService.evaluateFoalTraits] Foal ${foalId} claimed development day ${day}`,
    );
  }
  return claim.count === 1;
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

  // Equoria-3i34b: whoever calls this, the day never runs ahead of the foal's
  // age in whole Eastern calendar days.
  const foal = await prisma.horse.findUnique({
    where: { id: foalId },
    select: { dateOfBirth: true },
  });
  if (!foal || nextDay > getHorseAgeDays(foal.dateOfBirth)) {
    logger.info(
      `[CronJobService.advanceFoalDevelopmentDay] Foal ${foalId} stays on day ${currentDay}: day ${nextDay} has not been reached yet`,
    );
    return currentDay;
  }

  // Compare-and-swap from the day the caller evaluated, so two concurrent
  // passes cannot both step the same foal forward.
  const { count } = await prisma.foalDevelopment.updateMany({
    where: { foalId, currentDay },
    data: { currentDay: nextDay },
  });
  if (count === 0) {
    const existing = await prisma.foalDevelopment.findUnique({
      where: { foalId },
      select: { currentDay: true },
    });
    if (existing) {
      // Another pass already moved this foal on; report where it actually is.
      return existing.currentDay;
    }
    // Some foals predate their FoalDevelopment row (Equoria-3lb8q).
    try {
      await prisma.foalDevelopment.create({ data: { foalId, currentDay: nextDay } });
    } catch (error) {
      if (error?.code !== 'P2002') {
        throw error;
      }
      const raced = await prisma.foalDevelopment.findUnique({
        where: { foalId },
        select: { currentDay: true },
      });
      return raced.currentDay;
    }
  }
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
    await createNotification(ownerUserId, 'traitDiscovery', {
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
 * @param {Object} [foal] - Full foal record (for bondScore)
 * @param {Object} [tx] - The caller's transaction (Equoria-mwjst). With one,
 *   the history rows commit with the reveal and any failure propagates so the
 *   whole reveal rolls back; nothing is swallowed inside a transaction.
 */
export async function logTraitRevelation(
  foalId,
  foalName,
  newTraits,
  currentDay,
  foal = null,
  tx = null,
) {
  if (tx) {
    for (const traitName of [
      ...(newTraits.positive || []),
      ...(newTraits.negative || []),
      ...(newTraits.hidden || []),
    ]) {
      await logTraitAssignment(
        {
          horseId: foalId,
          traitName,
          sourceType: 'daily_evaluation',
          isEpigenetic: true,
          bondScore: foal?.bondScore ?? null,
        },
        tx,
      );
    }
    logger.info(
      `[CronJobService.AUDIT] Trait revelation: foal ${foalId} (${foalName}) day ${currentDay}`,
    );
    return;
  }
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
    for (const traitName of allRevealed) {
      try {
        await logTraitAssignment({
          horseId: foalId,
          traitName,
          sourceType: 'daily_evaluation',
          isEpigenetic: true,
          bondScore,
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
