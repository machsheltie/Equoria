import { describe, afterAll, expect, it } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
  getFoalDevelopment,
  completeActivity,
  advanceDay,
  completeEnrichmentActivity,
  getAvailableActivities,
} from '../models/foalModel.mjs';

/**
 * Foal Model Tests
 *
 * getAvailableActivities is a pure function — tested with plain JS, no DB.
 * Input-validation tests (invalid IDs, empty strings) throw before any DB
 * call and therefore need no fixtures.
 *
 * All other tests are DB integration tests using TestFixture-FoalModel-*
 * prefixed Horse records. Deleting the horse cascades to foalDevelopment,
 * foalActivities, and foalTrainingHistory, so cleanup is a single horse.delete.
 */

const PREFIX = 'TestFixture-FoalModel-';
const DATE_OF_BIRTH = new Date('2020-01-01');

const MS_PER_DAY = 1000 * 60 * 60 * 24;
// A dateOfBirth N whole days ago, anchored off-midnight UTC so date-only age
// math (Equoria-g89vy enrichment derived-day) is exercised honestly.
function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

async function mkFoal(suffix, opts = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: opts.sex ?? 'Colt',
      dateOfBirth: opts.dateOfBirth ?? DATE_OF_BIRTH,
      age: opts.age ?? 0,
      ...(opts.bondScore !== undefined && { bondScore: opts.bondScore }),
      ...(opts.stressLevel !== undefined && { stressLevel: opts.stressLevel }),
    },
  });
}

async function mkDev(foalId, opts = {}) {
  return prisma.foalDevelopment.create({
    data: {
      foalId,
      currentDay: opts.currentDay ?? 0,
      bondingLevel: opts.bondingLevel ?? 50,
      stressLevel: opts.stressLevel ?? 20,
      completedActivities: opts.completedActivities ?? {},
    },
  });
}

// Per-test cleanup (called from each test's finally). Fail-loud + idempotent
// (Equoria-n7qa3): a scoped `deleteMany({ where: { id } })` is a no-op (count
// 0) when the row is already gone — so it does NOT throw P2025 and cannot mask
// a test-body assertion the way a re-throwing `.delete()` would. But a REAL
// scope/FK failure now reds the test instead of being swallowed by the former
// silent empty-arm catch. Foals here have no userId (mkFoal omits it); deleting
// the horse cascades foalDevelopment/foalActivity/foalTrainingHistory, so a
// single scoped horse delete is sufficient.
async function rmFoal(foalId) {
  await prisma.horse.deleteMany({ where: { id: foalId } });
}

// Safety-net cleanup in case any test's finally block was skipped. Already
// fail-loud (no .catch) and scoped to the TestFixture-FoalModel- prefix.
afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

// ─── Pure function: getAvailableActivities ────────────────────────────────────

describe('getAvailableActivities', () => {
  it('returns activities for day 0', () => {
    const activities = getAvailableActivities(0, {});
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThan(0);
    const types = activities.map(a => a.type);
    expect(types).toContain('gentle_touch');
    expect(types).toContain('quiet_presence');
    expect(types).toContain('soft_voice');
  });

  it('returns different activities for different days', () => {
    const day0Types = getAvailableActivities(0, {}).map(a => a.type);
    const day3Types = getAvailableActivities(3, {}).map(a => a.type);
    expect(day0Types).not.toContain('halter_introduction');
    expect(day3Types).toContain('halter_introduction');
  });

  it('filters out completed activities', () => {
    const types = getAvailableActivities(0, { 0: ['gentle_touch'] }).map(a => a.type);
    expect(types).not.toContain('gentle_touch');
    expect(types).toContain('quiet_presence');
  });

  it('returns empty array for invalid day', () => {
    expect(getAvailableActivities(99, {})).toEqual([]);
  });

  it('handles missing completedActivities gracefully', () => {
    const activities = getAvailableActivities(0);
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThan(0);
  });
});

// ─── getFoalDevelopment ───────────────────────────────────────────────────────

describe('getFoalDevelopment', () => {
  it('throws for invalid foal ID', async () => {
    await expect(getFoalDevelopment('invalid')).rejects.toThrow('Foal ID must be a positive integer');
    await expect(getFoalDevelopment(-1)).rejects.toThrow('Foal ID must be a positive integer');
    await expect(getFoalDevelopment(0)).rejects.toThrow('Foal ID must be a positive integer');
  });

  it('throws for non-existent horse', async () => {
    await expect(getFoalDevelopment(999999999)).rejects.toThrow('Foal not found');
  });

  it('throws for horse older than 1 year', async () => {
    const foal = await mkFoal('Adult-5', { age: 5 });
    try {
      await expect(getFoalDevelopment(foal.id)).rejects.toThrow('Horse is not a foal (must be 1 year old or younger)');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('throws for 2-year-old horse (boundary)', async () => {
    const foal = await mkFoal('Adult-2', { age: 2 });
    try {
      await expect(getFoalDevelopment(foal.id)).rejects.toThrow('Horse is not a foal (must be 1 year old or younger)');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('accepts 1-year-old horse (yearling boundary)', async () => {
    const foal = await mkFoal('Yearling', { age: 1 });
    try {
      await mkDev(foal.id, { currentDay: 1, bondingLevel: 55, stressLevel: 18 });
      const result = await getFoalDevelopment(foal.id);
      expect(result.foal.name).toBe(`${PREFIX}Yearling`);
      expect(result.development.currentDay).toBe(1);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('returns full development data with all expected fields', async () => {
    const foal = await mkFoal('FullData', { age: 0 });
    try {
      await mkDev(foal.id, {
        currentDay: 2,
        bondingLevel: 60,
        stressLevel: 15,
        completedActivities: { 0: ['gentle_touch'], 1: ['feeding_assistance'] },
      });
      const result = await getFoalDevelopment(foal.id);
      expect(result).toHaveProperty('foal');
      expect(result).toHaveProperty('development');
      expect(result).toHaveProperty('activityHistory');
      expect(result).toHaveProperty('availableActivities');
      expect(result.development.currentDay).toBe(2);
      expect(result.development.bondingLevel).toBe(60);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it("surfaces the derived enrichment day and that day's activities (Equoria-g89vy)", async () => {
    // dob 3 days ago → derived enrichment day 3; window open.
    const foal = await mkFoal('EnrichDayOpen', { dateOfBirth: dobDaysAgo(3) });
    try {
      const result = await getFoalDevelopment(foal.id);
      expect(result.development.enrichmentDay).toBe(3);
      expect(result.development.enrichmentWindowOpen).toBe(true);
      expect(Array.isArray(result.availableEnrichmentActivities)).toBe(true);
      // Day-3 activities include Trailer Exposure.
      expect(result.availableEnrichmentActivities.map(a => a.type)).toContain('trailer_exposure');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('reports a closed enrichment window with no activities once aged past day 6 (Equoria-g89vy)', async () => {
    // dob 8 days ago → derived day 8 > 6; window closed.
    const foal = await mkFoal('EnrichDayClosed', { age: 1, dateOfBirth: dobDaysAgo(8) });
    try {
      const result = await getFoalDevelopment(foal.id);
      expect(result.development.enrichmentWindowOpen).toBe(false);
      expect(result.availableEnrichmentActivities).toEqual([]);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('returns availableActivities for day 0 including gentle_touch', async () => {
    const foal = await mkFoal('Day0Activities', { age: 0 });
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: {} });
      const result = await getFoalDevelopment(foal.id);
      expect(Array.isArray(result.availableActivities)).toBe(true);
      expect(result.availableActivities.length).toBeGreaterThan(0);
      expect(result.availableActivities.map(a => a.type)).toContain('gentle_touch');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('filters completed activities from availableActivities', async () => {
    const foal = await mkFoal('FilterCompleted', { age: 0 });
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: { 0: ['gentle_touch'] } });
      const result = await getFoalDevelopment(foal.id);
      const types = result.availableActivities.map(a => a.type);
      expect(types).not.toContain('gentle_touch');
      expect(types).toContain('quiet_presence');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('auto-creates development record for foal with no existing record', async () => {
    const foal = await mkFoal('NoDev', { age: 0 });
    try {
      const result = await getFoalDevelopment(foal.id);
      expect(result.development.currentDay).toBe(0);
      expect(result.development.bondingLevel).toBe(50);
      expect(result.development.stressLevel).toBe(20);
    } finally {
      await rmFoal(foal.id);
    }
  });
});

// ─── completeActivity ─────────────────────────────────────────────────────────

describe('completeActivity', () => {
  it('throws for invalid foal ID', async () => {
    await expect(completeActivity('invalid', 'gentle_touch')).rejects.toThrow('Foal ID must be a positive integer');
  });

  it('throws for missing activity type', async () => {
    await expect(completeActivity(1, '')).rejects.toThrow('Activity type is required');
  });

  it('throws when development record does not exist', async () => {
    const foal = await mkFoal('NoDevCA');
    try {
      await expect(completeActivity(foal.id, 'gentle_touch')).rejects.toThrow('Foal development record not found');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('throws when activity is already completed', async () => {
    const foal = await mkFoal('AlreadyDone');
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: { 0: ['gentle_touch'] } });
      await expect(completeActivity(foal.id, 'gentle_touch')).rejects.toThrow(
        'Activity not available for current day or already completed',
      );
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('completes available activity and returns updated development', async () => {
    const foal = await mkFoal('CompleteOK');
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: {} });
      const result = await completeActivity(foal.id, 'gentle_touch');
      expect(result).toHaveProperty('foal');
      expect(result).toHaveProperty('development');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('records completed activity in completedActivities for current day', async () => {
    const foal = await mkFoal('UpdateRecord');
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: {} });
      const result = await completeActivity(foal.id, 'gentle_touch');
      const dayActivities = result.development.completedActivities[0] || result.development.completedActivities['0'];
      expect(dayActivities).toContain('gentle_touch');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('appends to existing completed activities for the same day', async () => {
    const foal = await mkFoal('AppendCA');
    try {
      await mkDev(foal.id, { currentDay: 0, completedActivities: { 0: ['quiet_presence'] } });
      const result = await completeActivity(foal.id, 'gentle_touch');
      const dayActivities = result.development.completedActivities[0] || result.development.completedActivities['0'];
      expect(dayActivities).toContain('quiet_presence');
      expect(dayActivities).toContain('gentle_touch');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('keeps bondingLevel within 0-100 bounds', async () => {
    const foal = await mkFoal('BondBounds');
    try {
      await mkDev(foal.id, { currentDay: 0, bondingLevel: 98, completedActivities: {} });
      const result = await completeActivity(foal.id, 'gentle_touch');
      expect(result.development.bondingLevel).toBeLessThanOrEqual(100);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('keeps stressLevel at or above 0', async () => {
    const foal = await mkFoal('StressBounds');
    try {
      await mkDev(foal.id, { currentDay: 0, stressLevel: 2, completedActivities: {} });
      const result = await completeActivity(foal.id, 'gentle_touch');
      expect(result.development.stressLevel).toBeGreaterThanOrEqual(0);
    } finally {
      await rmFoal(foal.id);
    }
  });
});

// ─── advanceDay ───────────────────────────────────────────────────────────────

describe('advanceDay', () => {
  it('throws for invalid foal ID', async () => {
    await expect(advanceDay('invalid')).rejects.toThrow('Foal ID must be a positive integer');
  });

  it('advances foal to next development day', async () => {
    const foal = await mkFoal('AdvanceDay');
    try {
      await mkDev(foal.id, { currentDay: 2 });
      const result = await advanceDay(foal.id);
      expect(result.development.currentDay).toBe(3);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('throws when foal has already completed 7-day development period', async () => {
    const foal = await mkFoal('AlreadyGrad');
    try {
      await mkDev(foal.id, { currentDay: 6 });
      await expect(advanceDay(foal.id)).rejects.toThrow('Foal has already completed development period');
    } finally {
      await rmFoal(foal.id);
    }
  });
});

// ─── completeEnrichmentActivity ───────────────────────────────────────────────

describe('completeEnrichmentActivity (derived-day contract, Equoria-g89vy)', () => {
  it('throws when activity is not appropriate for the derived day', async () => {
    // dob today → derived day 0; halter_introduction is a day-3 activity.
    const foal = await mkFoal('WrongDay', { dateOfBirth: dobDaysAgo(0) });
    try {
      await expect(completeEnrichmentActivity(foal.id, 'halter_introduction')).rejects.toThrow(
        'Activity "halter_introduction" is not appropriate for day 0',
      );
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('throws "window closed" when the foal has aged past day 6', async () => {
    // dob 8 days ago → derived day 8 > 6: the enrichment window is closed.
    const foal = await mkFoal('AgedOut', { age: 1, dateOfBirth: dobDaysAgo(8) });
    try {
      await expect(completeEnrichmentActivity(foal.id, 'gentle_touch')).rejects.toThrow(/window closed/i);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('completes enrichment activity and returns result with all expected fields', async () => {
    const foal = await mkFoal('EnrichOK', {
      dateOfBirth: dobDaysAgo(0),
      bondScore: 50,
      stressLevel: 20,
    });
    try {
      const result = await completeEnrichmentActivity(foal.id, 'gentle_touch');
      expect(result.success).toBe(true);
      expect(result.foal.name).toBe(`${PREFIX}EnrichOK`);
      expect(result.activity.name).toBe('Gentle Touch');
      expect(result.activity.day).toBe(0);
      expect(result.levels).toHaveProperty('bondScore');
      expect(result.levels).toHaveProperty('stressLevel');
      expect(result.trainingRecordId).toBeDefined();
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('anti-farming: rejects repeating the same activity on the same derived day', async () => {
    const foal = await mkFoal('EnrichDedup', { dateOfBirth: dobDaysAgo(0) });
    try {
      await completeEnrichmentActivity(foal.id, 'gentle_touch');
      await expect(completeEnrichmentActivity(foal.id, 'gentle_touch')).rejects.toThrow(/already completed/i);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('keeps bondScore and stressLevel within 0-100 bounds', async () => {
    const foal = await mkFoal('EnrichBounds', {
      dateOfBirth: dobDaysAgo(0),
      bondScore: 98,
      stressLevel: 2,
    });
    try {
      const result = await completeEnrichmentActivity(foal.id, 'gentle_touch');
      expect(result.levels.bondScore).toBeLessThanOrEqual(100);
      expect(result.levels.stressLevel).toBeGreaterThanOrEqual(0);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('uses default values when bondScore and stressLevel are null', async () => {
    const foal = await mkFoal('EnrichNulls', { dateOfBirth: dobDaysAgo(0) });
    try {
      const result = await completeEnrichmentActivity(foal.id, 'gentle_touch');
      expect(result.success).toBe(true);
      expect(result.levels).toHaveProperty('bondScore');
      expect(result.levels).toHaveProperty('stressLevel');
    } finally {
      await rmFoal(foal.id);
    }
  });
});
