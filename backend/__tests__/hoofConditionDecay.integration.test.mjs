/**
 * Hoof-Condition Decay — REAL DB integration (Equoria-gg3v, farrier
 * re-booking loop).
 *
 * Verifies the decay-only nightly step:
 *   - a horse overdue for a farrier visit is stepped down toward `poor`
 *     (one rung per elapsed HOOF_CONDITION_DECAY_DAYS interval),
 *   - a freshly-shod horse (lastFarrierDate ≈ now) is NEVER knocked down,
 *   - a horse with no lastFarrierDate is skipped (no anchor),
 *   - the operation is idempotent (re-running the same "now" is a no-op
 *     after the first pass — expected level is a pure function of elapsed
 *     time, not cron-run count),
 *   - a very-overdue horse cascades multiple rungs in a single pass.
 *
 * Runs against the canonical Equoria DB (CLAUDE.md real-DB rule). Fixtures
 * are filtered by a unique name sentinel so a loose query can never touch
 * real horse rows, and cleanup is scoped to that sentinel.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import {
  decayHoofConditions,
  getDecayDays,
  expectedLevel,
  levelOf,
  DEFAULT_DECAY_DAYS,
  MIN_DECAY_DAYS,
  HOOF_CONDITION_LADDER,
  EXCELLENT_LEVEL,
} from '../modules/horses/index.mjs';

const SENTINEL = `TestFixture-HoofDecay-${randomBytes(6).toString('hex')}`;
const DECAY_DAYS = 30;

let user;

async function cleanup() {
  await prisma.horse.deleteMany({ where: { name: { startsWith: SENTINEL } } });
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `hoofdecay-${randomBytes(6).toString('hex')}@test.com`,
      username: `hoofdecay${randomBytes(6).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Hoof',
      lastName: 'Decay',
      money: 0,
    },
  });
});

beforeEach(cleanup);

// Equoria-0hgpw: FK-ordered, fail-loud suite teardown. Horse.userId is
// onDelete: Restrict (schema.prisma:282) — the SENTINEL-scoped horse sweep MUST
// run before the user delete, and a failed sweep must RED the suite rather than
// be swallowed by a silent no-op catch arm (which would leak the horse +
// FK-block + hide the user delete in the canonical DB). Both deletes stay
// scoped (name sentinel / this user's id).
const suiteCleanup = createCleanupTracker();
afterAll(async () => {
  delete process.env.HOOF_CONDITION_DECAY_DAYS;
  suiteCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: SENTINEL } } }), 'horses');
  suiteCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  await suiteCleanup.run();
});

function daysAgo(now, days) {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function makeHorse(suffix, hoofCondition, lastFarrierDate) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SENTINEL}-${suffix}`,
      sex: 'Mare',
      dateOfBirth: new Date('2017-01-01'),
      age: 8,
      userId: user.id,
      healthStatus: 'Good',
      hoofCondition,
      lastFarrierDate,
    },
  });
}

async function conditionOf(suffix) {
  const h = await prisma.horse.findFirst({
    where: { name: `${SENTINEL}-${suffix}` },
    select: { hoofCondition: true },
  });
  return h?.hoofCondition;
}

describe('getDecayDays', () => {
  afterAll(() => delete process.env.HOOF_CONDITION_DECAY_DAYS);

  it('defaults to DEFAULT_DECAY_DAYS when env unset', () => {
    delete process.env.HOOF_CONDITION_DECAY_DAYS;
    expect(getDecayDays()).toBe(DEFAULT_DECAY_DAYS);
  });

  it('honours a valid HOOF_CONDITION_DECAY_DAYS override', () => {
    process.env.HOOF_CONDITION_DECAY_DAYS = '45';
    expect(getDecayDays()).toBe(45);
  });

  it('clamps to MIN_DECAY_DAYS when env is below the floor', () => {
    process.env.HOOF_CONDITION_DECAY_DAYS = '1';
    expect(getDecayDays()).toBe(MIN_DECAY_DAYS);
  });

  it('falls back to default on non-numeric / non-positive env', () => {
    process.env.HOOF_CONDITION_DECAY_DAYS = 'nope';
    expect(getDecayDays()).toBe(DEFAULT_DECAY_DAYS);
    process.env.HOOF_CONDITION_DECAY_DAYS = '0';
    expect(getDecayDays()).toBe(DEFAULT_DECAY_DAYS);
  });
});

describe('expectedLevel (pure)', () => {
  it('is the ladder top at zero elapsed days (fresh visit never knocked down)', () => {
    expect(expectedLevel(0, DECAY_DAYS)).toBe(EXCELLENT_LEVEL);
  });

  it('drops one rung per elapsed interval and floors at poor', () => {
    expect(expectedLevel(DECAY_DAYS, DECAY_DAYS)).toBe(EXCELLENT_LEVEL - 1); // good
    expect(expectedLevel(2 * DECAY_DAYS, DECAY_DAYS)).toBe(EXCELLENT_LEVEL - 2); // fair
    expect(expectedLevel(3 * DECAY_DAYS, DECAY_DAYS)).toBe(0); // poor
    expect(expectedLevel(99 * DECAY_DAYS, DECAY_DAYS)).toBe(0); // floored
  });
});

describe('levelOf', () => {
  it('maps the canonical ladder', () => {
    expect(levelOf('poor')).toBe(0);
    expect(levelOf('fair')).toBe(1);
    expect(levelOf('good')).toBe(2);
    expect(levelOf('excellent')).toBe(3);
  });
});

describe('decayHoofConditions — real DB', () => {
  it('steps an overdue horse down exactly one rung per elapsed interval', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    // good, last farrier 2 intervals ago → expected fair (one decay applied:
    // good→fair; fair→poor needs 3 intervals).
    await makeHorse('good-2int', 'good', daysAgo(now, 2 * DECAY_DAYS + 1));

    const res = await decayHoofConditions({ decayDays: DECAY_DAYS, now });

    expect(await conditionOf('good-2int')).toBe('fair');
    expect(res.decayDays).toBe(DECAY_DAYS);
    expect(res.transitions.some(t => t.from === 'good' && t.to === 'fair')).toBe(true);
  });

  it('never knocks down a freshly-shod horse (lastFarrierDate ≈ now)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await makeHorse('fresh-good', 'good', daysAgo(now, 0));
    await makeHorse('fresh-excellent', 'excellent', daysAgo(now, 1));

    await decayHoofConditions({ decayDays: DECAY_DAYS, now });

    expect(await conditionOf('fresh-good')).toBe('good');
    expect(await conditionOf('fresh-excellent')).toBe('excellent');
  });

  it('skips horses with no lastFarrierDate (no decay anchor)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await makeHorse('never-shod', 'good', null);

    await decayHoofConditions({ decayDays: DECAY_DAYS, now });

    expect(await conditionOf('never-shod')).toBe('good');
  });

  it('cascades a very-overdue horse straight to poor in one pass', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    // excellent, last farrier 3+ intervals ago → expected poor
    // (excellent→good→fair→poor cascade in a single run).
    await makeHorse('excellent-old', 'excellent', daysAgo(now, 3 * DECAY_DAYS + 1));

    await decayHoofConditions({ decayDays: DECAY_DAYS, now });

    expect(await conditionOf('excellent-old')).toBe('poor');
  });

  it('is idempotent — a second pass at the same now is a no-op', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await makeHorse('idem', 'good', daysAgo(now, 2 * DECAY_DAYS + 1));

    await decayHoofConditions({ decayDays: DECAY_DAYS, now });
    const afterFirst = await conditionOf('idem');
    expect(afterFirst).toBe('fair');

    const res2 = await decayHoofConditions({ decayDays: DECAY_DAYS, now });
    expect(await conditionOf('idem')).toBe('fair'); // unchanged
    // The sentinel horse contributed no transition on the second pass.
    expect(res2.transitions.filter(t => t.from === 'good' && t.to === 'fair').reduce((s, t) => s + t.count, 0)).toBe(0);
  });

  it('never decays below the poor floor', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await makeHorse('already-poor', 'poor', daysAgo(now, 10 * DECAY_DAYS));

    await decayHoofConditions({ decayDays: DECAY_DAYS, now });

    expect(await conditionOf('already-poor')).toBe('poor');
    expect(HOOF_CONDITION_LADDER[0]).toBe('poor');
  });

  it('clamps a sub-floor decayDays so near-current horses are not wiped', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    // 5 days since farrier. With decayDays=1 (sub-floor) clamped to MIN (7d),
    // 5 days < 1 interval → expected stays at ladder top → no decay.
    await makeHorse('subfloor', 'good', daysAgo(now, 5));

    const res = await decayHoofConditions({ decayDays: 1, now });
    expect(res.decayDays).toBe(MIN_DECAY_DAYS);
    expect(await conditionOf('subfloor')).toBe('good');
  });
});
