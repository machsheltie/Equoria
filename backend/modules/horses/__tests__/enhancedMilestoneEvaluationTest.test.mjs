/**
 * cronJobs (service) unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests the exported singleton's start/stop lifecycle — does not actually
 * schedule background work (cron schedules but jobs don't run in tests).
 *
 * The utils/enhancedMilestoneEvaluation cases that lived here were removed with
 * that module (Equoria-a7f1p): its only caller was the retired
 * POST /epigenetic-traits/evaluate-milestone route (owner ruling 2026-10-27:
 * traits reveal only through the daily grooming-day ladder). The nightly
 * milestone job uses enhancedMilestoneEvaluationSystem, which is unchanged.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import cronJobService from '../../../services/cronJobs.mjs';

afterAll(() => {
  // Stop any accidentally-started cron service
  if (cronJobService.isRunning) {
    cronJobService.stop();
  }
});

// ── cronJobs ──────────────────────────────────────────────────────────────────

describe('cronJobService', () => {
  it('is not running at import time', () => {
    expect(cronJobService.isRunning).toBe(false);
  });

  it('start() sets isRunning to true', () => {
    cronJobService.start();
    expect(cronJobService.isRunning).toBe(true);
    cronJobService.stop(); // clean up immediately
    expect(cronJobService.isRunning).toBe(false);
  });

  it('calling start() twice (idempotent — already running warning)', () => {
    cronJobService.start();
    expect(() => cronJobService.start()).not.toThrow();
    cronJobService.stop();
  });

  it('calling stop() when not running does not throw', () => {
    expect(() => cronJobService.stop()).not.toThrow();
  });
});
