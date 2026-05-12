/**
 * CronJobService — pure branch-coverage tests (Equoria-jkht)
 *
 * Targets branches reachable without any database call:
 *   start()  — isRunning guard (second call returns early)
 *   stop()   — !isRunning guard (call before start returns early)
 *   evaluateFoalTraits() — currentDay > 6 early return (no DB)
 *   getStatus() — before and after start (pure getter)
 *
 * Tests that would reach prisma.horse.update (currentDay <= 6 paths) are
 * intentionally omitted because evaluateTraitRevelation uses Math.random —
 * a revealed trait triggers a DB update for a non-existent ID, making those
 * paths non-deterministic and unsafe to assert against.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import cronJobService from '../../services/cronJobs.mjs';

// Restore singleton to clean state after every test so tests don't bleed.
afterEach(() => {
  if (cronJobService.isRunning) {
    cronJobService.stop();
  }
});

// ─── getStatus() ─────────────────────────────────────────────────────────────

describe('CronJobService.getStatus()', () => {
  it('returns serviceRunning:false and totalJobs:0 before start', () => {
    const status = cronJobService.getStatus();
    expect(status.serviceRunning).toBe(false);
    expect(status.totalJobs).toBe(0);
    expect(typeof status.jobs).toBe('object');
  });

  it('returns serviceRunning:true, totalJobs:2, and both job keys after start', () => {
    cronJobService.start();
    const status = cronJobService.getStatus();
    expect(status.serviceRunning).toBe(true);
    expect(status.totalJobs).toBe(2);
    expect(status.jobs).toHaveProperty('dailyTraitEvaluation');
    expect(status.jobs).toHaveProperty('dailyHorseAging');
  });
});

// ─── start() ─────────────────────────────────────────────────────────────────

describe('CronJobService.start()', () => {
  it('sets isRunning to true on first call', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);
  });

  it('second start() call (isRunning branch) warns and returns without throwing', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);

    // covers the `if (this.isRunning) { return; }` branch
    expect(() => cronJobService.start()).not.toThrow();

    // service remains running; no duplicate jobs added
    expect(cronJobService.isRunning).toBe(true);
    expect(cronJobService.getStatus().totalJobs).toBe(2);
  });
});

// ─── stop() ──────────────────────────────────────────────────────────────────

describe('CronJobService.stop()', () => {
  it('sets isRunning to false after a successful stop', () => {
    cronJobService.start();
    cronJobService.stop();
    expect(cronJobService.isRunning).toBe(false);
  });

  it('stop() before start (!isRunning branch) warns and returns without throwing', () => {
    // Precondition: service is not running
    expect(cronJobService.isRunning).toBe(false);

    // covers the `if (!this.isRunning) { return; }` branch
    expect(() => cronJobService.stop()).not.toThrow();

    expect(cronJobService.isRunning).toBe(false);
  });

  it('start → stop → getStatus reflects stopped state', () => {
    cronJobService.start();
    expect(cronJobService.getStatus().serviceRunning).toBe(true);

    cronJobService.stop();
    expect(cronJobService.getStatus().serviceRunning).toBe(false);
  });
});

// ─── evaluateFoalTraits() — pure early-exit branch ───────────────────────────

describe('CronJobService.evaluateFoalTraits() — currentDay > 6 early exit', () => {
  it('returns development_complete when currentDay is 7', async () => {
    const foal = {
      id: 999901,
      name: 'TestFoal-CronBranch-7',
      foalDevelopment: { currentDay: 7 },
      epigeneticModifiers: null,
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result).toEqual({ traitsRevealed: 0, reason: 'development_complete' });
  });

  it('returns development_complete when currentDay is 20', async () => {
    const foal = {
      id: 999902,
      name: 'TestFoal-CronBranch-20',
      foalDevelopment: { currentDay: 20 },
      epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [] },
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result.reason).toBe('development_complete');
    expect(result.traitsRevealed).toBe(0);
  });

  it('returns development_complete when currentDay is exactly boundary+1 (day 7)', async () => {
    // Boundary: day 6 is still in development; day 7 exits early
    const foal = {
      id: 999903,
      name: 'TestFoal-CronBranch-boundary',
      foalDevelopment: { currentDay: 7 },
      epigeneticModifiers: null,
    };
    const result = await cronJobService.evaluateFoalTraits(foal);
    expect(result).toEqual({ traitsRevealed: 0, reason: 'development_complete' });
  });
});
