/**
 * backfillHorseColors.test.mjs (Equoria-k0d28, GEN-09)
 *
 * The colour backfill gives a phenotype to horses that have none. A horse that
 * already has a colorGenotype (a foal's inherited genes) must keep it, with
 * the phenotype derived from it; a genotype is generated only when there is
 * none. Real database; the backfill is scoped to the horses this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import { backfillHorseColors } from './backfill-horse-colors.mjs';
import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { testHorseData } from '../__tests__/helpers/createTestHorse.mjs';

const stamp = `k0d28_${Date.now()}`;

// A Silver Dapple foal's inherited genes: not something generateGenotype(null)
// produces by chance (starter weights keep Z/n at 3%, a/a at 30%).
const inheritedGenotype = {
  ...fixtureColor().colorGenotype,
  E_Extension: 'E/E',
  A_Agouti: 'a/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'Z/Z',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  LP_LeopardComplex: 'lp/lp',
  Prl_Pearl: 'n/n',
  BR1_Brindle1: 'n/n',
};

let inheritedId;
let genelessId;

async function createHorse(name, colorGenotype) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name,
      sex: 'mare',
      age: 0,
      dateOfBirth: gameCalendarDate(new Date(), 0),
      colorGenotype,
    }),
  });
  // The pre-31E state the backfill exists for: no phenotype.
  await prisma.$executeRaw`UPDATE horses SET phenotype = NULL WHERE id = ${horse.id}`;
  return horse.id;
}

beforeAll(async () => {
  inheritedId = await createHorse(`${stamp}_inherited`, inheritedGenotype);
  genelessId = await createHorse(`${stamp}_geneless`, {});
});

afterAll(async () => {
  const ids = [inheritedId, genelessId].filter(Boolean);
  const { count } = await prisma.horse.deleteMany({ where: { id: { in: ids } } });
  expect(count).toBe(ids.length);
});

describe('backfill-horse-colors (Equoria-k0d28)', () => {
  it('keeps an inherited genotype and derives the phenotype from it; generates one only when empty', async () => {
    const result = await backfillHorseColors({ horseIds: [inheritedId, genelessId], log: () => {} });
    expect(result).toMatchObject({ found: 2, updated: 2, keptGenotype: 1, skipped: 0, failed: 0 });

    const inherited = await prisma.horse.findUnique({ where: { id: inheritedId } });
    expect(inherited.colorGenotype).toEqual(inheritedGenotype);
    expect(inherited.phenotype.colorName).toBe(calculatePhenotype(inheritedGenotype).colorName);
    expect(inherited.phenotype.colorName).toBe('Silver Dapple');

    const geneless = await prisma.horse.findUnique({ where: { id: genelessId } });
    expect(Object.keys(geneless.colorGenotype).length).toBeGreaterThan(0);
    expect(geneless.phenotype.colorName).toBe(calculatePhenotype(geneless.colorGenotype).colorName);
  });

  it('a second run changes nothing (horses with a phenotype are not selected)', async () => {
    const before = await prisma.horse.findUnique({ where: { id: inheritedId } });
    const result = await backfillHorseColors({ horseIds: [inheritedId, genelessId], log: () => {} });
    expect(result).toMatchObject({ found: 0, updated: 0 });
    const after = await prisma.horse.findUnique({ where: { id: inheritedId } });
    expect(after.colorGenotype).toEqual(before.colorGenotype);
    expect(after.phenotype).toEqual(before.phenotype);
  });
});
