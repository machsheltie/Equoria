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
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from './helpers/fixtureColor.mjs';

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
}, 30000);

afterAll(async () => {
  // Scoped cleanup by this suite's unique userId — explicit, not cascade-only.
  await prisma.horse.deleteMany({ where: { userId: guardUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: guardUser.id } }).catch(() => {});
}, 30000);

describe('fixtureColor() guard (Equoria-g9sa)', () => {
  it('SENTINEL-NEGATIVE: raw prisma.horse.create with no color fields yields NULL phenotype (the defect class)', async () => {
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
    // if this suite's afterAll cleanup were ever to fail.
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
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
