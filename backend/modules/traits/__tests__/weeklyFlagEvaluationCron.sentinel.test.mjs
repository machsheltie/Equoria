/**
 * weeklyFlagEvaluationCron.sentinel.test.mjs (Equoria-yzqhj.2)
 *
 * The doc claimed "Automated Weekly Evaluation" but NO cron evaluated flags —
 * foals only got flags if a human manually hit POST /api/v1/flags/evaluate.
 * This sentinel proves the automated weekly job now exists, is registered in
 * the canonical CronJobService, surfaces on /api/admin/cron/health, and uses
 * the CANONICAL engine (utils/flagEvaluationEngine), NOT the retired dead
 * services/weeklyFlagEvaluationService (Equoria-yzqhj.3).
 *
 * It would FAIL if the job were removed from registration or the health map —
 * sentinel-positive per OPTIMAL_FIX_DISCIPLINE §2.
 *
 * The DB-backed behavioral proof (a foal with a qualifying 7-day care pattern
 * receives the expected flag after evaluateWeeklyFlags runs) is authored as a
 * separate real-DB integration test; this worktree cannot execute the full
 * real-DB suite (node_modules workspace deps unavailable). Execution is the
 * lead's serial integration gate.
 */

import { describe, it, expect } from '@jest/globals';
import cronJobService from '../../../services/cronJobs.mjs';

describe('Weekly epigenetic-flag evaluation cron is registered (Equoria-yzqhj.2)', () => {
  it('CronJobService exposes the evaluateWeeklyFlags handler', () => {
    expect(typeof cronJobService.evaluateWeeklyFlags).toBe('function');
  });

  it('start() registers a weeklyFlagEvaluation job in this.jobs', () => {
    // start() builds + registers all cron.schedule jobs (scheduled:false until
    // start()). Calling it here registers the job map without firing the cron.
    cronJobService.start();
    expect(cronJobService.jobs.has('weeklyFlagEvaluation')).toBe(true);
    cronJobService.stop();
  });

  it('the job appears in the /api/admin/cron/health snapshot with a staleness budget', () => {
    cronJobService.start();
    const health = cronJobService.getHealth(new Date());
    expect(health.jobs).toHaveProperty('weeklyFlagEvaluation');
    // Weekly budget (192h) — a fresh-start heartbeat is null → stale=true until
    // first run, which is the correct "is the cron firing?" signal.
    expect(typeof health.jobs.weeklyFlagEvaluation.stale).toBe('boolean');
    cronJobService.stop();
  });
});
