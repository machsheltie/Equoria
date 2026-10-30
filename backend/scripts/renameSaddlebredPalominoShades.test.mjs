/**
 * renameSaddlebredPalominoShades.test.mjs (Equoria-mxu1y, owner ruling q321)
 *
 * Existing Saddlebreds' old Palomino shades are renamed (pale -> Light Palomino,
 * copper -> Dark Palomino, a plain Palomino -> Classic Palomino) and given their
 * new color's portrait; a horse already named right, a chosen non-palomino picture
 * and another breed are left alone; the dry run writes nothing and a second run
 * changes nothing. Real database; the script is scoped to the horses this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import { renamedPalominoPhenotype, renameSaddlebredPalominoShades } from './rename-saddlebred-palomino-shades.mjs';
import { coatImageVariants, defaultHorseImageUrl } from '../modules/horses/services/coatImageService.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { testHorseData } from '../__tests__/helpers/createTestHorse.mjs';

const saddlebred = 'American Saddlebred';
const folder = '/images/breeds/american_saddlebred';
const base = { isGrey: false, isRoan: false };
const variantsOf = colorName => coatImageVariants(saddlebred, { colorName, shade: 'standard' });

describe('renamedPalominoPhenotype (q321)', () => {
  it.each([
    ['Palomino', 'pale', 'Light Palomino'],
    ['Palomino', 'copper', 'Dark Palomino'],
    ['Palomino', 'golden', 'Golden Palomino'],
    ['Palomino', 'chocolate', 'Chocolate Palomino'],
    ['Palomino', 'standard', 'Classic Palomino'],
    ['Palomino', 'classic', 'Classic Palomino'],
    ['Light Palomino', 'pale', 'Light Palomino'],
    ['Dark Palomino', 'copper', 'Dark Palomino'],
  ])('%s/%s -> %s, shade standard', (colorName, shade, expected) => {
    expect(renamedPalominoPhenotype({ ...base, colorName, shade })).toEqual({
      ...base,
      colorName: expected,
      shade: 'standard',
    });
  });

  it('leaves the owner names, and other colors, alone', () => {
    for (const colorName of ['Light Palomino', 'Classic Palomino', 'Dark Palomino', 'Palomino Pearl', 'Standard Bay']) {
      expect(renamedPalominoPhenotype({ ...base, colorName, shade: 'standard' })).toBeNull();
    }
    expect(renamedPalominoPhenotype(null)).toBeNull();
  });
});

describe('renameSaddlebredPalominoShades (Equoria-mxu1y)', () => {
  const stamp = `mxu1yq321_${Date.now()}`;
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
    const chosen = '/images/breeds/american_saddlebred/goldenbay1.webp';
    await createHorse('pale', saddlebred, { ...base, colorName: 'Palomino', shade: 'pale' }, defaultHorseImageUrl);
    await createHorse('copper', saddlebred, { ...base, colorName: 'Palomino', shade: 'copper' }, null);
    // Renamed, and its old palomino portrait is the wrong color: it gets a Dark Palomino one.
    await createHorse(
      'copperStalePortrait',
      saddlebred,
      { ...base, colorName: 'Palomino', shade: 'copper' },
      `${folder}/goldenpalomino1.webp`,
    );
    // Renamed; a picture that is not a palomino portrait is kept.
    await createHorse('paleChosen', saddlebred, { ...base, colorName: 'Palomino', shade: 'pale' }, chosen);
    // Already named right: only a missing picture is filled.
    await createHorse('lightNoPicture', saddlebred, { ...base, colorName: 'Light Palomino', shade: 'standard' }, null);
    await createHorse(
      'lightPictured',
      saddlebred,
      { ...base, colorName: 'Light Palomino', shade: 'standard' },
      `${folder}/lightpalomino2.webp`,
    );
    await createHorse(
      'thoroughbred',
      'Thoroughbred',
      { ...base, colorName: 'Palomino', shade: 'pale' },
      defaultHorseImageUrl,
    );
  }, 60000);

  afterAll(async () => {
    const all = Object.values(ids);
    const { count } = await prisma.horse.deleteMany({ where: { id: { in: all } } });
    expect(count).toBe(all.length);
  }, 60000);

  async function rows() {
    const found = await prisma.horse.findMany({
      where: { id: { in: Object.values(ids) } },
      select: { id: true, imageUrl: true, phenotype: true },
    });
    return Object.fromEntries(
      Object.entries(ids).map(([label, id]) => {
        const row = found.find(r => r.id === id);
        return [label, { colorName: row.phenotype.colorName, shade: row.phenotype.shade, imageUrl: row.imageUrl }];
      }),
    );
  }

  it('dry run writes nothing; apply renames pale/copper and gives the right portraits, once', async () => {
    const horseIds = Object.values(ids);
    const before = await rows();
    const dry = await renameSaddlebredPalominoShades({ horseIds, log: () => {} });
    expect(dry).toEqual({
      checked: 6,
      renamed: 4,
      portraits: 4,
      unchanged: 1,
      skippedChanged: 0,
      renames: { 'Palomino/pale -> Light Palomino': 2, 'Palomino/copper -> Dark Palomino': 2 },
    });
    expect(await rows()).toEqual(before);

    const applied = await renameSaddlebredPalominoShades({ apply: true, horseIds, log: () => {} });
    expect(applied).toEqual(dry);
    const after = await rows();
    expect(after).toMatchObject({
      pale: { colorName: 'Light Palomino', shade: 'standard' },
      copper: { colorName: 'Dark Palomino', shade: 'standard' },
      copperStalePortrait: { colorName: 'Dark Palomino', shade: 'standard' },
      paleChosen: {
        colorName: 'Light Palomino',
        shade: 'standard',
        imageUrl: '/images/breeds/american_saddlebred/goldenbay1.webp',
      },
      lightNoPicture: { colorName: 'Light Palomino', shade: 'standard' },
      lightPictured: before.lightPictured,
      thoroughbred: before.thoroughbred,
    });
    expect(variantsOf('Light Palomino')).toEqual([`${folder}/lightpalomino1.webp`, `${folder}/lightpalomino2.webp`]);
    expect(variantsOf('Dark Palomino')).toEqual([`${folder}/darkpalomino1.webp`, `${folder}/darkpalomino2.webp`]);
    expect(variantsOf('Light Palomino')).toContain(after.pale.imageUrl);
    expect(variantsOf('Light Palomino')).toContain(after.lightNoPicture.imageUrl);
    expect(variantsOf('Dark Palomino')).toContain(after.copper.imageUrl);
    expect(variantsOf('Dark Palomino')).toContain(after.copperStalePortrait.imageUrl);

    const again = await renameSaddlebredPalominoShades({ apply: true, horseIds, log: () => {} });
    expect(again).toEqual({ checked: 6, renamed: 0, portraits: 0, unchanged: 6, skippedChanged: 0, renames: {} });
    expect(await rows()).toEqual(after);
  }, 60000);
});
