/**
 * renameCoatColors.test.mjs (Equoria-7woyj)
 *
 * The one-time rename of stored horse colors to the owner's 2026-10-29 names:
 * each old name maps to the new one, a color family folds its stored shade into
 * the name, a stored name always ends equal to what the name calculation gives
 * the same genes, isGray becomes isGrey, and a second run changes nothing.
 * Real database; the rename is scoped to the horses this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import { renamedPhenotype, renameStoredCoatColors } from './rename-coat-colors.mjs';
import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { testHorseData } from '../__tests__/helpers/createTestHorse.mjs';

const wildType = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
  Prl_Pearl: 'n/n',
  BR1_Brindle1: 'n/n',
};
const genes = overrides => ({ ...wildType, ...overrides });
const oldPhenotype = (colorName, shade = 'standard') => ({ colorName, shade, isGray: false, isRoan: false });

// [stored name, stored shade, genes] -> [new name, new shade]
const cases = [
  ['Bay', 'dark', genes({}), 'Mahogany Bay', 'standard'],
  ['Bay', 'standard', genes({}), 'Standard Bay', 'standard'],
  ['Black', 'faded', genes({ A_Agouti: 'a/a' }), 'Fading Black', 'standard'],
  ['Chestnut', 'medium', genes({ E_Extension: 'e/e' }), 'Red Chestnut', 'standard'],
  ['Palomino', 'pale', genes({ E_Extension: 'e/e', Cr_Cream: 'Cr/n' }), 'Light Palomino', 'standard'],
  ['Palomino', 'standard', genes({ E_Extension: 'e/e', Cr_Cream: 'Cr/n' }), 'Classic Palomino', 'standard'],
  ['Buckskin', 'burnished', genes({ Cr_Cream: 'Cr/n' }), 'Classic Buckskin', 'standard'],
  ['Seal Brown', 'sealskin', genes({ A_Agouti: 'At/a' }), 'Sealskin', 'standard'],
  ['Apricot', 'standard', genes({ E_Extension: 'e/e', Prl_Pearl: 'prl/prl' }), 'Chestnut Pearl', 'standard'],
  ['Pearl Black', 'standard', genes({ A_Agouti: 'a/a', Prl_Pearl: 'prl/prl' }), 'Black Pearl', 'standard'],
  ['Smoky Seal Brown', 'standard', genes({ A_Agouti: 'At/a', Cr_Cream: 'Cr/n' }), 'Seal Buckskin', 'standard'],
  ['Silver Dapple', 'standard', genes({ A_Agouti: 'a/a', Z_Silver: 'Z/n' }), 'Silver Black', 'standard'],
  [
    'Silver Dapple',
    'standard',
    genes({ A_Agouti: 'a/a', Z_Silver: 'Z/n', Cr_Cream: 'Cr/n' }),
    'Silver Smoky Black',
    'standard',
  ],
  ['Amber Dun Champagne', 'tan', genes({ Ch_Champagne: 'Ch/n', D_Dun: 'D/nd2' }), 'Amber Champagne Dun', 'tan'],
  ['Red Roan', 'rose', genes({ E_Extension: 'e/e', Rn_Roan: 'Rn/rn' }), 'Red Roan', 'rose'],
  ['Red Roan', 'rose', genes({ E_Extension: 'e/e', Cr_Cream: 'Cr/n', Rn_Roan: 'Rn/rn' }), 'Palomino Roan', 'standard'],
  ['Blue Roan', 'cool gray', genes({ A_Agouti: 'a/a', Rn_Roan: 'Rn/rn' }), 'Blue Roan', 'cool grey'],
  ['Grulla', 'silver gray', genes({ A_Agouti: 'a/a', D_Dun: 'D/nd2' }), 'Grulla', 'silver grey'],
  ['Dominant White', 'white', genes({ W_DominantWhite: 'W22/w' }), 'Dominant White Sabino', 'standard'],
  ['Dominant White', 'white', genes({ W_DominantWhite: 'W20/w' }), 'Dominant White', 'white'],
  [
    'Ivory Champagne',
    'standard',
    genes({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n', Prl_Pearl: 'prl/n' }),
    'Gold Cream Pearl Champagne',
    'standard',
  ],
];

describe('renamedPhenotype (Equoria-7woyj)', () => {
  it.each(cases)('%s/%s becomes the owner name', (name, shade, genotype, newName, newShade) => {
    const next = renamedPhenotype(oldPhenotype(name, shade), genotype);
    expect(next).toEqual({ colorName: newName, shade: newShade, isGrey: false, isRoan: false });
    // A new horse with these genes that rolled the stored shade gets the same name.
    const rolledStoredShade = new Proxy({}, { get: () => ({ [shade]: 1 }) });
    expect(calculatePhenotype(genotype, rolledStoredShade).colorName).toBe(newName);
  });

  it('renames a grey by its genes, spelled grey, with shade standard', () => {
    const genotype = genes({ G_Gray: 'G/g' });
    const fresh = calculatePhenotype(genotype);
    const next = renamedPhenotype({ colorName: 'Steel Gray', shade: 'steel', isGray: true }, genotype);
    expect(next).toEqual({ colorName: fresh.colorName, shade: 'standard', isGrey: true });
    expect(next.colorName).toMatch(/Grey$/);
  });

  it('renames a horse with no genes by name alone', () => {
    expect(renamedPhenotype(oldPhenotype('Bay', 'blood'), {})).toMatchObject({
      colorName: 'Blood Bay',
      shade: 'standard',
    });
    expect(renamedPhenotype(oldPhenotype('Steel Gray', 'steel'), null)).toMatchObject({
      colorName: 'Steel Grey',
      shade: 'standard',
    });
    expect(renamedPhenotype(oldPhenotype('Silver Roan'), {})).toMatchObject({ colorName: 'Silver Blue Roan' });
  });

  it('leaves new names, hand-written names and non-objects alone', () => {
    expect(renamedPhenotype({ colorName: 'Mahogany Bay', shade: 'standard' }, genes({}))).toBeNull();
    expect(renamedPhenotype({ colorName: 'Painted Sky', shade: 'standard' }, genes({}))).toBeNull();
    expect(renamedPhenotype(null, genes({}))).toBeNull();
    expect(renamedPhenotype([], genes({}))).toBeNull();
  });
});

describe('renameStoredCoatColors on stored horses (Equoria-7woyj)', () => {
  const stamp = `7woyj_${Date.now()}`;
  const ids = [];

  async function createHorse(name, colorGenotype, phenotype) {
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name,
        sex: 'mare',
        age: 4,
        dateOfBirth: gameCalendarDate(new Date(), -4),
        colorGenotype,
      }),
    });
    await prisma.$executeRaw`UPDATE horses SET phenotype = ${JSON.stringify(phenotype)}::jsonb WHERE id = ${horse.id}`;
    ids.push(horse.id);
    return horse.id;
  }

  beforeAll(async () => {
    await createHorse(`${stamp}_bay`, genes({}), oldPhenotype('Bay', 'dark'));
    await createHorse(`${stamp}_roan`, genes({ Cr_Cream: 'Cr/n', Rn_Roan: 'Rn/rn' }), oldPhenotype('Bay Roan'));
    await createHorse(`${stamp}_new`, genes({}), { colorName: 'Golden Bay', shade: 'standard', isGrey: false });
  });

  afterAll(async () => {
    const { count } = await prisma.horse.deleteMany({ where: { id: { in: ids } } });
    expect(count).toBe(ids.length);
  });

  it('dry run writes nothing; apply renames, and a second run changes nothing', async () => {
    const dry = await renameStoredCoatColors({ horseIds: ids, log: () => {} });
    expect(dry).toMatchObject({ checked: 3, renamed: 2, unchanged: 1, skippedChanged: 0 });
    const before = await prisma.horse.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    expect(before.map(h => h.phenotype.colorName)).toEqual(['Bay', 'Bay Roan', 'Golden Bay']);

    const applied = await renameStoredCoatColors({ apply: true, horseIds: ids, log: () => {} });
    expect(applied).toMatchObject({ checked: 3, renamed: 2, unchanged: 1, skippedChanged: 0 });
    const after = await prisma.horse.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    expect(after.map(h => [h.phenotype.colorName, h.phenotype.shade])).toEqual([
      ['Mahogany Bay', 'standard'],
      ['Buckskin Roan', 'standard'],
      ['Golden Bay', 'standard'],
    ]);
    expect(after[0].phenotype).toHaveProperty('isGrey', false);
    expect(after[0].phenotype).not.toHaveProperty('isGray');

    const again = await renameStoredCoatColors({ apply: true, horseIds: ids, log: () => {} });
    expect(again).toMatchObject({ checked: 3, renamed: 0, unchanged: 3 });
  });
});
