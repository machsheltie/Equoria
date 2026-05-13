/**
 * Sentinel test for horse-sex canonicalization (Equoria-duz2).
 *
 * Proves three things:
 *   1. The pure helper rejects unknown values and case-folds known ones.
 *   2. The Prisma `$extends` interceptor on `prisma.horse.create` /
 *      `horse.update` / `horse.upsert` / `horse.createMany` rewrites
 *      whatever casing arrives into the canonical Title Case form before
 *      the row is persisted. This is the defense-in-depth chokepoint —
 *      every write path (controllers, seeds, tests, scripts) flows through
 *      it.
 *   3. Invalid sex values are rejected at the client layer, not silently
 *      stored as-is.
 *
 * If anyone re-introduces the original drift (e.g. the marketplace store
 * endpoint persisting 'mare' lowercase, or a new seed dropping 'STALLION'
 * uppercase) these assertions fail loudly.
 */

import { describe, it, expect, afterAll, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  canonicalizeHorseSex,
  canonicalizeHorseSexOrNull,
  CANONICAL_HORSE_SEX_VALUES,
} from '../../../../packages/database/horseSexCanonical.mjs';

const FIXTURE_NAME_PREFIX = 'TestFixture-CanonicalSex-';

async function cleanupFixtures() {
  await prisma.horse.deleteMany({
    where: { name: { startsWith: FIXTURE_NAME_PREFIX } },
  });
}

describe('canonicalizeHorseSex (pure helper)', () => {
  it.each([
    ['mare', 'Mare'],
    ['MARE', 'Mare'],
    ['Mare', 'Mare'],
    ['stallion', 'Stallion'],
    ['STALLION', 'Stallion'],
    ['filly', 'Filly'],
    ['colt', 'Colt'],
    ['rig', 'Rig'],
    ['  mare  ', 'Mare'],
  ])('canonicalizes %j → %j', (input, expected) => {
    expect(canonicalizeHorseSex(input)).toBe(expected);
  });

  it('throws RangeError on unknown values', () => {
    expect(() => canonicalizeHorseSex('alien')).toThrow(RangeError);
    expect(() => canonicalizeHorseSex('')).toThrow(RangeError);
  });

  it('throws TypeError on non-string input', () => {
    expect(() => canonicalizeHorseSex(null)).toThrow(TypeError);
    expect(() => canonicalizeHorseSex(undefined)).toThrow(TypeError);
    expect(() => canonicalizeHorseSex(42)).toThrow(TypeError);
  });

  it('canonicalizeHorseSexOrNull tolerates null/undefined/empty', () => {
    expect(canonicalizeHorseSexOrNull(null)).toBeNull();
    expect(canonicalizeHorseSexOrNull(undefined)).toBeNull();
    expect(canonicalizeHorseSexOrNull('')).toBeNull();
    expect(canonicalizeHorseSexOrNull('mare')).toBe('Mare');
  });

  it('canonical list contains exactly the expected values', () => {
    expect([...CANONICAL_HORSE_SEX_VALUES].sort()).toEqual(['Colt', 'Filly', 'Mare', 'Rig', 'Stallion']);
  });
});

describe('Prisma $extends — canonicalizes sex on every horse write', () => {
  let breed;

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  beforeAll(async () => {
    breed = await prisma.breed.findFirst();
    if (!breed) {
      throw new Error('Cannot run sex-canonicalization sentinel: no Breed rows exist. Run breed seed first.');
    }
  });

  it('horse.create — lowercase "mare" persists as "Mare"', async () => {
    const created = await prisma.horse.create({
      data: {
        name: `${FIXTURE_NAME_PREFIX}lowercase`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        breedId: breed.id,
      },
    });
    expect(created.sex).toBe('Mare');
    const reread = await prisma.horse.findUnique({ where: { id: created.id } });
    expect(reread.sex).toBe('Mare');
  });

  it('horse.create — uppercase "STALLION" persists as "Stallion"', async () => {
    const created = await prisma.horse.create({
      data: {
        name: `${FIXTURE_NAME_PREFIX}uppercase`,
        sex: 'STALLION',
        dateOfBirth: new Date('2020-01-01'),
        breedId: breed.id,
      },
    });
    expect(created.sex).toBe('Stallion');
  });

  it('horse.create — Title Case "Filly" passes through unchanged', async () => {
    const created = await prisma.horse.create({
      data: {
        name: `${FIXTURE_NAME_PREFIX}titlecase`,
        sex: 'Filly',
        dateOfBirth: new Date('2024-01-01'),
        breedId: breed.id,
      },
    });
    expect(created.sex).toBe('Filly');
  });

  it('horse.create — invalid sex is rejected at the client layer', async () => {
    await expect(
      prisma.horse.create({
        data: {
          name: `${FIXTURE_NAME_PREFIX}invalid`,
          sex: 'alien',
          dateOfBirth: new Date('2020-01-01'),
          breedId: breed.id,
        },
      }),
    ).rejects.toThrow(/not a recognized horse sex/);
  });

  it('horse.update — lowercase "mare" persists as "Mare"', async () => {
    const created = await prisma.horse.create({
      data: {
        name: `${FIXTURE_NAME_PREFIX}update-target`,
        sex: 'colt',
        dateOfBirth: new Date('2024-01-01'),
        breedId: breed.id,
      },
    });
    expect(created.sex).toBe('Colt');
    const updated = await prisma.horse.update({
      where: { id: created.id },
      data: { sex: 'mare' },
    });
    expect(updated.sex).toBe('Mare');
  });

  it('horse.upsert — sex canonicalized on create branch', async () => {
    const upserted = await prisma.horse.upsert({
      where: { id: -424242 },
      update: { sex: 'mare' },
      create: {
        name: `${FIXTURE_NAME_PREFIX}upsert`,
        sex: 'STALLION',
        dateOfBirth: new Date('2020-01-01'),
        breedId: breed.id,
      },
    });
    expect(upserted.sex).toBe('Stallion');
  });

  it('horse.createMany — every row canonicalized', async () => {
    await prisma.horse.createMany({
      data: [
        {
          name: `${FIXTURE_NAME_PREFIX}many-1`,
          sex: 'mare',
          dateOfBirth: new Date('2020-01-01'),
          breedId: breed.id,
        },
        {
          name: `${FIXTURE_NAME_PREFIX}many-2`,
          sex: 'STALLION',
          dateOfBirth: new Date('2020-01-01'),
          breedId: breed.id,
        },
      ],
    });
    const rows = await prisma.horse.findMany({
      where: { name: { startsWith: `${FIXTURE_NAME_PREFIX}many-` } },
      orderBy: { name: 'asc' },
    });
    expect(rows.map(r => r.sex)).toEqual(['Mare', 'Stallion']);
  });
});
