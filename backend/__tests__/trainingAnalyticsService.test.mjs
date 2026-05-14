/**
 * trainingAnalyticsService — integration and unit tests (Equoria-rr7)
 *
 * Covers the three exported members of backend/services/trainingAnalyticsService.mjs:
 *   - trainingAnalyticsService.calculateDisciplineBalance (sync)
 *   - trainingAnalyticsService.calculateTrainingFrequency (sync)
 *   - trainingAnalyticsService.getTrainingHistory (async, DB)
 *
 * The sync methods are tested with in-memory fixture arrays — no DB required.
 * getTrainingHistory requires a live database; those tests are skipped gracefully
 * when the DB is unavailable (connection error → test.skip pattern via try/catch
 * in beforeAll).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { trainingAnalyticsService } from '../services/trainingAnalyticsService.mjs';

// ─── Shared fixture helpers ────────────────────────────────────────────────────

function makeLog(discipline, daysAgo) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return { discipline, trainedAt: d, horseId: 1 };
}

// ─── calculateDisciplineBalance ────────────────────────────────────────────────

describe('trainingAnalyticsService.calculateDisciplineBalance', () => {
  it('returns empty object for empty history', () => {
    const result = trainingAnalyticsService.calculateDisciplineBalance([]);
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('counts sessions per discipline correctly', () => {
    const history = [makeLog('dressage', 10), makeLog('dressage', 9), makeLog('racing', 8)];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    expect(result.dressage).toBeDefined();
    expect(result.dressage.sessionCount).toBe(2);
    expect(result.racing).toBeDefined();
    expect(result.racing.sessionCount).toBe(1);
  });

  it('calculates correct percentage for each discipline', () => {
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
    const history = [makeLog('racing', 5), makeLog('racing', 4), makeLog('racing', 3)];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);

    expect(result.racing.percentage).toBe(100);
    expect(Object.keys(result)).toHaveLength(1);
  });

  it('handles many disciplines with equal distribution', () => {
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
    const result = trainingAnalyticsService.calculateTrainingFrequency([]);
    expect(result.totalSessions).toBe(0);
    expect(result.sessionsPerDiscipline).toEqual({});
    expect(Array.isArray(result.recentActivity)).toBe(true);
    expect(result.recentActivity).toHaveLength(0);
  });

  it('counts totalSessions correctly', () => {
    const history = [makeLog('dressage', 5), makeLog('racing', 3), makeLog('dressage', 1)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.totalSessions).toBe(3);
  });

  it('counts sessionsPerDiscipline correctly', () => {
    const history = [makeLog('dressage', 5), makeLog('dressage', 4), makeLog('racing', 3)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.sessionsPerDiscipline.dressage).toBe(2);
    expect(result.sessionsPerDiscipline.racing).toBe(1);
  });

  it('includes recent sessions (within 30 days) in recentActivity', () => {
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
    const history = [makeLog('cross_country', 40), makeLog('endurance', 60)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.totalSessions).toBe(2);
    expect(result.recentActivity).toHaveLength(0);
  });

  it('recentActivity includes date and discipline properties', () => {
    const history = [makeLog('dressage', 1)];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);

    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].discipline).toBe('dressage');
    expect(result.recentActivity[0].date).toBeInstanceOf(Date);
  });

  it('handles large history with mixed recent/old sessions', () => {
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

// ─── getTrainingHistory — DB-dependent path (skipped if DB is unavailable) ────

describe('trainingAnalyticsService.getTrainingHistory', () => {
  let prisma;
  let dbAvailable = false;
  let testUser, testHorse;

  beforeAll(async () => {
    try {
      const mod = await import('../../packages/database/prismaClient.mjs');
      prisma = mod.default;

      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      testUser = await prisma.user.create({
        data: {
          email: `trainanalytics-${ts}-${rand}@test.com`,
          username: `trainanalytics${ts}${rand}`,
          password: 'irrelevant-hash',
          firstName: 'TrainAnalytics',
          lastName: 'Tester',
          money: 1000,
        },
      });

      testHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-TrainAnalytics-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date('2020-01-01'),
          age: 5,
          userId: testUser.id,
        },
      });

      dbAvailable = true;
    } catch (_err) {
      dbAvailable = false;
    }
  }, 30000);

  afterAll(async () => {
    if (!dbAvailable || !prisma) {
      return;
    }
    try {
      if (testHorse?.id) {
        await prisma.trainingLog.deleteMany({ where: { horseId: testHorse.id } });
        await prisma.horse.delete({ where: { id: testHorse.id } }).catch(() => {});
      }
      if (testUser?.id) {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    } catch (_e) {
      // Best-effort cleanup
    }
  }, 30000);

  it('throws for non-existent horse', async () => {
    if (!dbAvailable) {
      console.log('DB not available — skipping DB test');
      return;
    }
    await expect(trainingAnalyticsService.getTrainingHistory(999999999)).rejects.toThrow('Horse not found');
  });

  it('returns empty analytics for horse with no training logs', async () => {
    if (!dbAvailable) {
      console.log('DB not available — skipping DB test');
      return;
    }
    const result = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

    expect(result).toBeDefined();
    expect(Array.isArray(result.trainingHistory)).toBe(true);
    expect(result.trainingHistory).toHaveLength(0);
    expect(result.disciplineBalance).toEqual({});
    expect(result.trainingFrequency.totalSessions).toBe(0);
  });

  it('returns populated analytics for horse with training logs', async () => {
    if (!dbAvailable) {
      console.log('DB not available — skipping DB test');
      return;
    }

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
    if (!dbAvailable) {
      console.log('DB not available — skipping DB test');
      return;
    }

    const result = await trainingAnalyticsService.getTrainingHistory(testHorse.id);
    const dates = result.trainingHistory.map(s => new Date(s.trainedAt).getTime());

    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});
