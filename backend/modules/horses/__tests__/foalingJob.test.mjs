/**
 * Integration test — foaling job (B5, parent Equoria-3gqg / Equoria-wmnq).
 *
 * Spec §8.4 (feed-system redesign 2026-04-29): a daily job finds mares whose
 * `inFoalSinceDate <= now - 7 days` and:
 *   1. Computes positive_chance / negative_chance via
 *      calculatePregnancyEpigeneticChances(mare.pregnancyFeedingsByTier).
 *   2. Calls createFoalFromPregnancy() — passes the bonus chances + the
 *      pregnancySireId snapshot — which inserts the foal Horse row.
 *   3. Clears the mare's pregnancy columns (inFoalSinceDate, pregnancySireId,
 *      pregnancyFeedingsByTier).
 *
 * Per-mare transactionality: a failure on mare A must not block mare B.
 * Idempotency: running the job twice on the same eligible mare creates
 * exactly one foal.
 *
 * Real DB. NO mocks. NO bypass headers.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../db/index.mjs';
import { runFoalingJob, createFoalFromPregnancy } from '../services/foalingService.mjs';
import { CORE_LOCI } from '../services/genotypeGenerationService.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

async function createUser(suffix) {
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${suffix}`;
  return prisma.user.create({
    data: {
      username: `b5_${ts}`,
      email: `b5_${ts}@test.com`,
      password: 'pwhash',
      firstName: 'B5',
      lastName: 'Tester',
      money: 0,
      settings: {},
    },
  });
}

async function createBreed() {
  return prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'B5 test breed' },
  });
}

async function createMareSirePair({
  userId,
  breedId,
  inFoalSinceDate = null,
  pregnancyFeedingsByTier = {},
  pregnancySireId = null,
  damName = 'B5Dam',
  sireName = 'B5Sire',
}) {
  const fiveYearsAgo = new Date(Date.now() - 5 * 365 * DAY_MS);
  const sire = await prisma.horse.create({
    data: {
      name: `${sireName}_${Math.random().toString(36).slice(2, 6)}`,
      sex: 'Stallion',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId,
      userId,
      healthStatus: 'Good',
    },
  });
  const dam = await prisma.horse.create({
    data: {
      name: `${damName}_${Math.random().toString(36).slice(2, 6)}`,
      sex: 'Mare',
      dateOfBirth: fiveYearsAgo,
      age: 5,
      breedId,
      userId,
      healthStatus: 'Good',
      inFoalSinceDate,
      pregnancySireId: pregnancySireId ?? sire.id,
      pregnancyFeedingsByTier,
    },
  });
  return { sire, dam };
}

async function cleanupHorsesByUser(userId) {
  const horses = await prisma.horse.findMany({
    where: { userId },
    select: { id: true, age: true },
  });
  const foalIds = horses.filter(h => h.age === 0).map(h => h.id);
  if (foalIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: foalIds } } });
  }
  await prisma.horse.deleteMany({ where: { userId } });
}

describe('runFoalingJob (B5)', () => {
  let breedId;
  const createdUserIds = [];

  beforeEach(async () => {
    const breed = await createBreed();
    breedId = breed.id;
  });

  afterEach(async () => {
    for (const uid of createdUserIds.splice(0)) {
      await cleanupHorsesByUser(uid).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
  });

  it('happy path: creates a foal and clears pregnancy state when gestation complete', async () => {
    const user = await createUser('happy');
    createdUserIds.push(user.id);

    const { dam, sire } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: { performance: 7 },
    });

    const result = await runFoalingJob();

    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).toBeNull();
    expect(refreshedDam.pregnancySireId).toBeNull();
    expect(refreshedDam.pregnancyFeedingsByTier).toEqual({});

    const foals = await prisma.horse.findMany({
      where: { damId: dam.id, sireId: sire.id },
    });
    expect(foals.length).toBe(1);
    expect(foals[0].age).toBe(0);
  });

  it('cutoff sentinel: a mare at 6.5 days is NOT foaled (proves the +7-day boundary)', async () => {
    const user = await createUser('cutoff');
    createdUserIds.push(user.id);

    const inFoal = new Date(Date.now() - 6.5 * DAY_MS);
    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: inFoal,
      pregnancyFeedingsByTier: { performance: 6 },
    });

    const result = await runFoalingJob();
    expect(result).toBeDefined();
    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).not.toBeNull();
    const foalCount = await prisma.horse.count({ where: { damId: dam.id } });
    expect(foalCount).toBe(0);
  });

  it('cutoff sentinel: a mare at 7 days IS foaled (proves the boundary is inclusive)', async () => {
    const user = await createUser('exact7');
    createdUserIds.push(user.id);

    // 7 days + a 1-second epsilon to dodge clock skew across the boundary.
    const inFoal = new Date(Date.now() - 7 * DAY_MS - 1000);
    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: inFoal,
      pregnancyFeedingsByTier: { performance: 7 },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);
    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).toBeNull();
  });

  it('not-yet-due: 3 days elapsed → no foal, pregnancy state untouched', async () => {
    const user = await createUser('early');
    createdUserIds.push(user.id);

    const inFoal = new Date(Date.now() - 3 * DAY_MS);
    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: inFoal,
      pregnancyFeedingsByTier: { elite: 3 },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBe(0);

    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).not.toBeNull();
    expect(refreshedDam.pregnancySireId).not.toBeNull();
    expect(refreshedDam.pregnancyFeedingsByTier).toEqual({ elite: 3 });

    const foalCount = await prisma.horse.count({ where: { damId: dam.id } });
    expect(foalCount).toBe(0);
  });

  it('all-basic feedings: zero positive_chance, zero negative_chance — foal still born', async () => {
    const user = await createUser('basic');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: { basic: 7 },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).toBeNull();

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
  });

  it('zero feedings: 35% negative_chance applied; foal still born', async () => {
    const user = await createUser('zerofeed');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    // rng=()=>0 forces both rolls to succeed → bonus negative trait inserted.
    const result = await runFoalingJob({ rng: () => 0 });
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.inFoalSinceDate).toBeNull();

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    const epi = foals[0].epigeneticModifiers || {};
    expect(Array.isArray(epi.negative)).toBe(true);
    expect(epi.negative.length).toBeGreaterThanOrEqual(1);
  });

  it('positive bonus roll: high-tier feedings + rng=0 produces a positive bonus trait', async () => {
    const user = await createUser('posroll');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: { elite: 7 }, // positive_chance = 20%
    });

    const result = await runFoalingJob({ rng: () => 0 });
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    const epi = foals[0].epigeneticModifiers || {};
    expect(Array.isArray(epi.positive)).toBe(true);
    expect(epi.positive.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple mares due simultaneously: all are foaled in one run', async () => {
    const user = await createUser('multi');
    createdUserIds.push(user.id);

    const dams = [];
    for (let i = 0; i < 3; i++) {
      const { dam } = await createMareSirePair({
        userId: user.id,
        breedId,
        inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
        pregnancyFeedingsByTier: { performance: 5 },
      });
      dams.push(dam);
    }

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(3);

    for (const d of dams) {
      const refreshed = await prisma.horse.findUnique({ where: { id: d.id } });
      expect(refreshed.inFoalSinceDate).toBeNull();
      expect(refreshed.pregnancySireId).toBeNull();
      const foals = await prisma.horse.findMany({ where: { damId: d.id } });
      expect(foals.length).toBe(1);
    }
  });

  it('idempotency: running the job twice on the same mare creates exactly one foal', async () => {
    const user = await createUser('idem');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: { performance: 3 },
    });

    const first = await runFoalingJob();
    const second = await runFoalingJob();

    expect(first.foalsBorn).toBeGreaterThanOrEqual(1);
    // We can't assert second.foalsBorn===0 globally because parallel test
    // suites can introduce other due mares. But THIS dam must have exactly
    // one foal.
    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    expect(second).toBeDefined();
  });

  it('per-mare isolation: a failure on one mare does not block others', async () => {
    const user = await createUser('isolation');
    createdUserIds.push(user.id);

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * DAY_MS);
    const validSire = await prisma.horse.create({
      data: {
        name: `B5IsoSire_${Math.random().toString(36).slice(2, 6)}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Good',
      },
    });

    const damBad = await prisma.horse.create({
      data: {
        name: `B5BadMare_${Math.random().toString(36).slice(2, 6)}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Good',
        inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
        pregnancySireId: 999_999_999, // sire that doesn't exist
        pregnancyFeedingsByTier: { performance: 3 },
      },
    });
    const damGood = await prisma.horse.create({
      data: {
        name: `B5GoodMare_${Math.random().toString(36).slice(2, 6)}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Good',
        inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
        pregnancySireId: validSire.id,
        pregnancyFeedingsByTier: { performance: 3 },
      },
    });

    const result = await runFoalingJob();

    const goodFoals = await prisma.horse.findMany({ where: { damId: damGood.id } });
    expect(goodFoals.length).toBe(1);

    const badFoals = await prisma.horse.findMany({ where: { damId: damBad.id } });
    expect(badFoals.length).toBe(0);
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);
  });

  it('createFoalFromPregnancy: positive/negative chance overrides force trait insertion', async () => {
    const user = await createUser('direct');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    const result = await createFoalFromPregnancy({
      damId: dam.id,
      options: {
        positiveTraitChance: 100, // guaranteed positive bonus trait
        negativeTraitChance: 100, // guaranteed negative bonus trait
        rng: () => 0,
      },
    });

    expect(result.foal).toBeTruthy();
    expect(result.appliedTraits).toBeTruthy();
    const epi = result.foal.epigeneticModifiers || {};
    expect(epi.positive.length).toBeGreaterThanOrEqual(1);
    expect(epi.negative.length).toBeGreaterThanOrEqual(1);
  });

  it('pendingFoalName: foaling job uses caller-specified foal name from dam record', async () => {
    const user = await createUser('pfname');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    // Simulate what createFoal() should have persisted at pregnancy start.
    const desiredFoalName = `WjxwTestFoal_${Math.random().toString(36).slice(2, 8)}`;
    await prisma.horse.update({
      where: { id: dam.id },
      data: { pendingFoalName: desiredFoalName },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    expect(foals[0].name).toBe(desiredFoalName);

    // pendingFoalName should be cleared after foaling.
    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.pendingFoalName).toBeNull();
  });

  it('pendingFoalBreedId: foaling job uses caller-specified breed for the foal, not dam breed', async () => {
    const user = await createUser('pfbreed');
    createdUserIds.push(user.id);

    // Upsert a second breed to use as the foal's intended breed.
    const foalBreed = await prisma.breed.upsert({
      where: { name: 'American Quarter Horse' },
      update: {},
      create: { name: 'American Quarter Horse', description: 'B5 wjxw test breed' },
    });

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId, // dam's own breed = Thoroughbred
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    // Foal should be born as the caller-specified breed, not the dam's breed.
    await prisma.horse.update({
      where: { id: dam.id },
      data: { pendingFoalBreedId: foalBreed.id },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    expect(foals[0].breedId).toBe(foalBreed.id);
    expect(foals[0].breedId).not.toBe(breedId);

    // pendingFoalBreedId should be cleared after foaling.
    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.pendingFoalBreedId).toBeNull();
  });

  it('createFoalFromPregnancy direct call: reads pendingFoalName/pendingFoalBreedId from dam when options omit them', async () => {
    const user = await createUser('directpend');
    createdUserIds.push(user.id);

    const pendingBreed = await prisma.breed.upsert({
      where: { name: 'Arabian' },
      update: {},
      create: { name: 'Arabian', description: 'B5 wjxw direct-call sentinel' },
    });

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    await prisma.horse.update({
      where: { id: dam.id },
      data: {
        pendingFoalName: 'DirectCallFoalSentinel',
        pendingFoalBreedId: pendingBreed.id,
      },
    });

    const result = await createFoalFromPregnancy({ damId: dam.id, options: {} });

    expect(result.foal.name).toBe('DirectCallFoalSentinel');
    expect(result.foal.breedId).toBe(pendingBreed.id);

    // dam reset must clear pendingFoal fields.
    const refreshedDam = await prisma.horse.findUnique({ where: { id: dam.id } });
    expect(refreshedDam.pendingFoalName).toBeNull();
    expect(refreshedDam.pendingFoalBreedId).toBeNull();
  });

  // 31E-1a/31E-2 follow-up (Equoria-e8zj): foaling job must wire color genetics
  // into the foal. AC1+AC2: foal.colorGenotype is non-null with all 17 CORE_LOCI
  // and foal.phenotype includes colorName + markings.
  it('color genetics: foal has non-null colorGenotype (all 17 CORE_LOCI) and phenotype with colorName', async () => {
    const user = await createUser('colorgen');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    const foal = foals[0];

    // AC1: colorGenotype non-null with all 17 CORE_LOCI
    expect(foal.colorGenotype).toBeTruthy();
    expect(typeof foal.colorGenotype).toBe('object');
    for (const locus of CORE_LOCI) {
      expect(foal.colorGenotype[locus]).toBeTruthy();
      expect(typeof foal.colorGenotype[locus]).toBe('string');
    }

    // AC2: phenotype non-null with colorName
    expect(foal.phenotype).toBeTruthy();
    expect(typeof foal.phenotype).toBe('object');
    expect(typeof foal.phenotype.colorName).toBe('string');
    expect(foal.phenotype.colorName.length).toBeGreaterThan(0);
  });

  // 31E-2 (Equoria-e8zj) AC3: when both parents have colorGenotype, foal
  // genotype is produced by inheritColorGenotype (deterministic with seeded rng).
  // Sentinel-positive test: this fails if the wiring of colorGenotype/phenotype
  // into horseData is removed from createFoalFromPregnancy.
  it('color genetics inheritance: both parents homozygous chestnut produces ee foal (sentinel)', async () => {
    const user = await createUser('colorInherit');
    createdUserIds.push(user.id);

    // Build parents with known genotypes so we can assert inheritance, not
    // random generation. Both parents homozygous chestnut (e/e at extension)
    // means every foal MUST be e/e — deterministic regardless of rng.
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * DAY_MS);
    const sire = await prisma.horse.create({
      data: {
        name: `ColorSire_${Math.random().toString(36).slice(2, 6)}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Good',
        colorGenotype: {
          E_Extension: 'e/e',
          A_Agouti: 'a/a',
          Cr_Cream: 'n/n',
          D_Dun: 'nd2/nd2',
          G_Gray: 'g/g',
        },
        phenotype: { colorName: 'Chestnut' },
      },
    });
    const dam = await prisma.horse.create({
      data: {
        name: `ColorDam_${Math.random().toString(36).slice(2, 6)}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Good',
        inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
        pregnancySireId: sire.id,
        pregnancyFeedingsByTier: {},
        colorGenotype: {
          E_Extension: 'e/e',
          A_Agouti: 'a/a',
          Cr_Cream: 'n/n',
          D_Dun: 'nd2/nd2',
          G_Gray: 'g/g',
        },
        phenotype: { colorName: 'Chestnut' },
      },
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id, sireId: sire.id } });
    expect(foals.length).toBe(1);
    const foal = foals[0];

    // SENTINEL: foal MUST have colorGenotype.E_Extension === 'e/e' (Mendelian).
    // If colorGenotype/phenotype wiring is stripped from createFoalFromPregnancy,
    // foal.colorGenotype will be null and this test fails.
    expect(foal.colorGenotype).toBeTruthy();
    expect(foal.colorGenotype.E_Extension).toBe('e/e');
    expect(foal.phenotype).toBeTruthy();
    expect(typeof foal.phenotype.colorName).toBe('string');
  });

  // AC4: when sire or dam colorGenotype is null, fallback is generateGenotype —
  // never NULL. Both parents lack genotype here.
  it('color genetics fallback: parents without colorGenotype yield generated genotype (never null)', async () => {
    const user = await createUser('colorFallback');
    createdUserIds.push(user.id);

    const { dam } = await createMareSirePair({
      userId: user.id,
      breedId,
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancyFeedingsByTier: {},
    });

    const result = await runFoalingJob();
    expect(result.foalsBorn).toBeGreaterThanOrEqual(1);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id } });
    expect(foals.length).toBe(1);
    expect(foals[0].colorGenotype).toBeTruthy();
    expect(foals[0].colorGenotype.E_Extension).toBeTruthy();
    expect(foals[0].phenotype).toBeTruthy();
  });
});
