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
import { createTestHorse, cleanupTestHorses } from './createTestHorse.mjs';
// Equoria-1ohys: fail-loud scoped cleanup for THIS suite's own teardown.
// (The cleanupTestHorses calls inside the test BODIES below are assertion
// subjects — they exercise the helper's contract and must stay as-is. Only
// the suite's afterAll teardown and the sentinel-negative row's load-bearing
// delete are migrated off silent no-op catch arms.)
import { createCleanupTracker } from './failLoudCleanup.mjs';

const randHex = (n = 4) => randomBytes(n).toString('hex');

let suiteUser;
const createdIds = [];

beforeAll(async () => {
  suiteUser = await prisma.user.create({
    data: {
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
        (phenotype IS NULL) AS phenotype_is_null,
        (phenotype->>'colorName') AS color_name,
        ("colorGenotype" IS NULL) AS genotype_is_null
      FROM horses WHERE id = ${horse.id}
    `;
    expect(row.phenotype_is_null).toBe(false);
    expect(row.genotype_is_null).toBe(false);
    expect(typeof row.color_name).toBe('string');
    expect(row.color_name.length).toBeGreaterThan(0);
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
      SELECT (phenotype->>'colorName') AS color_name
      FROM horses WHERE id = ${horse.id}
    `;
    expect(row.color_name).toBe('SentinelTestColor');
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
