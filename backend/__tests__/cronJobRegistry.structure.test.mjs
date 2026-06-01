/**
 * Structural sentinel for the cron job registry (Equoria-fx4e7 cronJobs split).
 *
 * The 1510-line cronJobs.mjs was split: each scheduled job's metadata + wiring
 * now lives in a per-job descriptor module under backend/services/jobs/, and
 * CronJobService.start() iterates the ordered CRON_JOB_REGISTRY instead of ten
 * inline cron.schedule(...) blocks.
 *
 * This test locks the structural contract the split depends on:
 *   1. Every descriptor exports a valid schedule string + a `run` thunk (the
 *      "schedule string + async impl" the AC requires) + jobName / applyLock /
 *      staleAfterMs.
 *   2. The registry order is byte-identical to the original this.jobs.set(...)
 *      sequence, so getStatus()/getHealth() iteration order is preserved.
 *   3. start() registers all 10 jobs and getHealth() reports them in that exact
 *      order with byte-identical staleness budgets and schedules — i.e. no
 *      behaviour change vs. the pre-split inline registration.
 *
 * Real-DB note: this suite touches no DB. It only inspects the registry shape
 * and the in-memory job map produced by start() (which schedules nothing
 * because each cron.schedule is created with { scheduled: false } and the test
 * stops the service immediately).
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { CRON_JOB_REGISTRY } from '../services/jobs/index.mjs';
import cronJobService from '../services/cronJobs.mjs';

// The canonical job order + schedules + staleness budgets that existed as inline
// literals before the split. Any drift here is a behaviour change, not a refactor.
const EXPECTED_JOBS = [
  { jobName: 'dailyTraitEvaluation', schedule: '0 0 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'dailyHorseAging', schedule: '5 0 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'dailyFoalMilestoneEvaluation', schedule: '10 0 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'weeklyRiderTrainerCareerWeeks', schedule: '15 0 * * 1', staleAfterMs: 192 * 60 * 60 * 1000 },
  { jobName: 'electionStatusTransition', schedule: '*/15 * * * *', staleAfterMs: 30 * 60 * 1000 },
  { jobName: 'nightlyShowExecution', schedule: '0 3 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'auditLogRetention', schedule: '30 3 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'hoofConditionDecay', schedule: '45 3 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
  { jobName: 'weeklyFlagEvaluation', schedule: '30 0 * * 1', staleAfterMs: 192 * 60 * 60 * 1000 },
  { jobName: 'temporaryFlagExpiry', schedule: '20 0 * * *', staleAfterMs: 30 * 60 * 60 * 1000 },
];

afterEach(() => {
  if (cronJobService.isRunning) {
    cronJobService.stop();
  }
});

describe('cron job registry structure (Equoria-fx4e7)', () => {
  it('exports exactly 10 descriptors in the original registration order', () => {
    expect(CRON_JOB_REGISTRY).toHaveLength(EXPECTED_JOBS.length);
    expect(CRON_JOB_REGISTRY.map(j => j.jobName)).toEqual(EXPECTED_JOBS.map(j => j.jobName));
  });

  it('every descriptor exports a schedule string + applyLock + staleAfterMs + a run thunk', () => {
    for (const job of CRON_JOB_REGISTRY) {
      expect(typeof job.jobName).toBe('string');
      expect(job.jobName.length).toBeGreaterThan(0);
      // schedule must be a non-empty cron string
      expect(typeof job.schedule).toBe('string');
      expect(job.schedule.length).toBeGreaterThan(0);
      // every production schedule runs under the advisory lock
      expect(job.applyLock).toBe(true);
      // staleness budget must be a positive number
      expect(typeof job.staleAfterMs).toBe('number');
      expect(job.staleAfterMs).toBeGreaterThan(0);
      // the "async impl" the AC requires: a callable thunk
      expect(typeof job.run).toBe('function');
    }
  });

  it('each descriptor schedule + staleness is byte-identical to the pre-split literals', () => {
    for (const expected of EXPECTED_JOBS) {
      const actual = CRON_JOB_REGISTRY.find(j => j.jobName === expected.jobName);
      expect(actual).toBeDefined();
      expect(actual.schedule).toBe(expected.schedule);
      expect(actual.staleAfterMs).toBe(expected.staleAfterMs);
    }
  });

  it('run(service) invokes the matching CronJobService instance method', () => {
    // Map each jobName to the method name its run thunk must call. Proves the
    // wiring is correct without executing any DB work: we pass a stub whose
    // methods record their own invocation.
    const expectedMethod = {
      dailyTraitEvaluation: 'evaluateDailyFoalTraits',
      dailyHorseAging: 'processHorseAging',
      dailyFoalMilestoneEvaluation: 'processFoalMilestones',
      weeklyRiderTrainerCareerWeeks: 'tickRiderTrainerCareerWeeks',
      electionStatusTransition: 'transitionElectionStatuses',
      nightlyShowExecution: 'executeOvernightShows',
      auditLogRetention: 'purgeExpiredAuditLogs',
      hoofConditionDecay: 'decayHoofConditions',
      weeklyFlagEvaluation: 'evaluateWeeklyFlags',
      temporaryFlagExpiry: 'sweepExpiredTemporaryFlags',
    };

    for (const job of CRON_JOB_REGISTRY) {
      const called = [];
      const stub = {};
      // Build a stub that records which method the run thunk calls.
      for (const m of Object.values(expectedMethod)) {
        stub[m] = () => {
          called.push(m);
          return Promise.resolve();
        };
      }
      job.run(stub);
      expect(called).toEqual([expectedMethod[job.jobName]]);
    }
  });
});

describe('CronJobService.start() registry wiring (Equoria-fx4e7)', () => {
  it('registers all 10 jobs and getHealth reports them in registry order with identical staleness', () => {
    cronJobService.start();

    const status = cronJobService.getStatus();
    expect(status.totalJobs).toBe(EXPECTED_JOBS.length);
    expect(status.serviceRunning).toBe(true);

    const health = cronJobService.getHealth();
    const reportedOrder = Object.keys(health.jobs);
    expect(reportedOrder).toEqual(EXPECTED_JOBS.map(j => j.jobName));

    for (const expected of EXPECTED_JOBS) {
      expect(health.jobs[expected.jobName].stalenessMs).toBe(expected.staleAfterMs);
    }
  });
});
