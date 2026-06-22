import cron from 'node-cron';
import logger from '../utils/logger.mjs';
// Equoria-urqic.3: heavy job-logic clusters extracted out of this orchestrator
// into focused, individually-testable impl modules. The class keeps thin
// delegator methods (the names integration tests call on the singleton) that
// forward into these. See each impl module's header for the why.
import * as foalTraitImpl from './jobs/impl/foalTraitEvaluation.mjs';
import * as horseAgingImpl from './jobs/impl/horseAging.mjs';
import { transitionElectionStatuses as transitionElectionStatusesImpl } from './jobs/impl/electionTransition.mjs';
// Equoria-urqic.3.2: epigenetic-flag cluster (weekly flag evaluation + daily
// temporary-flag expiry sweep).
import * as flagEvaluationImpl from './jobs/impl/flagEvaluation.mjs';
// Equoria-urqic.3.3: retention/maintenance single-delegator cluster (audit-log /
// cron-run-log / doc-coverage purges + recording, hoof decay, foal milestones,
// rider/trainer career tick, overnight show execution).
import * as retentionMaintenanceImpl from './jobs/impl/retentionMaintenance.mjs';
// Equoria-fx4e7: per-job descriptors (schedule + lock policy + staleness budget
// + run thunk) live in backend/services/jobs/. start() iterates this registry
// instead of carrying ten inline cron.schedule(...) blocks.
import { CRON_JOB_REGISTRY } from './jobs/index.mjs';
// Equoria-urqic.3.5: the run-observability concern (heartbeat liveness,
// CronRunLog persistence, the /api/admin/cron/health surface, and the
// stale-alert debounce) is now a dedicated collaborator that this scheduler
// COMPOSES. CronJobService owns scheduling/lifecycle; CronJobMonitor owns
// observing each run. STALE_ALERT_THRESHOLD_MS is re-exported below because a
// test imports it from this module's public surface.
import CronJobMonitor, { STALE_ALERT_THRESHOLD_MS } from './jobs/cronJobMonitor.mjs';

export { STALE_ALERT_THRESHOLD_MS };

class CronJobService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    // Equoria-urqic.3.5: the run-observability collaborator. This scheduler
    // delegates every job execution through it (runWithHeartbeat) and reads the
    // health surface from it (getHealth / getHealthWithHistory).
    this.monitor = new CronJobMonitor();
  }

  /**
   * Equoria-urqic.3.5: live-Map accessors for the monitor's heartbeat /
   * stale-alert state. The cron test suites mutate these in place on the
   * singleton (`cronJobService.heartbeats.clear()/.set()`, `new Map(...)`
   * snapshots). Returning the monitor's SAME Map instance keeps that access
   * behavior-identical with zero test churn — the scheduler never owns this
   * state, it only re-exposes the collaborator's.
   */
  get heartbeats() {
    return this.monitor.heartbeats;
  }

  get staleAlertState() {
    return this.monitor.staleAlertState;
  }

  // --- run-observability delegators (forward to this.monitor) -------------
  // Public methods that integration tests / the admin route call ON THE
  // SINGLETON. They stay on the class as thin forwarders so the existing
  // contract is preserved; the implementation lives in CronJobMonitor.

  /** Equoria-0elk delegator → CronJobMonitor.recordHeartbeat. */
  recordHeartbeat(jobName, entry) {
    return this.monitor.recordHeartbeat(jobName, entry);
  }

  /** Equoria-0elk/9wby/iot0h delegator → CronJobMonitor.runWithHeartbeat. */
  async runWithHeartbeat(jobName, handler, opts = {}) {
    return this.monitor.runWithHeartbeat(jobName, handler, opts);
  }

  /** Equoria-9wby delegator → CronJobMonitor.persistRunLog. */
  async persistRunLog(entry) {
    return this.monitor.persistRunLog(entry);
  }

  /** Equoria-0elk delegator → CronJobMonitor.summarizeResult. */
  summarizeResult(result) {
    return this.monitor.summarizeResult(result);
  }

  /** Equoria-304a delegator → CronJobMonitor.evaluateStaleAlerts. */
  evaluateStaleAlerts(health, now = new Date()) {
    return this.monitor.evaluateStaleAlerts(health, now);
  }

  /**
   * Equoria-0elk delegator → CronJobMonitor.getHealth. The scheduler supplies
   * its job-name list + running flag; the monitor produces the snapshot shape.
   */
  getHealth(now = new Date()) {
    return this.monitor.getHealth(this.jobs.keys(), {
      serviceRunning: this.isRunning,
      now,
    });
  }

  /**
   * Equoria-9wby delegator → CronJobMonitor.getHealthWithHistory. Used by the
   * admin route so cross-restart CronRunLog history is visible.
   */
  async getHealthWithHistory({ now = new Date(), recentRunsLimit = 5 } = {}) {
    return this.monitor.getHealthWithHistory(this.jobs.keys(), {
      serviceRunning: this.isRunning,
      now,
      recentRunsLimit,
    });
  }

  /**
   * Initialize and start all cron jobs.
   *
   * Equoria-0elk: every scheduled handler is wrapped in runWithHeartbeat so
   * /api/admin/cron/health can detect "cron silently didn't run" failures.
   * Equoria-iot0h: every PRODUCTION schedule uses `applyLock: true` so with
   * replicas > 1 the side-effect runs EXACTLY ONCE cluster-wide via
   * pg_try_advisory_xact_lock; the loser records status:'skipped-locked'.
   * Equoria-fx4e7: the per-job descriptors (schedule + applyLock + staleAfterMs
   * + run thunk) live in backend/services/jobs/. We iterate the ordered
   * CRON_JOB_REGISTRY and build each cron.schedule identically to the previous
   * inline blocks (same schedule string, same { scheduled: false, timezone:
   * 'UTC' } options, same runWithHeartbeat wrapping). Map insertion order is
   * preserved, so getStatus()/getHealth() iteration order is unchanged.
   */
  start() {
    if (this.isRunning) {
      logger.warn('[CronJobService] Cron jobs are already running');
      return;
    }

    logger.info('[CronJobService] Starting cron job service');

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

    // Start all jobs.
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`[CronJobService] Started job: ${name}`);
    });

    this.isRunning = true;
    logger.info('[CronJobService] All cron jobs started successfully');
  }

  /**
   * Stop all cron jobs.
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
   * Equoria-urqic.3: thin delegators into the foal-trait-evaluation impl module
   * (backend/services/jobs/impl/foalTraitEvaluation.mjs). The heavy logic moved
   * out of this orchestrator; these entrypoints stay on the class because
   * real-DB integration tests call them directly on the singleton
   * (cronJobService.evaluateFoalTraits / .logTraitRevelation /
   * .notifyTraitRevelation / .advanceFoalDevelopmentDay) and share a
   * `this`-coupled call graph. `this` is forwarded as the `service` handle so
   * the impl re-enters through these same delegators (a test spy on one
   * delegator still observes the call).
   *
   * Main daily trait evaluation — iterates all foals aged 0-1 and evaluates
   * traits for revelation.
   */
  async evaluateDailyFoalTraits() {
    return foalTraitImpl.evaluateDailyFoalTraits(this);
  }

  /**
   * Evaluate traits for a single foal.
   * @param {Object} foal - Foal data with development information
   * @returns {Promise<Object>} - Evaluation result
   */
  async evaluateFoalTraits(foal) {
    return foalTraitImpl.evaluateFoalTraits(this, foal);
  }

  /**
   * Equoria-3lb8q: Advance a foal's development day by one (capped at 6).
   * @param {number} foalId
   * @param {number} currentDay - the day that was just evaluated
   * @returns {Promise<number>} the new currentDay
   */
  async advanceFoalDevelopmentDay(foalId, currentDay) {
    return foalTraitImpl.advanceFoalDevelopmentDay(foalId, currentDay);
  }

  /**
   * Equoria-yy1a5: Fire a player-facing notification when the nightly job
   * reveals one or more VISIBLE traits for a foal.
   * @param {Object} foal - foal record (needs id, name, userId)
   * @param {Object} newTraits - { positive: [], negative: [], hidden: [] }
   * @param {number} currentDay - development day the reveal happened on
   */
  async notifyTraitRevelation(foal, newTraits, currentDay) {
    return foalTraitImpl.notifyTraitRevelation(foal, newTraits, currentDay);
  }

  /**
   * Equoria-bfo1t: Log trait revelation — Winston line + queryable
   * TraitHistoryLog persistence (sourceType 'daily_evaluation').
   * @param {number} foalId
   * @param {string} foalName
   * @param {Object} newTraits
   * @param {number} currentDay
   * @param {Object} [foal] - Full foal record (for bondScore / stressLevel)
   */
  async logTraitRevelation(foalId, foalName, newTraits, currentDay, foal = null) {
    return foalTraitImpl.logTraitRevelation(foalId, foalName, newTraits, currentDay, foal);
  }

  /**
   * Log daily trait-evaluation audit summary.
   * @param {Object} summary - Summary data
   */
  async logAuditSummary(summary) {
    return foalTraitImpl.logAuditSummary(summary);
  }

  /**
   * Equoria-urqic.3.1: thin delegators into the horse-aging impl module
   * (backend/services/jobs/impl/horseAging.mjs). The heavy logic moved out of
   * this orchestrator; these entrypoints stay on the class because real-DB
   * integration tests call them directly on the singleton
   * (cronJobService.processHorseAging / .manualHorseAging / .logAgingSummary)
   * and share a `this`-coupled call graph (processHorseAging re-enters
   * logAgingSummary). `this` is forwarded as the `service` handle so the impl
   * re-enters through these same delegators (a test spy still observes it).
   *
   * Daily horse aging process — processes all horses for birthday updates and
   * milestone evaluation, then writes an aging audit summary.
   * @param {Object} options - Processing options (e.g. horseIds filter)
   */
  async processHorseAging(options = {}) {
    return horseAgingImpl.processHorseAging(this, options);
  }

  /**
   * Equoria-urqic.3.3: thin delegators into the retention/maintenance impl
   * module (backend/services/jobs/impl/retentionMaintenance.mjs). The heavy
   * logic (delegate-to-domain-service + summary-shaping + logging) moved out of
   * this orchestrator; these entrypoints stay on the class because every
   * registry handler invokes them on the singleton via `service.<method>()`
   * (and cronJobsOvernightShowExecution.test.mjs calls
   * cronJobService.executeOvernightShows directly).
   *
   * Daily foal milestone evaluation pass (Equoria-3yxz).
   * @param {Object} options - { dryRun, specificHorseId }
   * @returns {Promise<Object>}
   */
  async processFoalMilestones(options = {}) {
    return retentionMaintenanceImpl.processFoalMilestones(options);
  }

  /**
   * Weekly career-week ++ pass for riders and trainers (Equoria-r1nr).
   * @returns {Promise<{ ridersTicked: number, trainersTicked: number }>}
   */
  async tickRiderTrainerCareerWeeks() {
    return retentionMaintenanceImpl.tickRiderTrainerCareerWeeks();
  }

  /**
   * Overnight show execution pass (Equoria-aghl / FR-CN8).
   * @returns {Promise<void>}
   */
  async executeOvernightShows() {
    return retentionMaintenanceImpl.executeOvernightShows();
  }

  /**
   * Nightly audit-log retention purge (Equoria-54qq8, OWASP A09 follow-up).
   * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
   */
  async purgeExpiredAuditLogs() {
    return retentionMaintenanceImpl.purgeExpiredAuditLogs();
  }

  /**
   * Nightly cron-run-log retention purge (Equoria-2tx16).
   * @returns {Promise<{ deletedCount: number, retentionDays: number, cutoff: string }>}
   */
  async purgeExpiredCronRunLogs() {
    return retentionMaintenanceImpl.purgeExpiredCronRunLogs();
  }

  /**
   * Daily documentation-coverage snapshot recording + retention (Equoria-qr114).
   * @returns {Promise<{ snapshotId: number, coveragePct: number,
   *                      qualityScore: number, deletedCount: number,
   *                      retentionDays: number }>}
   */
  async recordDocCoverageSnapshot() {
    return retentionMaintenanceImpl.recordDocCoverageSnapshot();
  }

  /**
   * Nightly hoof-condition decay / farrier re-booking loop (Equoria-gg3v).
   * @returns {Promise<{ decayedCount: number, decayDays: number,
   *                      transitions: Array<{from:string,to:string,count:number}> }>}
   */
  async decayHoofConditions() {
    return retentionMaintenanceImpl.decayHoofConditions();
  }

  /**
   * Equoria-urqic.3.2: thin delegator into the epigenetic-flag impl module
   * (backend/services/jobs/impl/flagEvaluation.mjs). Stays on the class because
   * the weeklyFlagEvaluationJob registry handler invokes it on the singleton
   * (service.evaluateWeeklyFlags()) and integration suites call it there too.
   * @returns {Promise<{ evaluated: number, succeeded: number,
   *                      flagsAssigned: number, errors: number }>}
   */
  async evaluateWeeklyFlags() {
    return flagEvaluationImpl.evaluateWeeklyFlags();
  }

  /**
   * Equoria-urqic.3.2: thin delegator into the epigenetic-flag impl module
   * (backend/services/jobs/impl/flagEvaluation.mjs). Stays on the class because
   * the temporaryFlagExpiryJob registry handler invokes it on the singleton
   * (service.sweepExpiredTemporaryFlags()) and integration suites call it there
   * too.
   * @returns {Promise<{ horsesScanned:number, horsesUpdated:number,
   *                      flagsRemoved:number }>}
   */
  async sweepExpiredTemporaryFlags() {
    return flagEvaluationImpl.sweepExpiredTemporaryFlagsJob();
  }

  /**
   * Log aging audit summary (Equoria-urqic.3.1 delegator).
   * @param {Object} summary - Summary data
   */
  async logAgingSummary(summary) {
    return horseAgingImpl.logAgingSummary(summary);
  }

  /**
   * Equoria-urqic.3: thin delegator into the election-transition impl module
   * (backend/services/jobs/impl/electionTransition.mjs). Transitions
   * ClubElection status (upcoming→open, open→closed) to match the current time.
   * Stays on the class because the cronJobs.test.mjs real-DB suite calls it
   * directly on the singleton.
   * @returns {Promise<{ opened: number, closed: number }>}
   */
  async transitionElectionStatuses() {
    return transitionElectionStatusesImpl();
  }

  /**
   * Manually trigger trait evaluation (for testing/admin purposes).
   * @returns {Object} - Evaluation results
   */
  async manualTraitEvaluation() {
    logger.info('[CronJobService.manualTraitEvaluation] Manual trait evaluation triggered');
    return await this.evaluateDailyFoalTraits();
  }

  /**
   * Manually trigger horse aging (for testing/admin purposes).
   * @param {Object} options - Processing options
   * @returns {Object} - Aging results
   */
  async manualHorseAging(options = {}) {
    logger.info('[CronJobService.manualHorseAging] Manual horse aging triggered');
    return await this.processHorseAging(options);
  }

  /**
   * Get cron job status.
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
}

// Create singleton instance.
const cronJobService = new CronJobService();

export default cronJobService;
