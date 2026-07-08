/**
 * horseUpdates — integration tests (Equoria-rr7)
 *
 * Tests updateHorseStat against real DB. (Equoria-709qm slice 2 removed the
 * legacy non-ledger money writers updateHorseEarnings + updateHorseRewards and
 * their coverage here; updateHorseStat remains — out of the money-writer scope.)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { updateHorseStat } from '../../../utils/horseUpdates.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

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
      ...fixtureColor(),
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
