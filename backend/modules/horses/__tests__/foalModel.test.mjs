import { describe, afterAll, expect, it } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import * as foalModel from '../models/foalModel.mjs';

const { getFoalDevelopment } = foalModel;

/**
 * Foal Model Tests
 *
 * Input-validation tests (invalid IDs) throw before any DB call and therefore
 * need no fixtures.
 *
 * All other tests are DB integration tests using TestFixture-FoalModel-*
 * prefixed Horse records. Deleting the horse cascades to foalDevelopment,
 * foalActivities, and foalTrainingHistory, so cleanup is a single horse.delete.
 *
 * Equoria-fr2kg. OLD CONTRACT: the model also exported the player-run
 * getAvailableActivities (day 0-6 table), completeActivity,
 * completeEnrichmentActivity and graduateFoal, and getFoalDevelopment returned
 * the enrichment day/window, that day's activities, the stage activity list
 * and completedActivities. NEW RULING (owner, 2026-10-14/15): foal enrichment
 * is the groom's job and there is no graduation, so none of that exists.
 */

const PREFIX = 'TestFixture-FoalModel-';
const DATE_OF_BIRTH = new Date('2020-01-01');

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

  // Equoria-lu6xo. OLD CONTRACT: only stored game age 0-1 was served; age 2
  // threw "must be 1 year old or younger". NEW RULING (owner, 2026-10-22):
  // GET /foals/:id/development serves every horse under 3 (game age 0-2);
  // age 3+ keeps its "not a foal" refusal (the controller maps it to 404).
  it('throws for an adult horse (age 5)', async () => {
    const foal = await mkFoal('Adult-5', { age: 5 });
    try {
      await expect(getFoalDevelopment(foal.id)).rejects.toThrow('Horse is not a foal (age 3 or older)');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('throws for a 3-year-old horse (boundary)', async () => {
    const foal = await mkFoal('Adult-3', { age: 3 });
    try {
      await expect(getFoalDevelopment(foal.id)).rejects.toThrow('Horse is not a foal (age 3 or older)');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('accepts a 2-year-old horse (under 3, Equoria-lu6xo)', async () => {
    const foal = await mkFoal('TwoYearOld', { age: 2 });
    try {
      await mkDev(foal.id, { currentDay: 3 });
      const result = await getFoalDevelopment(foal.id);
      expect(result.foal.name).toBe(`${PREFIX}TwoYearOld`);
      expect(result.foal.age).toBe(2);
      expect(result.development.currentDay).toBe(3);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('accepts 1-year-old horse', async () => {
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

  // Equoria-fr2kg Q16. OLD CONTRACT: development.bondingLevel / stressLevel
  // echoed the legacy FoalDevelopment columns, frozen at their 50 / 20
  // defaults. NEW RULING (owner, 2026-10-22): the foal page shows the horse's
  // real bond and stress (Horse.bondScore / Horse.stressLevel, which grooms
  // write); the legacy columns are kept but ignored.
  it("serves the horse's real bond and stress, not the frozen legacy columns (Equoria-fr2kg Q16)", async () => {
    const foal = await mkFoal('RealBond', { age: 1, bondScore: 37, stressLevel: 12 });
    try {
      await mkDev(foal.id, { bondingLevel: 50, stressLevel: 20 });
      const result = await getFoalDevelopment(foal.id);
      expect(result.development.bondingLevel).toBe(37);
      expect(result.development.stressLevel).toBe(12);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('returns full development data with all expected fields', async () => {
    const foal = await mkFoal('FullData', { age: 0, bondScore: 60 });
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
      expect(result.development.currentDay).toBe(2);
      expect(result.development.bondingLevel).toBe(60);
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('returns no player-run enrichment or activity fields (Equoria-fr2kg)', async () => {
    const foal = await mkFoal('NoPlayerFields', { age: 0, dateOfBirth: new Date() });
    try {
      await mkDev(foal.id, { completedActivities: { 0: ['gentle_touch'] } });
      const result = await getFoalDevelopment(foal.id);
      expect(result.development).not.toHaveProperty('completedActivities');
      expect(result.development).not.toHaveProperty('enrichmentDay');
      expect(result.development).not.toHaveProperty('enrichmentWindowOpen');
      expect(result).not.toHaveProperty('availableEnrichmentActivities');
      expect(result).not.toHaveProperty('availableActivities');
    } finally {
      await rmFoal(foal.id);
    }
  });

  it('auto-creates development record for foal with no existing record', async () => {
    const foal = await mkFoal('NoDev', { age: 0, bondScore: 4, stressLevel: 3 });
    try {
      const result = await getFoalDevelopment(foal.id);
      expect(result.development.currentDay).toBe(0);
      expect(await prisma.foalDevelopment.count({ where: { foalId: foal.id } })).toBe(1);
      // Bond and stress are the horse's own (Equoria-fr2kg Q16).
      expect(result.development.bondingLevel).toBe(4);
      expect(result.development.stressLevel).toBe(3);
    } finally {
      await rmFoal(foal.id);
    }
  });
});

// ─── Retired player-run model functions (Equoria-fr2kg) ───────────────────────

describe('retired player-run foal functions', () => {
  it.each(['getAvailableActivities', 'completeActivity', 'completeEnrichmentActivity', 'graduateFoal'])(
    'foalModel no longer exports %s',
    name => {
      expect(foalModel).not.toHaveProperty(name);
    },
  );
});
