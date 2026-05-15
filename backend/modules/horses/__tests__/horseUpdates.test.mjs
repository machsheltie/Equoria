/**
 * horseUpdates — integration tests (Equoria-rr7)
 *
 * Tests updateHorseEarnings, updateHorseStat, updateHorseRewards against real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { updateHorseEarnings, updateHorseStat, updateHorseRewards } from '../../../utils/horseUpdates.mjs';

const RUN_ID = `${randomBytes(4).toString('hex')}_${Math.floor(Math.random() * 100000)}`;
const PREFIX = `HORSUPD_TEST_${RUN_ID}`;

let testUser, testBreed, testHorse;

beforeAll(async () => {
  testBreed = await prisma.breed.create({
    data: { name: `${PREFIX}_breed` },
  });
  testUser = await prisma.user.create({
    data: {
      username: `${PREFIX}_user`,
      email: `horsupd_${RUN_ID}@test.invalid`,
      password: 'x',
      firstName: 'HU',
      lastName: 'Test',
    },
  });
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  testHorse = await prisma.horse.create({
    data: {
      name: `${PREFIX}_horse`,
      breed: { connect: { id: testBreed.id } },
      user: { connect: { id: testUser.id } },
      age: 5,
      sex: 'Stallion',
      dateOfBirth: fiveYearsAgo,
    },
  });
}, 120000); // 120s — DB creates can be slow under full-suite load

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.breed.deleteMany({ where: { name: { startsWith: PREFIX } } });
}, 120000); // 120s — cascade deletes can be slow under full-suite load

// ---------------------------------------------------------------------------
// updateHorseEarnings
// ---------------------------------------------------------------------------
describe('updateHorseEarnings', () => {
  it('increments horse earnings', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { earnings: true },
    });
    await updateHorseEarnings(testHorse.id, 200);
    const after = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { earnings: true },
    });
    expect(Number(after.earnings)).toBe(Number(before.earnings) + 200);
  });

  it('throws for invalid horseId (null)', async () => {
    await expect(updateHorseEarnings(null, 100)).rejects.toThrow('Valid horse ID is required');
  });

  it('throws for invalid horseId (0)', async () => {
    await expect(updateHorseEarnings(0, 100)).rejects.toThrow('Valid horse ID is required');
  });

  it('throws for invalid horseId (string)', async () => {
    await expect(updateHorseEarnings('abc', 100)).rejects.toThrow('Valid horse ID is required');
  });

  it('throws for negative prize amount', async () => {
    await expect(updateHorseEarnings(testHorse.id, -50)).rejects.toThrow('Valid prize amount is required');
  });

  it('throws for non-number prize amount', async () => {
    await expect(updateHorseEarnings(testHorse.id, 'lots')).rejects.toThrow('Valid prize amount is required');
  });
});

// ---------------------------------------------------------------------------
// updateHorseStat
// ---------------------------------------------------------------------------
describe('updateHorseStat', () => {
  it('increments a valid stat', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { speed: true },
    });
    await updateHorseStat(testHorse.id, 'speed', 5);
    const after = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { speed: true },
    });
    expect(after.speed).toBe(before.speed + 5);
  });

  it('defaults increase to 1', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { stamina: true },
    });
    await updateHorseStat(testHorse.id, 'stamina');
    const after = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { stamina: true },
    });
    expect(after.stamina).toBe(before.stamina + 1);
  });

  it('throws for invalid stat name', async () => {
    await expect(updateHorseStat(testHorse.id, 'notAStatName', 1)).rejects.toThrow('Invalid stat name');
  });

  it('throws for invalid horseId', async () => {
    await expect(updateHorseStat(null, 'speed', 1)).rejects.toThrow('Valid horse ID is required');
  });

  it('throws for invalid statName (number)', async () => {
    await expect(updateHorseStat(testHorse.id, 42, 1)).rejects.toThrow('Valid stat name');
  });

  it('throws for zero increase', async () => {
    await expect(updateHorseStat(testHorse.id, 'speed', 0)).rejects.toThrow('Valid increase amount is required');
  });

  it('accepts all valid stat names', async () => {
    const validStats = ['agility', 'balance', 'precision', 'intelligence', 'boldness'];
    for (const stat of validStats) {
      await expect(updateHorseStat(testHorse.id, stat, 1)).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// updateHorseRewards
// ---------------------------------------------------------------------------
describe('updateHorseRewards', () => {
  it('updates earnings and returns horse', async () => {
    const updated = await updateHorseRewards(testHorse.id, 100, null);
    expect(updated).toBeDefined();
    expect(updated.id).toBe(testHorse.id);
  });

  it('applies stat gain when provided', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { obedience: true },
    });
    await updateHorseRewards(testHorse.id, 50, { stat: 'obedience', gain: 2 });
    const after = await prisma.horse.findUnique({
      where: { id: testHorse.id },
      select: { obedience: true },
    });
    expect(after.obedience).toBe(before.obedience + 2);
  });

  it('skips stat gain when statGain is null', async () => {
    await expect(updateHorseRewards(testHorse.id, 50, null)).resolves.toBeDefined();
  });

  it('catch block fires and re-throws when updateHorseEarnings throws (lines 131-134)', async () => {
    // null horseId → updateHorseEarnings validates and throws → propagates to catch block
    await expect(updateHorseRewards(null, 100)).rejects.toThrow('Valid horse ID is required');
  });
});
