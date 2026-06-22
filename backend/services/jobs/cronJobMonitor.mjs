import prisma from '../../../packages/database/prismaClient.mjs';
import logger from '../../utils/logger.mjs';
import { Sentry } from '../../config/sentry.mjs';
import { withAdvisoryLock } from '../../utils/cronLock.mjs';
import { CRON_JOB_REGISTRY } from './index.mjs';

/**
 * Equoria-urqic.3.5 — CronJobMonitor: the run-observability collaborator.
 *
 * This module owns the SECOND of the two concerns that used to be tangled in
 * CronJobService (backend/services/cronJobs.mjs): RUN-OBSERVABILITY. The
 * scheduler/lifecycle concern (registry wiring, start()/stop(), per-job
 * delegators) stays on CronJobService; everything that observes a job RUN —
 * heartbeat liveness, CronRunLog persistence, the /api/admin/cron/health
 * surface, and the stale-alert debounce — lives here. CronJobService COMPOSES
 * one instance (`this.monitor`) and delegates through it, so the orchestrator
 * becomes a thin scheduler (SRP / composition-over-god-class).
 *
 * The two pieces of mutable state this collaborator owns:
 *   - `heartbeats`     — jobName -> { startedAt, finishedAt, status, summary,
 *                        error, lockHeld, lastLockAcquired } for the LAST run
 *                        of each job in THIS process.
 *   - `staleAlertState`— jobName -> lastAlertedAt ms; debounces stale-heartbeat
 *                        Sentry alerts to one per stale streak.
 *
 * These Maps are exposed as own properties (not getters) so the singleton's
 * test-isolation helpers — which snapshot/restore via `new Map(monitor.x)` and
 * mutate `monitor.x` in place (`.clear()`/`.set()`) — keep operating on the
 * SAME live Map instance. CronJobService re-exposes them via getters so the
 * existing `cronJobService.heartbeats` / `.staleAlertState` test access stays
 * behavior-identical with zero test churn.
 *
 * getHealth()/getHealthWithHistory() take the scheduler's job-name list +
 * serviceRunning flag as INPUTS rather than reaching back into a CronJobService
 * reference — the monitor stays decoupled from how jobs are registered, and the
 * /api/admin/cron/health response shape is produced here unchanged.
 */

/**
 * Equoria-s20o: Realm-safe ISO-string serializer for timestamp values.
 *
 * `value instanceof Date` is fragile across JS module realms: the Prisma
 * client and this module can resolve `@prisma/client` through different
 * `node_modules` trees (e.g. a git-worktree junction), so a Date produced by
 * Prisma may fail `instanceof Date` against this realm's `Date` even though it
 * IS a Date. `Object.prototype.toString` tag-checking is realm-independent and
 * is the correct cross-realm guard.
 *
 * Returns an ISO 8601 string for any Date-like value (any realm), the value
 * unchanged if null/undefined, and otherwise re-wraps via `new Date(value)` so
 * string/number timestamps are normalized too.
 *
 * @param {*} value
 * @returns {string|null|*}
 */
export function toIsoStringSafe(value) {
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
 * Equoria-304a: Threshold for firing a stale-heartbeat operational alert.
 * Daily jobs run every 24h with a 6h tolerance (JOB_STALENESS_MS = 30h), but we
 * want a noisier alert at 25h since by then a daily job is provably skipped
 * (24h + 1h grace). Alert debounces — one Sentry event per stale streak.
 */
export const STALE_ALERT_THRESHOLD_MS = 25 * 60 * 60 * 1000;

/**
 * Equoria-0elk / fx4e7: per-job stale-after thresholds (ms) for the heartbeat
 * health endpoint. Derived from the per-job registry (each descriptor carries
 * its own staleAfterMs) so a new job cannot ship a schedule without also
 * declaring its staleness budget. If `now - lastFinishedAt > stalenessMs`, the
 * job is flagged STALE in /api/admin/cron/health responses.
 */
export const JOB_STALENESS_MS = Object.freeze(
  Object.fromEntries(CRON_JOB_REGISTRY.map(job => [job.jobName, job.staleAfterMs])),
);

const DEFAULT_STALENESS_MS = 30 * 60 * 60 * 1000;

export class CronJobMonitor {
  constructor() {
    // Equoria-0elk: per-job heartbeat — last-run timestamps + status + summary.
    this.heartbeats = new Map();
    // Equoria-304a: debounce state for stale-heartbeat alerting (jobName ->
    // lastAlertedAt ms). One Sentry event per stale streak; cleared on a
    // successful run so a recovered + re-staling job alerts again.
    this.staleAlertState = new Map();
  }

  /**
   * Equoria-0elk: Record a job heartbeat (success or error path) so
   * /api/admin/cron/health can surface STALE jobs.
   *
   * @param {string} jobName - Canonical job key.
   * @param {Object} entry   - { startedAt, finishedAt, status, summary?, error? }
   */
  recordHeartbeat(jobName, entry) {
    const existing = this.heartbeats.get(jobName) ?? {};
    this.heartbeats.set(jobName, {
      ...existing,
      ...entry,
      // Always keep the first-seen startedAt for the current cycle's entry.
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
   * error). Returns the handler's result so caller semantics are preserved.
   *
   * Equoria-9wby: Also persists each run to CronRunLog so the health endpoint
   * can surface cross-restart history. The DB write is best-effort — if
   * persistence fails the cron itself MUST NOT fail (the observability layer
   * must not break the system it observes); DB errors are logged and swallowed.
   *
   * Equoria-iot0h: When `opts.applyLock === true`, the handler runs under a
   * Postgres advisory lock so only ONE replica runs the side-effect when
   * multiple replicas fire the same schedule. The loser-of-the-race records
   * `status: 'skipped-locked'` (recording success would lie). Production
   * schedules pass `applyLock: true`; tests can opt out.
   *
   * @param {string} jobName
   * @param {Function} handler - async () => Promise<result>
   * @param {Object}  [opts]
   * @param {boolean} [opts.applyLock=false]
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
        // 'skipped-locked' heartbeat so /api/admin/cron/health surfaces the
        // skip rather than implying success. Persisted so cross-restart history
        // reflects which replicas yielded.
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
   * Equoria-9wby: Persist a single cron run to CronRunLog. Maps the free-form
   * handler summary to typed counter columns where present, while always
   * storing the full summary in the JSONB `summary` column for forward-compat.
   * Best-effort — DB errors are logged and swallowed so cron never dies because
   * the observability sidecar table is unhealthy.
   *
   * @param {Object} entry
   * @param {string} entry.jobName
   * @param {Date} entry.startedAt
   * @param {Date} entry.finishedAt
   * @param {'success'|'error'|'skipped-locked'} entry.status
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
        `[CronJobMonitor.persistRunLog] Failed to persist CronRunLog for ${jobName}: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Equoria-0elk: Reduce a handler's free-form result to a JSON-safe summary
   * for the health endpoint. Defensive — handlers return varied shapes.
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
   * Equoria-304a: Evaluate the health snapshot for stale jobs and fire a
   * debounced Sentry alert when any job has been stale for > 25h.
   *
   * Debounce rule: at most ONE alert per stale streak per job. The streak ends
   * (and the debounce clears) only when the job records a successful run (see
   * recordHeartbeat). If the job stays stale across polls we do NOT re-emit; if
   * it recovers and goes stale again we DO emit.
   *
   * No-op when the Sentry DSN isn't configured (captureMessage becomes a noop).
   * Safe to call on every /health poll — the debounce + threshold guarantee a
   * bounded emit rate.
   *
   * @param {Object} health - snapshot from getHealth()
   * @param {Date}   [now]
   * @returns {Object[]}    - jobs alerted this call (empty if debounced/below
   *                          threshold)
   */
  evaluateStaleAlerts(health, now = new Date()) {
    const nowMs = now.getTime();
    const toAlert = [];
    for (const [jobName, block] of Object.entries(health.jobs)) {
      // Fire only when this job has been stale longer than the 25h alert
      // threshold (independent of the per-job staleness flag, which uses 30h
      // for daily jobs).
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
        `[CronJobMonitor.evaluateStaleAlerts] Stale cron jobs (>25h): ${toAlert
          .map(j => `${j.jobName}(${j.staleForHours}h)`)
          .join(', ')}`,
      );
    } catch (err) {
      logger.warn(
        `[CronJobMonitor.evaluateStaleAlerts] Sentry emit failed: ${err?.message ?? err}`,
      );
    }
    return toAlert;
  }

  /**
   * Equoria-0elk: Heartbeat health snapshot for /api/admin/cron/health.
   *
   * For each scheduled job, returns lastStartedAt / lastFinishedAt (or null if
   * never run in this process — the "cron silently didn't run" signal), status
   * ('success' | 'error' | 'running' | 'never-run'), the last-success summary,
   * the per-job staleness threshold, and a `stale` flag. Top-level `anyStale`
   * lets monitoring boolean-alert without walking the per-job map.
   *
   * @param {Iterable<string>} jobNames - scheduler-owned job keys to report on.
   * @param {Object}  [opts]
   * @param {boolean} [opts.serviceRunning=false] - scheduler running flag.
   * @param {Date}    [opts.now]
   * @returns {Object}
   */
  getHealth(jobNames, { serviceRunning = false, now = new Date() } = {}) {
    const nowMs = now.getTime();
    const perJob = {};
    let anyStale = false;

    for (const jobName of jobNames) {
      const hb = this.heartbeats.get(jobName) ?? null;
      const stalenessMs = JOB_STALENESS_MS[jobName] ?? DEFAULT_STALENESS_MS;
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
        // Equoria-iot0h (AC #3): surface lock-acquisition state per job so the
        // health endpoint answers "is the cross-replica advisory lock held?"
        // and "did the last run acquire it (vs. skipped-locked)?". `null` for
        // jobs that don't use applyLock.
        lockHeld: hb?.lockHeld ?? null,
        lastLockAcquired: hb?.lastLockAcquired ?? null,
      };
    }

    return {
      serviceRunning,
      now: now.toISOString(),
      anyStale,
      jobs: perJob,
    };
  }

  /**
   * Equoria-9wby: Async health snapshot that augments getHealth() with
   * recentRuns[N] per job from the persistent CronRunLog table — used by the
   * admin route handler so cross-restart history is visible. Also evaluates the
   * stale-heartbeat alerts (debounced) on every poll.
   *
   * @param {Iterable<string>} jobNames - scheduler-owned job keys.
   * @param {Object}  [opts]
   * @param {boolean} [opts.serviceRunning=false]
   * @param {Date}    [opts.now]
   * @param {number}  [opts.recentRunsLimit=5]
   * @returns {Promise<Object>}
   */
  async getHealthWithHistory(
    jobNames,
    { serviceRunning = false, now = new Date(), recentRunsLimit = 5 } = {},
  ) {
    const base = this.getHealth(jobNames, { serviceRunning, now });
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
          // finishedAt are contractually ISO strings (this feeds the JSON
          // /api/admin/cron/health response). The prior `instanceof Date` guard
          // silently fell through to the raw Date under a cross-realm Prisma
          // client, breaking the string contract.
          startedAt: toIsoStringSafe(r.startedAt),
          finishedAt: toIsoStringSafe(r.finishedAt),
        }));
      }
    } catch (err) {
      logger.warn(
        `[CronJobMonitor.getHealthWithHistory] CronRunLog read failed: ${err?.message ?? err}`,
      );
      for (const jobName of Object.keys(base.jobs)) {
        base.jobs[jobName].recentRuns = [];
      }
    }
    return base;
  }
}

export default CronJobMonitor;
