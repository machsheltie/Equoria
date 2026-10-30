/**
 * assignClassicPalominoPortraits.test.mjs (Equoria-mxu1y, owner ruling q320)
 *
 * Existing Classic Palomino Saddlebreds with no picture get one of the two Classic
 * Palomino portraits; a horse with a picture, another color and another breed are
 * left alone; the dry run writes nothing and a second run changes nothing.
 * Real database; the script is scoped to the horses this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import { assignClassicPalominoPortraits } from './assign-classic-palomino-portraits.mjs';
import { coatImageVariants, defaultHorseImageUrl } from '../modules/horses/services/coatImageService.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { testHorseData } from '../__tests__/helpers/createTestHorse.mjs';

const saddlebred = 'American Saddlebred';
const classicPalomino = { colorName: 'Classic Palomino', shade: 'standard', isGrey: false, isRoan: false };
const chosenPicture = '/images/breeds/american_saddlebred/goldenpalomino1.webp';

describe('assignClassicPalominoPortraits (Equoria-mxu1y)', () => {
  const stamp = `mxu1y_${Date.now()}`;
  const ids = {};

  async function createHorse(label, breedName, phenotype, imageUrl) {
    const breed = await prisma.breed.findUnique({ where: { name: breedName }, select: { id: true } });
    if (!breed) {
      throw new Error(`Seeded breed "${breedName}" is missing; run npm run seed:breeds.`);
    }
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${stamp}_${label}`,
        sex: 'mare',
        age: 4,
        dateOfBirth: gameCalendarDate(new Date(), -4),
        breedId: breed.id,
      }),
    });
    await prisma.$executeRaw`
      UPDATE horses SET phenotype = ${JSON.stringify(phenotype)}::jsonb, "imageUrl" = ${imageUrl}
      WHERE id = ${horse.id}`;
    ids[label] = horse.id;
  }

  beforeAll(async () => {
    await createHorse('default', saddlebred, classicPalomino, defaultHorseImageUrl);
    await createHorse('empty', saddlebred, classicPalomino, null);
    await createHorse('chosen', saddlebred, classicPalomino, chosenPicture);
    await createHorse('golden', saddlebred, { ...classicPalomino, colorName: 'Golden Palomino' }, defaultHorseImageUrl);
    await createHorse('thoroughbred', 'Thoroughbred', classicPalomino, defaultHorseImageUrl);
  }, 60000);

  afterAll(async () => {
    const all = Object.values(ids);
    const { count } = await prisma.horse.deleteMany({ where: { id: { in: all } } });
    expect(count).toBe(all.length);
  }, 60000);

  async function pictures() {
    const rows = await prisma.horse.findMany({
      where: { id: { in: Object.values(ids) } },
      select: { id: true, imageUrl: true },
    });
    return Object.fromEntries(
      Object.entries(ids).map(([label, id]) => [label, rows.find(row => row.id === id).imageUrl]),
    );
  }

  it('dry run writes nothing; apply gives each pictureless Classic Palomino Saddlebred one portrait, once', async () => {
    const horseIds = Object.values(ids);
    const dry = await assignClassicPalominoPortraits({ horseIds, log: () => {} });
    expect(dry).toEqual({ checked: 3, assigned: 2, kept: 1, skippedChanged: 0 });
    const before = await pictures();
    expect(before).toEqual({
      default: defaultHorseImageUrl,
      empty: null,
      chosen: chosenPicture,
      golden: defaultHorseImageUrl,
      thoroughbred: defaultHorseImageUrl,
    });

    const applied = await assignClassicPalominoPortraits({ apply: true, horseIds, log: () => {} });
    expect(applied).toEqual({ checked: 3, assigned: 2, kept: 1, skippedChanged: 0 });
    const after = await pictures();
    const variants = coatImageVariants(saddlebred, classicPalomino);
    expect(variants).toEqual([
      '/images/breeds/american_saddlebred/classicpalomino1.webp',
      '/images/breeds/american_saddlebred/classicpalomino2.webp',
    ]);
    expect(variants).toContain(after.default);
    expect(variants).toContain(after.empty);
    expect(after).toMatchObject({
      chosen: chosenPicture,
      golden: defaultHorseImageUrl,
      thoroughbred: defaultHorseImageUrl,
    });

    const again = await assignClassicPalominoPortraits({ apply: true, horseIds, log: () => {} });
    expect(again).toEqual({ checked: 3, assigned: 0, kept: 3, skippedChanged: 0 });
    expect(await pictures()).toEqual(after);
  }, 60000);
});
