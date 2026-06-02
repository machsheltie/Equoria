/**
 * fixtureColorGuard.test.mjs (Equoria-g9sa)
 *
 * Sentinel-positive test (OPTIMAL_FIX_DISCIPLINE.md §2) for the structural
 * fix that prevents the Equoria-lfj5 NULL-phenotype regression class.
 *
 * Root cause (Equoria-g9sa): trait-discovery + training-controller test
 * suites create fixture horses via raw `prisma.horse.create()`, bypassing
 * `createHorse()`'s phenotype auto-generation (Equoria-ennm). Born
 * NULL-phenotype, those fixtures violate the canonical-DB invariant
 * asserted by horseColorNullSentinel.test.mjs whenever cleanup leaks a row.
 *
 * This test proves:
 *   1. NEGATIVE (sentinel demonstrates the failure mode): a horse inserted
 *      the OLD way (raw create, no color fields) has NULL phenotype — i.e.
 *      the defect class is real and detectable.
 *   2. POSITIVE (the fix works): a horse inserted with `...fixtureColor()`
 *      spread in — the NEW pattern the suites now use — has a non-null
 *      phenotype whose colorName is a non-empty string, satisfying the
 *      exact predicate horseColorNullSentinel asserts.
 *
 * Real DB, scoped cleanup by unique userId (CLAUDE.md §2). No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The old afterAll swallowed both
// deletes with an empty catch arm, so a leaked horse/user (Horse.userId
// onDelete:Restrict, schema:282) stayed hidden — exactly the leak this very
// suite's NULL-phenotype sentinel exists to catch.
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';

const cleanup = createCleanupTracker();
let guardUser;

beforeAll(async () => {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  guardUser = await prisma.user.create({
    data: {
      email: `g9sa-guard-${ts}-${rand}@test.com`,
      username: `g9saguard${ts}${rand}`,
      password: 'irrelevant-hash',
      firstName: 'G9sa',
      lastName: 'Guard',
      money: 0,
    },
  });

  // Equoria-1ohys: scoped cleanup by this suite's unique userId — explicit,
  // not cascade-only. FK order: horses (Horse.userId Restrict) -> user.
  cleanup.add(async () => {
    await prisma.horse.deleteMany({ where: { userId: guardUser.id } });
    await prisma.user.delete({ where: { id: guardUser.id } });
  }, 'guard horses + user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('fixtureColor() guard (Equoria-g9sa)', () => {
  it('SENTINEL-NEGATIVE: raw prisma.horse.create with no color fields yields NULL phenotype (the defect class)', async () => {
    // eslint-disable-next-line equoria/no-raw-test-horse-create -- THIS is the sentinel-negative: it MUST use the raw, color-less form to PROVE the defect class (NULL phenotype) is real and detectable. Spreading fixtureColor() here would defeat the test's entire purpose. The row is deleted immediately below so it cannot leak.
    const horse = await prisma.horse.create({
      data: {
        userId: guardUser.id,
        name: `TestFixture-G9sa-Old-${Date.now()}`,
        sex: 'Stallion',
        age: 1,
        dateOfBirth: new Date(),
      },
    });
    const [row] = await prisma.$queryRaw`
      SELECT phenotype FROM horses WHERE id = ${horse.id}
    `;
    // Proves the failure mode is real: the old pattern produces NULL phenotype.
    expect(row.phenotype).toBeNull();
    // Clean this one up immediately so it cannot trip the canonical sentinel
    // if this suite's afterAll cleanup were ever to fail. Equoria-1ohys:
    // scoped, idempotent deleteMany (no swallowed catch). An already-gone row
    // is a no-op count 0; a real scope/FK failure reds the test instead of
    // being hidden by a swallowed catch.
    await prisma.horse.deleteMany({ where: { id: horse.id } });
  }, 15000);

  it('SENTINEL-POSITIVE: prisma.horse.create with ...fixtureColor() yields non-null phenotype + non-empty colorName', async () => {
    const horse = await prisma.horse.create({
      data: {
        userId: guardUser.id,
        name: `TestFixture-G9sa-New-${Date.now()}`,
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(),
        ...fixtureColor(),
      },
    });
    // Assert exactly what horseColorNullSentinel asserts: phenotype NOT NULL
    // AND phenotype->>'colorName' is a non-empty string.
    const [row] = await prisma.$queryRaw`
      SELECT
        (phenotype IS NULL) AS phenotype_is_null,
        (phenotype->>'colorName') AS color_name
      FROM horses WHERE id = ${horse.id}
    `;
    expect(row.phenotype_is_null).toBe(false);
    expect(typeof row.color_name).toBe('string');
    expect(row.color_name.length).toBeGreaterThan(0);
  }, 15000);
});
