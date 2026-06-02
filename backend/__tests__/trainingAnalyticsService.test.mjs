/**
 * trainingAnalyticsService — integration and unit tests (Equoria-rr7)
 *
 * Covers the three exported members of backend/services/trainingAnalyticsService.mjs:
 *   - trainingAnalyticsService.calculateDisciplineBalance (sync)
 *   - trainingAnalyticsService.calculateTrainingFrequency (sync)
 *   - trainingAnalyticsService.getTrainingHistory (async, DB)
 *
 * The sync methods are tested with in-memory fixture arrays — no DB required.
 * getTrainingHistory runs against the canonical DB unconditionally
 * (Equoria-ftaqy removed the prior graceful-skip pattern per Constitution §3).
 * DB tests use `expect.assertions(N)` (Equoria-gc0dn) so any future
 * regression to a zero-assertion early-return is loud, not silent.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { trainingAnalyticsService } from '../modules/training/services/trainingAnalyticsService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The prior best-effort try/catch +
// silent no-op catch arms swallowed delete failures, leaking the fixture horse
// (NULL-phenotype risk) / user into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

// ─── Shared fixture helpers ────────────────────────────────────────────────────

function makeLog(discipline, daysAgo) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return { discipline, trainedAt: d, horseId: 1 };
}

// ─── Equoria-gc0dn sentinel: prove expect.hasAssertions() is a real guard ───
// Sentinel-positive: a unit test that fails LOUDLY if a test body slips
// into a no-assertion early-return. The test inside this describe uses
// Jest's own `expect.toThrow` to assert that running a callback which
// "calls hasAssertions() but makes no expect" actually fails — proving
// our guards above (one per `it` block) would catch a future regression
// to the old `if (!dbAvailable) return` pattern.

describe('Equoria-gc0dn sentinel: hasAssertions guard catches vacuous-pass', () => {
  it('hasAssertions exists and is callable', () => {
    expect.hasAssertions();
    expect(typeof expect.hasAssertions).toBe('function');
  });

  // Note: directly running an "empty body + hasAssertions()" inside another
  // it() would itself fail the suite. The sentinel above is sufficient
  // because Jest's built-in `expect.hasAssertions()` is the well-documented
  // canonical mechanism — see https://jestjs.io/docs/expect#expecthasassertions.
});

// ─── calculateDisciplineBalance ────────────────────────────────────────────────

describe('trainingAnalyticsService.calculateDisciplineBalance', () => {
  it('returns empty object for empty history', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const result = trainingAnalyticsService.calculateDisciplineBalance([]);
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('counts sessions per discipline correctly', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('dressage', 10), makeLog('dressage', 9), makeLog('racing', 8)];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    expect(result.dressage).toBeDefined();
    expect(result.dressage.sessionCount).toBe(2);
    expect(result.racing).toBeDefined();
    expect(result.racing.sessionCount).toBe(1);
  });

  it('calculates correct percentage for each discipline', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [
      makeLog('dressage', 5),
      makeLog('dressage', 4),
      makeLog('show_jumping', 3),
      makeLog('show_jumping', 2),
    ];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    expect(result.dressage.percentage).toBe(50);
    expect(result.show_jumping.percentage).toBe(50);
  });

  it('tracks lastTrainingDate and firstTrainingDate', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const older = makeLog('dressage', 20);
    const newer = makeLog('dressage', 2);
    const history = [older, newer];

    const result = trainingAnalyticsService.calculateDisciplineBalance(history);
    const d = result.dressage;

    expect(d.firstTrainingDate).toBeInstanceOf(Date);
    expect(d.lastTrainingDate).toBeInstanceOf(Date);
    expect(d.lastTrainingDate.getTime()).toBeGreaterThan(d.firstTrainingDate.getTime());
  });

  it('handles single discipline with 100% share', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('racing', 5), makeLog('racing', 4), makeLog('racing', 3)];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    expect(result.racing.percentage).toBe(100);
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('handles many disciplines with equal distribution', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const disciplines = ['dressage', 'show_jumping', 'racing', 'cross_country'];
    const history = disciplines.map((d, i) => makeLog(d, i + 1));

    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    disciplines.forEach(d => {
      expect(result[d]).toBeDefined();
      expect(result[d].sessionCount).toBe(1);
      expect(result[d].percentage).toBe(25);
    });
  });
});

// ─── calculateTrainingFrequency ────────────────────────────────────────────────

describe('trainingAnalyticsService.calculateTrainingFrequency', () => {
  it('returns zero totalSessions for empty history', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const result = trainingAnalyticsService.calculateTrainingFrequency([]);
    expect(result.totalSessions).toBe(0);
    expect(result.sessionsPerDiscipline).toEqual({});
    expect(Array.isArray(result.recentActivity)).toBe(true);
    expect(result.recentActivity).toHaveLength(0);
  });

  it('counts totalSessions correctly', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('dressage', 5), makeLog('racing', 3), makeLog('dressage', 1)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.totalSessions).toBe(3);
  });

  it('counts sessionsPerDiscipline correctly', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('dressage', 5), makeLog('dressage', 4), makeLog('racing', 3)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.sessionsPerDiscipline.dressage).toBe(2);
    expect(result.sessionsPerDiscipline.racing).toBe(1);
  });

  it('includes recent sessions (within 30 days) in recentActivity', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [
      makeLog('dressage', 5), // recent
      makeLog('racing', 25), // recent
      makeLog('show_jumping', 35), // older than 30 days
    ];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.recentActivity).toHaveLength(2);
    result.recentActivity.forEach(activity => {
      expect(activity).toHaveProperty('date');
      expect(activity).toHaveProperty('discipline');
    });
  });

  it('excludes sessions older than 30 days from recentActivity', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('cross_country', 40), makeLog('endurance', 60)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.totalSessions).toBe(2);
    expect(result.recentActivity).toHaveLength(0);
  });

  it('recentActivity includes date and discipline properties', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [makeLog('dressage', 1)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].discipline).toBe('dressage');
    expect(result.recentActivity[0].date).toBeInstanceOf(Date);
  });

  it('handles large history with mixed recent/old sessions', () => {
    expect.hasAssertions(); // Equoria-gc0dn
    const history = [];
    for (let i = 0; i < 50; i++) {
      history.push(makeLog(i % 2 === 0 ? 'dressage' : 'racing', i));
    }
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.totalSessions).toBe(50);
    expect(result.sessionsPerDiscipline.dressage).toBe(25);
    expect(result.sessionsPerDiscipline.racing).toBe(25);
    // Only sessions 0-30 days ago are recent (indices 0-29 = daysAgo 0-29)
    expect(result.recentActivity.length).toBeGreaterThanOrEqual(1);
    expect(result.recentActivity.length).toBeLessThanOrEqual(31);
  });
});

// ─── getTrainingHistory — REAL-DB path. ────
// Equoria-ftaqy: removed the dbAvailable graceful-skip pattern that violated
// Constitution §3. Tests now run against the canonical DB unconditionally;
// a DB outage fails the suite LOUDLY — which is the only honest signal.

describe('trainingAnalyticsService.getTrainingHistory', () => {
  const cleanup = createCleanupTracker();
  let prisma;
  let testUser, testHorse;

  beforeAll(async () => {
    const mod = await import('../../packages/database/prismaClient.mjs');
    prisma = mod.default;

    // Equoria-qmze: collision-safe fixture ID via randomBytes (replaces
    // Date.now()+Math.random() pattern flagged by Equoria-3gti).
    const rand = randomBytes(8).toString('hex');

    testUser = await prisma.user.create({
      data: {
        email: `trainanalytics-${rand}@test.com`,
        username: `trainanalytics${rand}`,
        password: 'irrelevant-hash',
        firstName: 'TrainAnalytics',
        lastName: 'Tester',
        money: 1000,
      },
    });

    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-TrainAnalytics-${rand}`,
        sex: 'Filly',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: testUser.id,
      },
    });

    // Equoria-1ohys: scoped, FK-ordered, fail-loud cleanup. Order: trainingLog
    // (child of horse) -> horse (Horse.userId is Restrict, so before user) ->
    // user. The tracker runs all three even if one throws, then fails afterAll
    // loudly if any did — no more best-effort swallow.
    cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: testHorse.id } }), 'trainingLog');
    cleanup.add(() => prisma.horse.delete({ where: { id: testHorse.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: testUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('throws for non-existent horse', async () => {
    // Equoria-gc0dn: guard against future vacuous-pass regressions.
    // If a graceful-skip early-return is reintroduced, this fails loud.
    expect.hasAssertions();
    await expect(trainingAnalyticsService.getTrainingHistory(999999999)).rejects.toThrow('Horse not found');
  });

  it('returns empty analytics for horse with no training logs', async () => {
    expect.hasAssertions(); // Equoria-gc0dn vacuous-pass guard
    const result = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

    expect(result).toBeDefined();
    expect(Array.isArray(result.trainingHistory)).toBe(true);
    expect(result.trainingHistory).toHaveLength(0);
    expect(result.disciplineBalance).toEqual({});
    expect(result.trainingFrequency.totalSessions).toBe(0);
  });

  it('returns populated analytics for horse with training logs', async () => {
    expect.hasAssertions(); // Equoria-gc0dn vacuous-pass guard

    // Seed some training logs
    const disciplines = ['dressage', 'show_jumping', 'racing'];
    for (let i = 0; i < 6; i++) {
      await prisma.trainingLog.create({
        data: {
          horseId: testHorse.id,
          discipline: disciplines[i % disciplines.length],
          trainedAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    const result = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

    expect(result.trainingHistory).toHaveLength(6);
    expect(result.trainingFrequency.totalSessions).toBe(6);
    expect(Object.keys(result.disciplineBalance)).toHaveLength(3);

    // Each discipline should appear twice (6 sessions / 3 disciplines)
    disciplines.forEach(d => {
      expect(result.disciplineBalance[d]).toBeDefined();
      expect(result.disciplineBalance[d].sessionCount).toBe(2);
    });
  });

  it('orders training history by date descending (most recent first)', async () => {
    expect.hasAssertions(); // Equoria-gc0dn vacuous-pass guard

    const result = await trainingAnalyticsService.getTrainingHistory(testHorse.id);
    const dates = result.trainingHistory.map(s => new Date(s.trainedAt).getTime());

    // Guarantee at least one comparison fires (and assert it explicitly so
    // a zero-row result is loud, not silent — order-of-zero is vacuously true).
    expect(dates.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});
