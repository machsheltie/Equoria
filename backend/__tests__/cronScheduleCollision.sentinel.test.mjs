/**
 * Sentinel: no two scheduled (advisory-locked) jobs may start in the same minute
 * across BOTH cron registries (Equoria-bvddn.15 / Equoria-cmw85.8, owner ruling
 * 2026-09-30).
 *
 * Why: every locked job pins one pooled connection for the duration of its
 * advisory lock, and the pool defaults to 3 connections. Jobs that start together
 * starve the pool (P2024). The fix is to stagger start minutes; this test stops
 * a future job from being registered onto an occupied minute.
 *
 * Every registered job is locked (registry A: applyLock, registry B: lockKey), so
 * every job is checked. Each cron expression is expanded to the concrete
 * minute-of-week slots it fires on, so every-N-minute jobs are checked exactly, not
 * exempted.
 */
import { describe, it, expect } from '@jest/globals';
import { CRON_JOB_REGISTRY } from '../services/jobs/index.mjs';
import { CRON_JOB_SERVICE_REGISTRY } from '../services/cron-job-service-jobs/index.mjs';

function expandField(field, min, max) {
  const values = new Set();
  for (const part of field.split(',')) {
    const [range, stepStr] = part.split('/');
    const step = stepStr === undefined ? 1 : Number(stepStr);
    let lo;
    let hi;
    if (range === '*') {
      lo = min;
      hi = max;
    } else if (range.includes('-')) {
      [lo, hi] = range.split('-').map(Number);
    } else {
      lo = Number(range);
      hi = stepStr === undefined ? lo : max;
    }
    if (![lo, hi, step].every(Number.isInteger) || step < 1 || lo < min || hi > max) {
      throw new Error(`Unsupported cron field "${field}"`);
    }
    for (let v = lo; v <= hi; v += step) {
      values.add(v);
    }
  }
  return values;
}

// Minute-of-week slots (0 = Sunday 00:00 UTC) a 5-field cron expression fires on.
export function expandToWeekSlots(expression) {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Expected 5 cron fields, got "${expression}"`);
  }
  const [minute, hour, dom, month, dow] = fields;
  if (dom !== '*' || month !== '*') {
    throw new Error(`Sentinel only models day-of-month/month wildcards: "${expression}"`);
  }
  const slots = new Set();
  for (const d of expandField(dow, 0, 6)) {
    for (const h of expandField(hour, 0, 23)) {
      for (const m of expandField(minute, 0, 59)) {
        slots.add(d * 1440 + h * 60 + m);
      }
    }
  }
  return slots;
}

// Returns [{ a, b, slot }] for every pair of jobs sharing a minute-of-week slot.
export function findCollisions(jobs) {
  const owners = new Map();
  const collisions = [];
  for (const { jobName, schedule } of jobs) {
    for (const slot of expandToWeekSlots(schedule)) {
      if (owners.has(slot)) {
        collisions.push({ a: owners.get(slot), b: jobName, slot });
      } else {
        owners.set(slot, jobName);
      }
    }
  }
  return collisions;
}

const ALL_JOBS = [...CRON_JOB_REGISTRY, ...CRON_JOB_SERVICE_REGISTRY];

describe('cron schedule collision sentinel (Equoria-bvddn.15)', () => {
  it('covers both registries and every job name is unique', () => {
    expect(CRON_JOB_REGISTRY.length).toBeGreaterThan(0);
    expect(CRON_JOB_SERVICE_REGISTRY.length).toBeGreaterThan(0);
    const names = ALL_JOBS.map(j => j.jobName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('no two jobs across BOTH registries start in the same minute', () => {
    const collisions = findCollisions(ALL_JOBS).map(c => {
      const day = Math.floor(c.slot / 1440);
      const hh = String(Math.floor((c.slot % 1440) / 60)).padStart(2, '0');
      const mm = String(c.slot % 60).padStart(2, '0');
      return `${c.a} + ${c.b} at dow=${day} ${hh}:${mm} UTC`;
    });
    expect(collisions).toEqual([]);
  });

  it('sentinel-positive: fires on a planted collision, including interval schedules', () => {
    const planted = [...ALL_JOBS, { jobName: 'plantedJob', schedule: '5 0 * * *' }];
    const collisions = findCollisions(planted);
    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions.some(c => c.b === 'plantedJob' || c.a === 'plantedJob')).toBe(true);

    // The old '*/15' election minutes would collide with dailyTraitEvaluation (00:00).
    const old = [
      { jobName: 'oldElection', schedule: '*/15 * * * *' },
      { jobName: 'dailyTraitEvaluation', schedule: '0 0 * * *' },
    ];
    expect(findCollisions(old)).not.toEqual([]);
  });
});
