import cron from 'node-cron';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { evaluateTraitRevelation } from '../utils/traitEvaluation.mjs';
import {
  processHorseBirthdays,
  processFoalMilestoneEvaluations,
} from '../utils/horseAgingSystem.mjs';
import { incrementWeeklyCareerWeeks } from './riderTrainerProgressionService.mjs';
import { executeClosedShows } from '../modules/competition/shows/showController.mjs';

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
const JOB_STALENESS_MS = {
  dailyTraitEvaluation: 30 * 60 * 60 * 1000,
  dailyHorseAging: 30 * 60 * 60 * 1000,
  dailyFoalMilestoneEvaluation: 30 * 60 * 60 * 1000,
  weeklyRiderTrainerCareerWeeks: 192 * 60 * 60 * 1000,
  electionStatusTransition: 30 * 60 * 1000,
  // Equoria-aghl (FR-CN8): nightly show execution runs at 03:00 UTC.
  nightlyShowExecution: 30 * 60 * 60 * 1000,
};

class CronJobService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    // Equoria-0elk: per-job heartbeat — last-run timestamps + status + summary
    this.heartbeats = new Map();
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
  }

  /**
   * Equoria-0elk: Wrap a scheduled-job handler to record heartbeat (success +
   * error). The wrapped function returns the handler's result so caller
   * semantics are preserved.
   *
   * @param {string} jobName     - Job key for this.heartbeats
   * @param {Function} handler   - async () => Promise<result>
   */
  async runWithHeartbeat(jobName, handler) {
    const startedAt = new Date();
    this.recordHeartbeat(jobName, { startedAt, finishedAt: null, status: 'running' });
    try {
      const result = await handler();
      this.recordHeartbeat(jobName, {
        startedAt,
        finishedAt: new Date(),
        status: 'success',
        summary: this.summarizeResult(result),
        error: null,
      });
      return result;
    } catch (error) {
      this.recordHeartbeat(jobName, {
        startedAt,
        finishedAt: new Date(),
        status: 'error',
        error: error?.message ?? String(error),
      });
      throw error;
    }
  }

  /**
   * Equoria-0elk: Reduce a handler's free-form result to a JSON-safe summary
   * suitable for the health endpoint. Defensive — handlers return varied
   * shapes (processHorseBirthdays vs transitionElectionStatuses etc.).
   */
  summarizeResult(result) {
    if (!result || typeof result !== 'object') return null;
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
    ];
    const out = {};
    for (const k of allow) {
      if (k in result) out[k] = result[k];
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
    // Daily trait evaluation job - runs at midnight
    const dailyTraitJob = cron.schedule(
      '0 0 * * *',
      async () => {
        await this.runWithHeartbeat('dailyTraitEvaluation', () => this.evaluateDailyFoalTraits());
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    // Daily aging job - runs at 12:05 AM (after trait evaluation)
    const dailyAgingJob = cron.schedule(
      '5 0 * * *',
      async () => {
        await this.runWithHeartbeat('dailyHorseAging', () => this.processHorseAging());
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    // Equoria-3yxz: Daily foal milestone evaluation — runs at 12:10 AM
    // (after aging so today's age increments are visible).
    const dailyMilestoneJob = cron.schedule(
      '10 0 * * *',
      async () => {
        await this.runWithHeartbeat('dailyFoalMilestoneEvaluation', () =>
          this.processFoalMilestones(),
        );
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    // Election status transition — runs every 15 minutes (upcoming→open, open→closed)
    const electionTransitionJob = cron.schedule(
      '*/15 * * * *',
      async () => {
        await this.runWithHeartbeat('electionStatusTransition', () =>
          this.transitionElectionStatuses(),
        );
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    // Equoria-r1nr: Weekly career-week tick for riders + trainers.
    // Runs every Monday at 12:15 AM UTC.
    const weeklyRiderTrainerCareerJob = cron.schedule(
      '15 0 * * 1',
      async () => {
        await this.runWithHeartbeat('weeklyRiderTrainerCareerWeeks', () =>
          this.tickRiderTrainerCareerWeeks(),
        );
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    // Equoria-aghl (FR-CN8): Overnight show execution — runs nightly at 03:00 UTC.
    // Picks up any Show with status='open' and closeDate <= now, scores all
    // entries, awards prizes, awards rider XP, sets firstEverWin milestones,
    // and marks each show 'completed'. Without this job the executeClosedShows
    // endpoint is dead code unless an admin triggers POST /api/v1/shows/execute
    // manually. Wrapped in runWithHeartbeat so /api/admin/cron/health surfaces
    // staleness (Equoria-0elk integration).
    const nightlyShowExecutionJob = cron.schedule(
      '0 3 * * *',
      async () => {
        await this.runWithHeartbeat('nightlyShowExecution', () => this.executeOvernightShows());
      },
      {
        scheduled: false,
        timezone: 'UTC',
      },
    );

    this.jobs.set('dailyTraitEvaluation', dailyTraitJob);
    this.jobs.set('dailyHorseAging', dailyAgingJob);
    this.jobs.set('dailyFoalMilestoneEvaluation', dailyMilestoneJob);
    this.jobs.set('weeklyRiderTrainerCareerWeeks', weeklyRiderTrainerCareerJob);
    this.jobs.set('electionStatusTransition', electionTransitionJob);
    this.jobs.set('nightlyShowExecution', nightlyShowExecutionJob);

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
        return { traitsRevealed: 0, reason: 'no_new_traits' };
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
      await this.logTraitRevelation(foal.id, foal.name, newTraits, currentDay);

      logger.info(
        `[CronJobService.evaluateFoalTraits] Updated foal ${foal.id} with ${totalNewTraits} new traits`,
      );

      return {
        traitsRevealed: totalNewTraits,
        newTraits,
        updatedTraits,
      };
    } catch (error) {
      logger.error(
        `[CronJobService.evaluateFoalTraits] Error evaluating foal ${foal.id}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Log trait revelation for auditing purposes
   * @param {number} foalId - Foal ID
   * @param {string} foalName - Foal name
   * @param {Object} newTraits - New traits revealed
   * @param {number} currentDay - Current development day
   */
  async logTraitRevelation(foalId, foalName, newTraits, currentDay) {
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

      // Could also store in a dedicated audit table if needed
      // await prisma.traitAuditLog.create({ data: logEntry });
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
      if (stale) anyStale = true;

      perJob[jobName] = {
        lastStartedAt: lastStartedAt ? new Date(lastStartedAt).toISOString() : null,
        lastFinishedAt: lastFinishedAt ? new Date(lastFinishedAt).toISOString() : null,
        status,
        summary: hb?.summary ?? null,
        error: hb?.error ?? null,
        stalenessMs,
        stale,
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
