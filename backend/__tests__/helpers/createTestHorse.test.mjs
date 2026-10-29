/**
 * createTestHorse.test.mjs (Equoria-dm1i)
 *
 * Sentinel-positive test (OPTIMAL_FIX_DISCIPLINE.md §2) for the
 * `createTestHorse` helper that closes the NULL-phenotype fixture defect
 * class at the point of creation.
 *
 * Proves:
 *   1. SENTINEL-NEGATIVE — a horse inserted the OLD way (raw
 *      prisma.horse.create, no color fields) has NULL phenotype. The
 *      defect class is real and detectable.
 *   2. SENTINEL-POSITIVE — a horse inserted via `createTestHorse()` has a
 *      non-null phenotype whose colorName is a non-empty string, i.e. it
 *      satisfies the exact predicate `horseColorNullSentinel` asserts.
 *   3. createTestHorse RESPECTS caller-supplied color (does not clobber an
 *      intentional genotype/phenotype).
 *   4. cleanupTestHorses deletes ONLY the collected ids (scoped, not
 *      broad) and is idempotent.
 *
 * Real DB, scoped cleanup by this suite's unique userId + the helper's own
 * id collector (CLAUDE.md §2). No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses, testHorseData } from './createTestHorse.mjs';
// Equoria-1ohys: fail-loud scoped cleanup for THIS suite's own teardown.
// (The cleanupTestHorses calls inside the test BODIES below are assertion
// subjects — they exercise the helper's contract and must stay as-is. Only
// the suite's afterAll teardown and the sentinel-negative row's load-bearing
// delete are migrated off silent no-op catch arms.)
import { createCleanupTracker } from './failLoudCleanup.mjs';
import { getHorseAgeYears } from '../../utils/horseAge.mjs';

const randHex = (n = 4) => randomBytes(n).toString('hex');

let suiteUser;
const createdIds = [];

beforeAll(async () => {
  suiteUser = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `dm1i-helper-${randHex(6)}@test.com`,
      username: `dm1ihelper${randHex(5)}`,
      password: 'irrelevant-hash',
      firstName: 'Dm1i',
      lastName: 'Helper',
      money: 0,
    },
  });
}, 30000);

afterAll(async () => {
  // Equoria-1ohys: fail-loud scoped teardown in FK order — horses (the suite's
  // collected ids) before the user (Horse.userId is onDelete: Restrict). The
  // tracker runs both deletes then re-throws on any failure, so a leak fails
  // the suite instead of being swallowed by a silent no-op catch arm.
  const cleanup = createCleanupTracker();
  cleanup.add(() => cleanupTestHorses(prisma, createdIds), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: suiteUser.id } }), 'user');
  await cleanup.run();
}, 30000);

describe('createTestHorse helper (Equoria-dm1i)', () => {
  it('SENTINEL-NEGATIVE: raw prisma.horse.create with no color fields yields NULL phenotype (the defect class)', async () => {
    // This raw create is INTENTIONAL: it demonstrates the exact defect
    // class (NULL phenotype) the helper closes. Disabling the dm1i
    // sentinel here is the one legitimate exception — the test's whole
    // purpose is to prove the rule's premise is real. The row is deleted
    // immediately below so it cannot trip the canonical sentinel.
    // eslint-disable-next-line equoria/no-raw-test-horse-create -- sentinel-negative: must use the raw form to prove the defect class (Equoria-dm1i)
    const horse = await prisma.horse.create({
      data: {
        userId: suiteUser.id,
        name: `TestFixture-dm1i-Raw-${randHex()}`,
        sex: 'Stallion',
        age: 1,
        dateOfBirth: new Date(),
        // Equoria-576c0.5: every horse has a temperament and gaits; only the color is omitted.
        temperament: 'Calm',
        gaitScores: { walk: 50, trot: 50, canter: 50, gallop: 50, gaiting: null },
      },
    });
    const [row] = await prisma.$queryRaw`
      SELECT phenotype FROM horses WHERE id = ${horse.id}
    `;
    expect(row.phenotype).toBeNull();
    // Immediate cleanup so this row cannot trip the canonical sentinel.
    // Equoria-1ohys: this delete is load-bearing — if it fails, the
    // NULL-phenotype row leaks and trips horseColorNullSentinel. It must
    // therefore fail loud (no silent no-op catch arm) so the test surfaces a
    // cleanup failure at the source rather than hiding it.
    await prisma.horse.delete({ where: { id: horse.id } });
  }, 15000);

  it('SENTINEL-POSITIVE: createTestHorse yields non-null phenotype + non-empty colorName', async () => {
    const horse = await createTestHorse(
      prisma,
      {
        userId: suiteUser.id,
        name: `TestFixture-dm1i-Helper-${randHex()}`,
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(),
      },
      createdIds,
    );

    expect(createdIds).toContain(horse.id);

    const [row] = await prisma.$queryRaw`
      SELECT
        (phenotype IS NULL) AS "phenotypeIsNull",
        (phenotype->>'colorName') AS "colorName",
        ("colorGenotype" IS NULL) AS "genotypeIsNull"
      FROM horses WHERE id = ${horse.id}
    `;
    expect(row.phenotypeIsNull).toBe(false);
    expect(row.genotypeIsNull).toBe(false);
    expect(typeof row.colorName).toBe('string');
    expect(row.colorName.length).toBeGreaterThan(0);
  }, 15000);

  it('respects caller-supplied colorGenotype/phenotype (does not clobber an intentional genotype)', async () => {
    const intentionalPhenotype = { colorName: 'SentinelTestColor', baseColor: 'black' };
    const horse = await createTestHorse(
      prisma,
      {
        userId: suiteUser.id,
        name: `TestFixture-dm1i-Caller-${randHex()}`,
        sex: 'Mare',
        age: 4,
        dateOfBirth: new Date(),
        phenotype: intentionalPhenotype,
      },
      createdIds,
    );
    const [row] = await prisma.$queryRaw`
      SELECT (phenotype->>'colorName') AS "colorName"
      FROM horses WHERE id = ${horse.id}
    `;
    expect(row.colorName).toBe('SentinelTestColor');
  }, 15000);

  it('cleanupTestHorses deletes ONLY collected ids and is idempotent', async () => {
    const scopedCollector = [];
    const a = await createTestHorse(
      prisma,
      {
        userId: suiteUser.id,
        name: `TestFixture-dm1i-Clean-${randHex()}`,
        sex: 'Stallion',
        age: 2,
        dateOfBirth: new Date(),
      },
      scopedCollector,
    );
    // A horse NOT in the collector — must survive the scoped cleanup.
    const survivor = await createTestHorse(
      prisma,
      {
        userId: suiteUser.id,
        name: `TestFixture-dm1i-Survivor-${randHex()}`,
        sex: 'Mare',
        age: 2,
        dateOfBirth: new Date(),
      },
      createdIds, // tracked by suite-level collector, cleaned in afterAll
    );

    const deleted = await cleanupTestHorses(prisma, scopedCollector);
    expect(deleted).toBe(1);
    expect(scopedCollector.length).toBe(0); // collector emptied

    const goneRow = await prisma.horse.findUnique({ where: { id: a.id } });
    expect(goneRow).toBeNull();
    const survivorRow = await prisma.horse.findUnique({ where: { id: survivor.id } });
    expect(survivorRow).not.toBeNull();

    // Idempotent: second call on the now-empty collector is a no-op.
    const deletedAgain = await cleanupTestHorses(prisma, scopedCollector);
    expect(deletedAgain).toBe(0);
  }, 20000);
});

describe('every fixture horse has a breed, temperament and gaits (Equoria-576c0.5)', () => {
  const base = () => ({
    userId: suiteUser.id,
    name: `TestFixture-576c0-${randHex()}`,
    sex: 'Mare',
    age: 4,
    dateOfBirth: new Date(),
  });
  const stored = id =>
    prisma.horse.findUnique({
      where: { id },
      select: { breedId: true, temperament: true, gaitScores: true, breed: { select: { name: true } } },
    });
  const expectRolled = row => {
    expect(typeof row.temperament).toBe('string');
    expect(row.temperament.length).toBeGreaterThan(0);
    for (const gait of ['walk', 'trot', 'canter', 'gallop']) {
      expect(Number.isFinite(row.gaitScores[gait])).toBe(true);
    }
  };

  it('a fixture that names no breed gets the default breed (Thoroughbred) and both rolled from it', async () => {
    const horse = await createTestHorse(prisma, base(), createdIds);
    const row = await stored(horse.id);
    expect(row.breed?.name).toBe('Thoroughbred');
    expectRolled(row);
  }, 15000);

  it('relation-style data (user: { connect }) gets the default breed as a relation too', async () => {
    const { userId, ...rest } = base();
    const horse = await createTestHorse(prisma, { ...rest, user: { connect: { id: userId } } }, createdIds);
    const row = await stored(horse.id);
    expect(row.breed?.name).toBe('Thoroughbred');
    expectRolled(row);
  }, 15000);

  it('breedId: null plants a breedless horse that still has both', async () => {
    const horse = await createTestHorse(prisma, { ...base(), breedId: null }, createdIds);
    const row = await stored(horse.id);
    expect(row.breedId).toBeNull();
    expectRolled(row);
  }, 15000);

  it('a test-made breed with no profile keeps its breed and still has both', async () => {
    const bare = await prisma.breed.create({
      data: { name: `TestFixture-576c0-bare-${randHex()}`, description: 'no profile' },
    });
    try {
      const horse = await createTestHorse(prisma, { ...base(), breedId: bare.id }, createdIds);
      const row = await stored(horse.id);
      expect(row.breedId).toBe(bare.id);
      expectRolled(row);
      await cleanupTestHorses(prisma, createdIds);
    } finally {
      await prisma.breed.delete({ where: { id: bare.id } });
    }
  }, 15000);

  it('a fixture with no dateOfBirth is born at the age it names, in game years (Equoria-0jztg)', async () => {
    const { dateOfBirth: _unused, ...rest } = base();
    const horse = await createTestHorse(prisma, { ...rest, age: 7 }, createdIds);
    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { dateOfBirth: true, age: true } });
    expect(getHorseAgeYears(row.dateOfBirth)).toBe(7);
  }, 15000);

  it('fills the same values on every call, so no test flakes on a roll', async () => {
    const first = await testHorseData(prisma, base());
    const second = await testHorseData(prisma, base());
    expect(second.temperament).toBe(first.temperament);
    expect(second.gaitScores).toEqual(first.gaitScores);
  }, 15000);

  it('keeps caller-supplied values, including explicit nulls (legacy-row plants)', async () => {
    const data = await testHorseData(prisma, { ...base(), temperament: null, gaitScores: null });
    expect(data.temperament).toBeNull();
    expect(data.gaitScores).toBeNull();
    const given = await testHorseData(prisma, { ...base(), temperament: 'Willing' });
    expect(given.temperament).toBe('Willing');
    expect(Number.isFinite(given.gaitScores.walk)).toBe(true);
  }, 15000);
});
