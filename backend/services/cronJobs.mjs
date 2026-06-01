import cron from 'node-cron';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';
import { evaluateTraitRevelation } from '../utils/traitEvaluation.mjs';
import {
  processHorseBirthdays,
  processFoalMilestoneEvaluations,
} from '../utils/horseAgingSystem.mjs';
import { incrementWeeklyCareerWeeks } from '../modules/trainers/index.mjs';
import { purgeExpiredAuditLogs } from '../modules/admin/index.mjs';
import { decayHoofConditions } from '../modules/horses/index.mjs';
import { batchEvaluateFlags, getEligibleHorses } from '../utils/flagEvaluationEngine.mjs';
import { sweepExpiredTemporaryFlags, logTraitAssignment } from '../modules/traits/index.mjs';
import { executeClosedShows } from '../modules/competition/index.mjs';
import { createNotification } from '../utils/notificationService.mjs';
import { Sentry } from '../config/sentry.mjs';
import { withAdvisoryLock } from '../utils/cronLock.mjs';
// Equoria-fx4e7: per-job descriptors (schedule + lock policy + staleness budget
// + run thunk) live in backend/services/jobs/. start() iterates this registry
// instead of carrying ten inline cron.schedule(...) blocks, and JOB_STALENESS_MS
// is derived from it instead of being a hand-maintained parallel literal.
import { CRON_JOB_REGISTRY } from './jobs/index.mjs';

/**
 * Equoria-s20o: Realm-safe ISO-string serializer for timestamp values.
 *
 * `value instanceof Date` is fragile across JS module realms: the Prisma
 * client and this module can resolve `@prisma/client` through different
 * `node_modules` trees (e.g. a git-worktree junction), so a Date produced
 * by Prisma may fail `instanceof Date` against this realm's `Date` even
 * though it IS a Date. `Object.prototype.toString` tag-checking is
 * realm-independent and is the correct cross-realm guard.
 *
 * Historical note (Equoria-4wl0r): the prior dual import paths
 * `backend/db/index.mjs` (a re-export shim) and
 * `packages/database/prismaClient.mjs` (the canonical singleton) were a
 * second cross-realm vector that this workaround had to guard. All
 * backend imports now go through the canonical path and the shim is
 * removed; the realm-safe serializer is retained for the underlying
 * worktree-junction case that motivated Equoria-s20o.
 *
 * Returns an ISO 8601 string for any Date-like value (any realm), the
 * value unchanged if it is null/undefined, and otherwise re-wraps via
 * `new Date(value)` so string/number timestamps are normalized too.
 *
 * @param {*} value
 * @returns {string|null|*}
 */
function toIsoStringSafe(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const ms = value.getTime();
    return Number.isNaN(ms) ? value : value.toISOString();
  }
  // String/number timestamp → normalize to ISO; leave non-coercible as-is.
  const wrapped = new Date(value);
  return Number.isNaN(wrapped.getTime()) ? value : wrapped.toISOString();
}

/**
 * Daily trait evaluation cron job that runs at midnight
 * Evaluates all foals aged 0-6 days for trait revelation
 */
/**
 * Equoria-0elk: Stale-after thresholds (ms) per job, used by the heartbeat
 * health endpoint. If `now - lastFinishedAt > stalenessMs`, the job is
 * flagged STALE in /api/admin/cron/health responses.
 *
 * Choose values 1.25x the expected period:
 *   - daily jobs: 30h (24h period + 6h tolerance)
 *   - 15-minute jobs: 30min (15min period + 15min tolerance)
 *   - weekly jobs: 192h (168h period + 24h tolerance)
 *
 * The in-memory heartbeat map is reset on process restart — it answers
 * "is the cron firing in THIS instance?", not "is the cron firing in
 * production-as-a-whole?". A persistent CronRunLog table (filed as a
 * follow-up issue) gives cross-restart history. The in-memory layer is
 * enough to detect the original Equoria-0elk failure mode (cron never
 * scheduled at startup → heartbeat permanently null → STALE).
 */
/**
 * Equoria-304a: Threshold for firing a stale-heartbeat operational alert.
 * Daily jobs run every 24h with a 6h tolerance window (JOB_STALENESS_MS = 30h),
 * but we want a noisier alert at 25h since by then a daily job is provably
 * skipped (24h + 1h grace). Alert debounces — only one Sentry event per
 * stale-streak, not one per /health poll.
 */
export const STALE_ALERT_THRESHOLD_MS = 25 * 60 * 60 * 1000;

// Equoria-fx4e7: derived from the per-job registry (each descriptor carries its
// own staleAfterMs) instead of a hand-maintained parallel literal. The shape —
// { jobName: staleAfterMs } — and every value are byte-identical to the
// previous inline object; the registry is the single source of truth now so a
// new job cannot ship a schedule without also declaring its staleness budget.
const JOB_STALENESS_MS = Object.freeze(
  Object.fromEntries(CRON_JOB_REGISTRY.map(job => [job.jobName, job.staleAfterMs])),
);

class CronJobService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    // Equoria-0elk: per-job heartbeat — last-run timestamps + status + summary
    this.heartbeats = new Map();
    // Equoria-304a: debounce state for stale-heartbeat alerting. Stores
    // jobName -> lastAlertedAt timestamp so we only fire ONE Sentry event per
    // stale streak (not one per /health poll). Cleared on the per-job heartbeat
    // success path so a recovered + re-staling job alerts again.
    this.staleAlertState = new Map();
  }

  /**
   * Equoria-0elk: Record a job heartbeat. Called by each scheduled handler
   * (success or error path) so /api/admin/cron/health can surface STALE jobs.
   *
   * @param {string} jobName - Canonical job key (matches this.jobs key).
   * @param {Object} entry   - { startedAt, finishedAt, status, summary?, error? }
   */
  recordHeartbeat(jobName, entry) {
    const existing = this.heartbeats.get(jobName) ?? {};
    this.heartbeats.set(jobName, {
      ...existing,
      ...entry,
      // Always keep the first-seen startedAt for the current cycle's entry
      startedAt: entry.startedAt ?? existing.startedAt ?? null,
      finishedAt: entry.finishedAt ?? null,
      status: entry.status ?? existing.status ?? 'unknown',
    });
    // Equoria-304a: a successful run clears the stale alert debounce so a
    // subsequent stale streak fires a fresh alert (not silently suppressed).
    if (entry.status === 'success') {
      this.staleAlertState.delete(jobName);
    }
  }

  /**
   * Equoria-0elk: Wrap a scheduled-job handler to record heartbeat (success +
   * error). The wrapped function returns the handler's result so caller
   * semantics are preserved.
   *
   * Equoria-9wby: Also persists each run to the CronRunLog table so
   * /api/admin/cron/health can surface cross-restart history. The DB write
   * is best-effort — if persistence fails, the cron itself MUST NOT fail
   * (observability layer must not break the system it observes). DB errors
   * are logged at warn level and swallowed.
   *
   * Equoria-iot0h: When `opts.applyLock === true`, the handler is wrapped
   * in a Postgres advisory lock (`pg_try_advisory_xact_lock`) so only ONE
   * replica runs the side-effect when multiple replicas fire the same
   * schedule. The loser-of-the-race records `status: 'skipped-locked'`
   * instead of `'success'` (recording success would lie — the side-effect
   * did NOT happen on this replica). Production schedules pass
   * `applyLock: true`; tests can opt out.
   *
   * @param {string} jobName     - Job key for this.heartbeats
   * @param {Function} handler   - async () => Promise<result>
   * @param {Object}  [opts]
   * @param {boolean} [opts.applyLock=false] - wrap in pg_try_advisory_xact_lock
   */
  async runWithHeartbeat(jobName, handler, opts = {}) {
    const startedAt = new Date();
    const applyLock = opts.applyLock === true;
    this.recordHeartbeat(jobName, {
      startedAt,
      finishedAt: null,
      status: 'running',
      lockHeld: applyLock ? true : null,
    });
    try {
      let result;
      let acquired = true;
      if (applyLock) {
        const outcome = await withAdvisoryLock(jobName, handler);
        acquired = outcome.acquired;
        result = outcome.result;
      } else {
        result = await handler();
      }

      const finishedAt = new Date();

      if (!acquired) {
        // Equoria-iot0h: loser-of-the-lock path. Record an explicit
        // 'skipped-locked' heartbeat so /api/admin/cron/health surfaces
        // the skip rather than implying success. Persisted to CronRunLog
        // so cross-restart history reflects which replicas yielded.
        this.recordHeartbeat(jobName, {
          startedAt,
          finishedAt,
          status: 'skipped-locked',
          summary: null,
          error: null,
          lockHeld: false,
          lastLockAcquired: false,
        });
        await this.persistRunLog({
          jobName,
          startedAt,
          finishedAt,
          status: 'skipped-locked',
          summary: null,
        });
        return null;
      }

      const summary = this.summarizeResult(result);
      this.recordHeartbeat(jobName, {
        startedAt,
        finishedAt,
        status: 'success',
        summary,
        error: null,
        lockHeld: false,
        lastLockAcquired: applyLock ? true : null,
      });
      await this.persistRunLog({ jobName, startedAt, finishedAt, status: 'success', summary });
      return result;
    } catch (error) {
      const finishedAt = new Date();
      const errorMessage = error?.message ?? String(error);
      this.recordHeartbeat(jobName, {
        startedAt,
        finishedAt,
        status: 'error',
        error: errorMessage,
        lockHeld: false,
      });
      await this.persistRunLog({
        jobName,
        startedAt,
        finishedAt,
        status: 'error',
        errorMessage,
      });
      throw error;
    }
  }

  /**
   * Equoria-9wby: Persist a single cron run to the CronRunLog table. Maps the
   * free-form handler summary to typed counter columns where present, while
   * always storing the full summary in the JSONB `summary` column for
   * forward-compat. Best-effort — DB errors are logged and swallowed so cron
   * never dies because the observability sidecar table is unhealthy.
   *
   * @param {Object} entry
   * @param {string} entry.jobName
   * @param {Date} entry.startedAt
   * @param {Date} entry.finishedAt
   * @param {'success'|'error'} entry.status
   * @param {Object|null} [entry.summary]
   * @param {string|null} [entry.errorMessage]
   */
  async persistRunLog({
    jobName,
    startedAt,
    finishedAt,
    status,
    summary = null,
    errorMessage = null,
  }) {
    try {
      const summaryObj = summary && typeof summary === 'object' ? summary : null;
      await prisma.cronRunLog.create({
        data: {
          jobName,
          startedAt,
          finishedAt,
          status,
          horsesProcessed: summaryObj?.horsesProcessed ?? summaryObj?.totalProcessed ?? null,
          birthdaysFound: summaryObj?.birthdaysFound ?? null,
          milestonesEvaluated:
            summaryObj?.milestonesEvaluated ?? summaryObj?.milestonesTriggered ?? null,
          electionsOpened: summaryObj?.opened ?? null,
          electionsClosed: summaryObj?.closed ?? null,
          errorsCount: typeof summaryObj?.errors === 'number' ? summaryObj.errors : null,
          errorMessage,
          summary: summaryObj,
        },
      });
    } catch (err) {
      logger.warn(
        `[CronJobService.persistRunLog] Failed to persist CronRunLog for ${jobName}: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Equoria-0elk: Reduce a handler's free-form result to a JSON-safe summary
   * suitable for the health endpoint. Defensive — handlers return varied
   * shapes (processHorseBirthdays vs transitionElectionStatuses etc.).
   */
  summarizeResult(result) {
    if (!result || typeof result !== 'object') {
      return null;
    }
    const allow = [
      'totalProcessed',
      'birthdaysFound',
      'milestonesTriggered',
      'milestonesEvaluated',
      'milestonesSkipped',
      'errors',
      'duration',
      'opened',
      'closed',
      'ridersTicked',
      'trainersTicked',
      'horsesProcessed',
      'horsesScanned',
      'horsesUpdated',
      'flagsRemoved',
    ];
    const out = {};
    for (const k of allow) {
      if (k in result) {
        out[k] = result[k];
      }
    }
    return Object.keys(out).length ? out : null;
  }

  /**
   * Initialize and start all cron jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('[CronJobService] Cron jobs are already running');
      return;
    }

    logger.info('[CronJobService] Starting cron job service');

    // Equoria-0elk: every scheduled handler is wrapped in runWithHeartbeat so
    // /api/admin/cron/health can detect "cron silently didn't run" failures.
    // Equoria-iot0h: every PRODUCTION schedule uses `applyLock: true` so when
    // replicas > 1 the side-effect runs EXACTLY ONCE cluster-wide via
    // pg_try_advisory_xact_lock. The loser-of-the-race records
    // status:'skipped-locked' instead of 'success'.
    //
    // Equoria-fx4e7: the ten per-job descriptors (schedule + applyLock +
    // staleAfterMs + run thunk) live in backend/services/jobs/. We iterate the
    // ordered CRON_JOB_REGISTRY and build each cron.schedule identically to the
    // previous inline blocks: same schedule string, same { scheduled: false,
    // timezone: 'UTC' } options, same runWithHeartbeat(jobName, () => run(this),
    // { applyLock }) wrapping. Map insertion order is preserved because the
    // registry is ordered to match the original this.jobs.set(...) sequence, so
    // getStatus()/getHealth() iteration order is byte-identical to before.
    for (const { jobName, schedule, applyLock, run } of CRON_JOB_REGISTRY) {
      const job = cron.schedule(
        schedule,
        async () => {
          await this.runWithHeartbeat(jobName, () => run(this), { applyLock });
        },
        {
          scheduled: false,
          timezone: 'UTC',
        },
      );
      this.jobs.set(jobName, job);
    }

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`[CronJobService] Started job: ${name}`);
    });

    this.isRunning = true;
    logger.info('[CronJobService] All cron jobs started successfully');
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('[CronJobService] Cron jobs are not running');
      return;
    }

    logger.info('[CronJobService] Stopping cron job service');

    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`[CronJobService] Stopped job: ${name}`);
    });

    this.isRunning = false;
    logger.info('[CronJobService] All cron jobs stopped');
  }

  /**
   * Main daily trait evaluation function
   * Iterates through all foals aged 0-6 days and evaluates traits
   */
  async evaluateDailyFoalTraits() {
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
          const result = await this.evaluateFoalTraits(foal);
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
      await this.logAuditSummary({
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
   * Evaluate traits for a single foal
   * @param {Object} foal - Foal data with development information
   * @returns {Object} - Evaluation result
   */
  async evaluateFoalTraits(foal) {
    try {
      logger.info(`[CronJobService.evaluateFoalTraits] Evaluating foal ${foal.id} (${foal.name})`);

      // Get current development day
      const currentDay = foal.foalDevelopment?.currentDay || 0;

      // Skip foals that have completed development (day > 6)
      if (currentDay > 6) {
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
        logger.info(
          `[CronJobService.evaluateFoalTraits] No new traits revealed for foal ${foal.id}`,
        );
        // Equoria-3lb8q: still advance development day so the foal reaches the
        // next minAge gate on the next nightly run, even on a no-reveal night.
        const advancedDay = await this.advanceFoalDevelopmentDay(foal.id, currentDay);
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
      await this.logTraitRevelation(foal.id, foal.name, newTraits, currentDay, foal);

      // Equoria-yy1a5: notify the foal's owner when one or more VISIBLE traits
      // were revealed by the nightly job. Hidden traits remain a discovery and
      // intentionally do NOT notify. Owner is foal.userId (the canonical owner
      // field — Horse has no ownerId). Fire-and-forget at the service level:
      // createNotification already swallows its own errors, but guard anyway so
      // a notification failure never aborts the trait persistence.
      await this.notifyTraitRevelation(foal, newTraits, currentDay);

      logger.info(
        `[CronJobService.evaluateFoalTraits] Updated foal ${foal.id} with ${totalNewTraits} new traits`,
      );

      // Equoria-3lb8q: advance development day AFTER persisting this day's
      // reveals, so the foal reaches the next minAge gate on the next run.
      const advancedDay = await this.advanceFoalDevelopmentDay(foal.id, currentDay);

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
   * the current night's trait evaluation has run for the existing day.
   *
   * DECISION (b) — automatic advance: prior to this, foalDevelopment.currentDay
   * was written in exactly one place (the manual advance-foal-development
   * endpoint, foalController.mjs). With no automatic process incrementing it,
   * an unattended foal stayed at day 0 forever, so the day-2..6-gated traits
   * (intelligent/bold/athletic/trainability_boost/fragile/aggressive/lazy/
   * legendary_bloodline, etc.) could NEVER satisfy their minAge automatically —
   * the nightly job could only ever reveal day-0/1 traits.
   *
   * Advancing at the END of evaluateFoalTraits (not the start) means each
   * nightly run evaluates the CURRENT day's gate first, then steps the foal one
   * day forward, so a foal reaches each successive minAge gate on successive
   * nights. We upsert because some foals predate the FoalDevelopment row.
   *
   * Cap at 6 — beyond day 6 the foal is development-complete (the day>6 skip at
   * the top of evaluateFoalTraits). A foal already at >=6 is not advanced.
   *
   * @param {number} foalId
   * @param {number} currentDay - the day that was just evaluated
   * @returns {Promise<number>} the new currentDay
   */
  async advanceFoalDevelopmentDay(foalId, currentDay) {
    const FINAL_DEVELOPMENT_DAY = 6;
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
   * reveals one or more VISIBLE traits for a foal.
   *
   * The generic notification infra (notificationService.createNotification)
   * writes a durable Notification row AND publishes a live user event over the
   * SSE bus. We use the 'trait_discovery' type (the same discriminator the labs
   * reporting timeline and the docs "Trait Discovery Events" enhancement use).
   *
   * Only VISIBLE traits (positive + negative) notify — hidden traits remain an
   * undiscovered surprise by design, so a run that reveals only hidden traits
   * fires no notification. If the foal has no owner (userId null) we skip.
   *
   * Best-effort: createNotification swallows its own errors; we additionally
   * guard so a notification failure never aborts the surrounding trait
   * persistence flow.
   *
   * @param {Object} foal - foal record (needs id, name, userId)
   * @param {Object} newTraits - { positive: [], negative: [], hidden: [] }
   * @param {number} currentDay - development day the reveal happened on
   */
  async notifyTraitRevelation(foal, newTraits, currentDay) {
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
   * Equoria-bfo1t: previously this only emitted a Winston line; the queryable
   * persistence was a commented-out `prisma.traitAuditLog.create(...)` stub
   * (the traitAuditLog model never existed). The real, queryable model is
   * TraitHistoryLog, with a persister (traitHistoryService.logTraitAssignment)
   * already wired into the manual epigenetic-trait route. We now call it once
   * per revealed trait (positive + negative + hidden) so the nightly job leaves
   * a queryable history record, with sourceType 'daily_evaluation' to mark the
   * cron origin. bondScore / stressLevel are taken from the foal record;
   * ageInDays is computed inside logTraitAssignment from the horse's
   * dateOfBirth. Persistence is best-effort per-trait — a single failed insert
   * is logged and does not abort the others or the surrounding flow.
   *
   * @param {number} foalId - Foal ID
   * @param {string} foalName - Foal name
   * @param {Object} newTraits - New traits revealed
   * @param {number} currentDay - Current development day
   * @param {Object} [foal] - Full foal record (for bondScore / stressLevel)
   */
  async logTraitRevelation(foalId, foalName, newTraits, currentDay, foal = null) {
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
   * Log daily audit summary
   * @param {Object} summary - Summary data
   */
  async logAuditSummary(summary) {
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
      logger.error(
        `[CronJobService.logAuditSummary] Error logging audit summary: ${error.message}`,
      );
    }
  }

  /**
   * Daily horse aging process
   * Processes all horses for birthday updates and milestone evaluation
   * @param {Object} options - Processing options (e.g. horseIds filter)
   */
  async processHorseAging(options = {}) {
    const startTime = Date.now();
    logger.info('[CronJobService.processHorseAging] Starting daily horse aging process');

    try {
      const result = await processHorseBirthdays(options);

      const duration = Date.now() - startTime;
      logger.info(`[CronJobService.processHorseAging] Completed aging process in ${duration}ms`);
      logger.info(
        `[CronJobService.processHorseAging] Summary: ${result.totalProcessed} horses processed, ${result.birthdaysFound} birthdays, ${result.milestonesTriggered} milestones, ${result.errors} errors`,
      );

      // Log audit summary
      await this.logAgingSummary({
        timestamp: new Date(),
        ...result,
        duration,
      });

      return result;
    } catch (error) {
      logger.error(`[CronJobService.processHorseAging] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-3yxz: Daily foal milestone evaluation pass.
   * Iterates active foals in developmental windows and writes a MilestoneTraitLog
   * row for any window the foal has just entered (and not yet been evaluated for).
   *
   * @param {Object} options - { dryRun, specificHorseId }
   * @returns {Promise<Object>} Processing results
   */
  async processFoalMilestones(options = {}) {
    const startTime = Date.now();
    logger.info('[CronJobService.processFoalMilestones] Starting daily foal milestone evaluation');

    try {
      const result = await processFoalMilestoneEvaluations(options);
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.processFoalMilestones] Completed in ${duration}ms — foals: ${result.totalProcessed}, evaluated: ${result.milestonesEvaluated}, skipped: ${result.milestonesSkipped}, errors: ${result.errors}`,
      );
      return result;
    } catch (error) {
      logger.error(`[CronJobService.processFoalMilestones] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-r1nr: Weekly career-week ++ pass for riders and trainers.
   * Mirrors the groom progression cron for the other NPC types.
   */
  async tickRiderTrainerCareerWeeks() {
    const startTime = Date.now();
    logger.info(
      '[CronJobService.tickRiderTrainerCareerWeeks] Starting weekly rider/trainer career-week tick',
    );
    try {
      const result = await incrementWeeklyCareerWeeks();
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.tickRiderTrainerCareerWeeks] Completed in ${duration}ms — riders: ${result.ridersTicked}, trainers: ${result.trainersTicked}`,
      );
      return result;
    } catch (error) {
      logger.error(`[CronJobService.tickRiderTrainerCareerWeeks] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-aghl (FR-CN8): Overnight show execution pass.
   *
   * Invokes the competition module's executeClosedShows handler with no req/res
   * (the controller already gracefully handles missing res — see
   * showController.mjs `if (res)` guards on success/error branches), which
   * means it functions as both an HTTP-callable admin endpoint AND a
   * cron-callable service action without duplicating the scoring/prize/XP
   * pipeline.
   *
   * Behaviour: finds every Show where status='open' AND closeDate <= now,
   * scores all entries, awards prizes, awards rider XP, sets firstEverWin
   * milestones, and marks each show 'completed' with executedAt populated.
   *
   * Failure mode: errors bubble up so the heartbeat layer records them; the
   * cron service does NOT crash the process. Logged at error level for ops
   * triage.
   */
  async executeOvernightShows() {
    const startTime = Date.now();
    logger.info('[CronJobService.executeOvernightShows] Starting nightly overnight show execution');
    try {
      // Pass undefined for req/res — controller's `if (res)` guards both
      // response paths (200-on-success, 500-on-error), so when called from
      // cron those sends are skipped and the handler runs purely as a service.
      await executeClosedShows(undefined, undefined);
      const duration = Date.now() - startTime;
      logger.info(`[CronJobService.executeOvernightShows] Completed in ${duration}ms`);
    } catch (error) {
      logger.error(`[CronJobService.executeOvernightShows] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-54qq8 (OWASP A09 follow-up): nightly audit-log retention purge.
   *
   * Delegates to auditLogRetentionService.purgeExpiredAuditLogs(), a scoped
   * DELETE of audit_logs rows older than the retention window. The returned
   * summary ({ deletedCount, retentionDays, cutoff }) flows into the
   * heartbeat layer so /api/admin/cron/health surfaces what was purged.
   *
   * Failure mode: errors bubble up so runWithHeartbeat records them; the
   * cron service does NOT crash. Logged at error level for ops triage.
   *
   * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
   */
  async purgeExpiredAuditLogs() {
    const startTime = Date.now();
    logger.info('[CronJobService.purgeExpiredAuditLogs] Starting audit-log retention purge');
    try {
      const result = await purgeExpiredAuditLogs();
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.purgeExpiredAuditLogs] Completed in ${duration}ms — ` +
          `deleted ${result.deletedCount} row(s), retention ${result.retentionDays}d`,
      );
      return result;
    } catch (error) {
      logger.error(`[CronJobService.purgeExpiredAuditLogs] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-gg3v: nightly hoof-condition decay (farrier re-booking loop).
   *
   * Delegates to hoofConditionDecayService.decayHoofConditions(), a
   * decay-only scoped updateMany that steps a horse's hoofCondition down one
   * rung per elapsed HOOF_CONDITION_DECAY_DAYS interval since its last
   * farrier visit. The returned summary ({ decayedCount, decayDays,
   * transitions }) flows into the heartbeat layer so /api/admin/cron/health
   * surfaces what decayed.
   *
   * Failure mode: errors bubble up so runWithHeartbeat records them; the
   * cron service does NOT crash. Logged at error level for ops triage.
   *
   * @returns {Promise<{ decayedCount: number, decayDays: number,
   *                      transitions: Array<{from:string,to:string,count:number}> }>}
   */
  async decayHoofConditions() {
    const startTime = Date.now();
    logger.info('[CronJobService.decayHoofConditions] Starting hoof-condition decay');
    try {
      const result = await decayHoofConditions();
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.decayHoofConditions] Completed in ${duration}ms — ` +
          `decayed ${result.decayedCount} horse(s), interval ${result.decayDays}d`,
      );
      return result;
    } catch (error) {
      logger.error(`[CronJobService.decayHoofConditions] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-yzqhj.2: weekly epigenetic-flag evaluation across all eligible
   * (age 0-3, under the per-horse flag cap) horses.
   *
   * Delegates to the CANONICAL flag engine (utils/flagEvaluationEngine):
   *   - getEligibleHorses(now) returns the age-0-3 / under-cap horse IDs,
   *     using the same canonical game-year window the engine uses elsewhere.
   *   - batchEvaluateFlags(ids, now) evaluates each horse's 7-day care
   *     pattern and persists any newly-triggered Horse.epigeneticFlags.
   *
   * The returned summary ({ evaluated, succeeded, flagsAssigned, errors })
   * flows into the heartbeat layer so /api/admin/cron/health surfaces what
   * happened. Failure mode: errors bubble up so runWithHeartbeat records them;
   * the cron service does NOT crash. Idempotent: a horse already at the flag
   * cap is excluded by getEligibleHorses, and re-evaluating a horse whose care
   * pattern no longer qualifies assigns nothing.
   *
   * @returns {Promise<{ evaluated: number, succeeded: number,
   *                      flagsAssigned: number, errors: number }>}
   */
  async evaluateWeeklyFlags() {
    const startTime = Date.now();
    logger.info('[CronJobService.evaluateWeeklyFlags] Starting weekly epigenetic-flag evaluation');
    try {
      const now = new Date();
      const eligibleIds = await getEligibleHorses(now);
      const results = await batchEvaluateFlags(eligibleIds, now);

      const succeeded = results.filter(r => r && r.success).length;
      const errors = results.filter(r => r && r.success === false).length;
      // evaluateHorseFlags returns assignedFlags (or flagsAssigned) on success;
      // count the total newly-assigned flags across all horses for the summary.
      const flagsAssigned = results.reduce((sum, r) => {
        if (!r || r.success === false) {
          return sum;
        }
        const assigned = r.assignedFlags || r.flagsAssigned || r.newFlags || [];
        return sum + (Array.isArray(assigned) ? assigned.length : 0);
      }, 0);

      const summary = {
        evaluated: eligibleIds.length,
        succeeded,
        flagsAssigned,
        errors,
      };
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.evaluateWeeklyFlags] Completed in ${duration}ms — ` +
          `evaluated ${summary.evaluated} eligible horse(s), ${summary.succeeded} ok, ` +
          `${summary.flagsAssigned} flag(s) assigned, ${summary.errors} error(s)`,
      );
      return summary;
    } catch (error) {
      logger.error(`[CronJobService.evaluateWeeklyFlags] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Equoria-yzqhj.5: daily temporary-flag expiry sweep.
   *
   * Delegates to temporaryFlagSystem.sweepExpiredTemporaryFlags(), which does a
   * SCOPED read of only the horses with a non-empty temporaryEpigeneticFlags
   * array and removes any { flag, expiresAt, source } entry whose expiresAt is
   * in the past. The returned summary ({ horsesScanned, horsesUpdated,
   * flagsRemoved }) flows into the heartbeat layer so /api/admin/cron/health
   * surfaces what was swept.
   *
   * Failure mode: errors bubble up so runWithHeartbeat records them; the cron
   * service does NOT crash. Idempotent — a second run with the same clock
   * finds nothing expired and is a no-op.
   *
   * @returns {Promise<{ horsesScanned:number, horsesUpdated:number,
   *                      flagsRemoved:number }>}
   */
  async sweepExpiredTemporaryFlags() {
    const startTime = Date.now();
    logger.info('[CronJobService.sweepExpiredTemporaryFlags] Starting temporary-flag expiry sweep');
    try {
      const result = await sweepExpiredTemporaryFlags();
      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.sweepExpiredTemporaryFlags] Completed in ${duration}ms — ` +
          `scanned ${result.horsesScanned} horse(s), updated ${result.horsesUpdated}, ` +
          `removed ${result.flagsRemoved} expired flag(s)`,
      );
      return result;
    } catch (error) {
      logger.error(`[CronJobService.sweepExpiredTemporaryFlags] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log aging audit summary
   * @param {Object} summary - Summary data
   */
  async logAgingSummary(summary) {
    try {
      const auditSummary = {
        type: 'DAILY_HORSE_AGING_SUMMARY',
        timestamp: summary.timestamp.toISOString(),
        statistics: {
          horsesProcessed: summary.totalProcessed,
          birthdaysFound: summary.birthdaysFound,
          milestonesTriggered: summary.milestonesTriggered,
          errors: summary.errors,
          duration: summary.duration,
        },
      };

      logger.info(`[CronJobService.AUDIT] Aging summary: ${JSON.stringify(auditSummary)}`);
    } catch (error) {
      logger.error(
        `[CronJobService.logAgingSummary] Error logging aging summary: ${error.message}`,
      );
    }
  }

  /**
   * Transitions ClubElection status fields to match the current time:
   *   upcoming → open  when startsAt <= now
   *   open     → closed when endsAt  <= now
   * Returns counts of each transition type.
   */
  async transitionElectionStatuses() {
    const startTime = Date.now();
    logger.info('[CronJobService.transitionElectionStatuses] Starting election status transition');

    try {
      const now = new Date();

      const [openedResult, closedResult] = await Promise.all([
        prisma.clubElection.updateMany({
          where: { status: 'upcoming', startsAt: { lte: now } },
          data: { status: 'open' },
        }),
        prisma.clubElection.updateMany({
          where: { status: { not: 'closed' }, endsAt: { lte: now } },
          data: { status: 'closed' },
        }),
      ]);

      const duration = Date.now() - startTime;
      logger.info(
        `[CronJobService.transitionElectionStatuses] Completed in ${duration}ms: opened=${openedResult.count}, closed=${closedResult.count}`,
      );

      return { opened: openedResult.count, closed: closedResult.count };
    } catch (error) {
      logger.error(`[CronJobService.transitionElectionStatuses] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Manually trigger trait evaluation (for testing/admin purposes)
   * @returns {Object} - Evaluation results
   */
  async manualTraitEvaluation() {
    logger.info('[CronJobService.manualTraitEvaluation] Manual trait evaluation triggered');
    return await this.evaluateDailyFoalTraits();
  }

  /**
   * Manually trigger horse aging (for testing/admin purposes)
   * @param {Object} options - Processing options
   * @returns {Object} - Aging results
   */
  async manualHorseAging(options = {}) {
    logger.info('[CronJobService.manualHorseAging] Manual horse aging triggered');
    return await this.processHorseAging(options);
  }

  /**
   * Get cron job status
   * @returns {Object} - Status information
   */
  getStatus() {
    const jobStatuses = {};
    this.jobs.forEach((job, name) => {
      jobStatuses[name] = {
        running: job.running,
        scheduled: job.scheduled,
      };
    });

    return {
      serviceRunning: this.isRunning,
      jobs: jobStatuses,
      totalJobs: this.jobs.size,
    };
  }

  /**
   * Equoria-304a: Evaluate the health snapshot for stale jobs and fire a
   * debounced Sentry alert when any job has been stale for > 25h.
   *
   * Debounce rule: at most ONE alert per stale streak per job. The streak
   * ends (and the debounce clears) only when the job records a successful
   * run (see recordHeartbeat). If the job remains stale across many polls,
   * we do NOT re-emit; if it recovers and goes stale again, we DO emit.
   *
   * The Sentry event payload lists ALL stale jobs in this cycle plus their
   * last-finishedAt timestamps so on-call can immediately see which crons
   * skipped.
   *
   * No-op when Sentry DSN isn't configured (Sentry.captureMessage becomes
   * a noop). Safe to call on every /health poll — the debounce + threshold
   * guarantee bounded emit rate.
   *
   * @param {Object} health - snapshot from getHealth()
   * @param {Date}   [now]
   * @returns {Object[]}    - the list of jobs we alerted on this call (empty
   *                          if debounced or below threshold)
   */
  evaluateStaleAlerts(health, now = new Date()) {
    const nowMs = now.getTime();
    const toAlert = [];
    for (const [jobName, block] of Object.entries(health.jobs)) {
      // Only fire when this job has been stale longer than the 25h alert
      // threshold (independent of the per-job staleness flag, which uses
      // 30h for daily jobs).
      const finishedAtMs = block.lastFinishedAt ? new Date(block.lastFinishedAt).getTime() : null;
      const staleForMs = finishedAtMs === null ? Infinity : nowMs - finishedAtMs;
      if (staleForMs <= STALE_ALERT_THRESHOLD_MS) {
        continue;
      }

      // Debounce: one alert per stale streak per job.
      if (this.staleAlertState.has(jobName)) {
        continue;
      }

      this.staleAlertState.set(jobName, nowMs);
      toAlert.push({
        jobName,
        lastFinishedAt: block.lastFinishedAt,
        status: block.status,
        staleForHours: Number.isFinite(staleForMs)
          ? Math.round(staleForMs / (60 * 60 * 1000))
          : null,
      });
    }

    if (toAlert.length === 0) {
      return [];
    }

    try {
      Sentry.withScope(scope => {
        scope.setTag('event_type', 'operational');
        scope.setTag('alert', 'cron_stale_heartbeat');
        scope.setLevel('error');
        scope.setContext('stale_cron_jobs', {
          count: toAlert.length,
          thresholdHours: Math.round(STALE_ALERT_THRESHOLD_MS / (60 * 60 * 1000)),
          jobs: toAlert,
        });
        const jobNames = toAlert.map(j => j.jobName).join(', ');
        Sentry.captureMessage(
          `Cron stale heartbeat alert: ${toAlert.length} job(s) stale > 25h — ${jobNames}`,
          'error',
        );
      });
      logger.error(
        `[CronJobService.evaluateStaleAlerts] Stale cron jobs (>25h): ${toAlert
          .map(j => `${j.jobName}(${j.staleForHours}h)`)
          .join(', ')}`,
      );
    } catch (err) {
      logger.warn(
        `[CronJobService.evaluateStaleAlerts] Sentry emit failed: ${err?.message ?? err}`,
      );
    }
    return toAlert;
  }

  /**
   * Equoria-9wby: Async health snapshot variant that includes recentRuns[N]
   * per job from the persistent CronRunLog table. Use this from the admin
   * route handler so cross-restart history is visible.
   *
   * @param {Object} [opts]
   * @param {Date}   [opts.now]
   * @param {number} [opts.recentRunsLimit=5]
   * @returns {Promise<Object>}
   */
  async getHealthWithHistory({ now = new Date(), recentRunsLimit = 5 } = {}) {
    const base = this.getHealth(now);
    // Equoria-304a: evaluate stale-heartbeat alerts on every /health poll.
    // Debounced internally — bounded emit rate even under poll storms.
    this.evaluateStaleAlerts(base, now);
    try {
      for (const jobName of Object.keys(base.jobs)) {
        const rows = await prisma.cronRunLog.findMany({
          where: { jobName },
          // Secondary `id desc` tiebreak: startedAt has millisecond precision,
          // so two runs in the same ms tie on startedAt alone and Postgres
          // returns ties in arbitrary physical order — making recentRuns[0]
          // nondeterministic. id is autoincrement (monotonic with insertion),
          // so this deterministically surfaces the most-recent run first.
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: recentRunsLimit,
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            status: true,
            horsesProcessed: true,
            birthdaysFound: true,
            milestonesEvaluated: true,
            electionsOpened: true,
            electionsClosed: true,
            errorsCount: true,
            errorMessage: true,
            summary: true,
          },
        });
        base.jobs[jobName].recentRuns = rows.map(r => ({
          ...r,
          // Equoria-s20o: realm-safe ISO serialization. recentRuns[].startedAt/
          // finishedAt are contractually ISO strings (this method feeds the
          // JSON /api/admin/cron/health response). The prior `instanceof Date`
          // guard silently fell through to the raw Date object under a
          // cross-realm Prisma client, breaking the string contract.
          startedAt: toIsoStringSafe(r.startedAt),
          finishedAt: toIsoStringSafe(r.finishedAt),
        }));
      }
    } catch (err) {
      logger.warn(
        `[CronJobService.getHealthWithHistory] CronRunLog read failed: ${err?.message ?? err}`,
      );
      for (const jobName of Object.keys(base.jobs)) {
        base.jobs[jobName].recentRuns = [];
      }
    }
    return base;
  }

  /**
   * Equoria-0elk: Heartbeat health snapshot for /api/admin/cron/health.
   *
   * For each scheduled job, returns:
   *   - lastStartedAt / lastFinishedAt: timestamps (or null if never run in
   *     this process — the canonical "cron silently didn't run" signal).
   *   - status: 'success' | 'error' | 'running' | 'never-run'.
   *   - summary: handler-specific JSON-safe stats from the last success.
   *   - stalenessMs: staleness threshold for this job.
   *   - stale: true if lastFinishedAt is null OR older than stalenessMs.
   *
   * Top-level `anyStale` flag exists so monitoring can boolean-alert without
   * walking the per-job map.
   *
   * @returns {Object}
   */
  getHealth(now = new Date()) {
    const nowMs = now.getTime();
    const perJob = {};
    let anyStale = false;

    for (const jobName of this.jobs.keys()) {
      const hb = this.heartbeats.get(jobName) ?? null;
      const stalenessMs = JOB_STALENESS_MS[jobName] ?? 30 * 60 * 60 * 1000;
      const lastFinishedAt = hb?.finishedAt ?? null;
      const lastStartedAt = hb?.startedAt ?? null;
      const status = hb?.status ?? 'never-run';

      // STALE when never finished, OR finished but too long ago.
      let stale = false;
      if (!lastFinishedAt) {
        stale = true;
      } else {
        stale = nowMs - new Date(lastFinishedAt).getTime() > stalenessMs;
      }
      if (stale) {
        anyStale = true;
      }

      perJob[jobName] = {
        lastStartedAt: lastStartedAt ? new Date(lastStartedAt).toISOString() : null,
        lastFinishedAt: lastFinishedAt ? new Date(lastFinishedAt).toISOString() : null,
        status,
        summary: hb?.summary ?? null,
        error: hb?.error ?? null,
        stalenessMs,
        stale,
        // Equoria-iot0h (AC #3): surface lock-acquisition state per job so
        // /api/admin/cron/health answers "is the cross-replica advisory lock
        // currently held?" and "did the last run actually acquire it (vs.
        // being skipped-locked)?". `null` for jobs that don't use applyLock.
        lockHeld: hb?.lockHeld ?? null,
        lastLockAcquired: hb?.lastLockAcquired ?? null,
      };
    }

    return {
      serviceRunning: this.isRunning,
      now: now.toISOString(),
      anyStale,
      jobs: perJob,
    };
  }
}

// Create singleton instance
const cronJobService = new CronJobService();

export default cronJobService;
