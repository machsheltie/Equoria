/**
 * Integration Test: horseModel.createHorse — Auto-generate colorGenotype + phenotype
 *
 * Equoria-ennm: Any caller that omits colorGenotype/phenotype must NOT produce a
 * NULL-phenotype horse. The model layer must auto-generate both from the breed's
 * breedGeneticProfile so structural drift (new caller forgets to pass color
 * genetics) cannot ship a horse with NULL phenotype past the sentinel.
 *
 * Real DB. No mocks of game mechanics.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createHorse } from '../../../models/horseModel.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const PREFIX = `TestFixture-AutoColor-${UNIQUE}-`;

let breed;
const createdHorseIds = [];

beforeAll(async () => {
  breed =
    (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ||
    (await prisma.breed.create({ data: { name: 'Thoroughbred', description: 'Test breed' } }));
});

afterAll(async () => {
  if (createdHorseIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

describe('horseModel.createHorse — auto color genetics (Equoria-ennm)', () => {
  it('auto-generates colorGenotype + phenotype when caller omits them (breedId path)', async () => {
    const horse = await createHorse({
      name: `${PREFIX}NoColor1`,
      age: 3,
      sex: 'Mare',
      breedId: breed.id,
      dateOfBirth: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000),
    });
    createdHorseIds.push(horse.id);

    // Re-fetch using raw SQL to read JSONB columns directly — Prisma client
    // sometimes uses stale schema; the AC requires the DB row to have non-null
    // values for both fields.
    const rows = await prisma.$queryRaw`
      SELECT "colorGenotype", phenotype
      FROM horses
      WHERE id = ${horse.id}
    `;
    expect(rows).toHaveLength(1);
    const { colorGenotype, phenotype } = rows[0];

    expect(colorGenotype).not.toBeNull();
    expect(typeof colorGenotype).toBe('object');
    expect(Object.keys(colorGenotype).length).toBeGreaterThan(0);
    // Core loci must be present after auto-generation.
    expect(colorGenotype).toHaveProperty('E_Extension');
    expect(colorGenotype).toHaveProperty('A_Agouti');

    expect(phenotype).not.toBeNull();
    expect(typeof phenotype).toBe('object');
    expect(phenotype).toHaveProperty('colorName');
    expect(typeof phenotype.colorName).toBe('string');
    expect(phenotype.colorName.length).toBeGreaterThan(0);
  });

  it('auto-generates colorGenotype + phenotype when caller omits them (breed.connect path)', async () => {
    const horse = await createHorse({
      name: `${PREFIX}NoColor2`,
      age: 3,
      sex: 'Stallion',
      breed: { connect: { id: breed.id } },
      dateOfBirth: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000),
    });
    createdHorseIds.push(horse.id);

    const rows = await prisma.$queryRaw`
      SELECT "colorGenotype", phenotype
      FROM horses
      WHERE id = ${horse.id}
    `;
    const { colorGenotype, phenotype } = rows[0];

    expect(colorGenotype).not.toBeNull();
    expect(phenotype).not.toBeNull();
    expect(phenotype).toHaveProperty('colorName');
  });

  it('preserves explicit colorGenotype + phenotype when caller provides them', async () => {
    const explicitGenotype = { E_Extension: 'E/E', A_Agouti: 'a/a' };
    const explicitPhenotype = { colorName: 'Black', shade: 'standard' };

    const horse = await createHorse({
      name: `${PREFIX}WithColor`,
      age: 3,
      sex: 'Mare',
      breedId: breed.id,
      dateOfBirth: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000),
      colorGenotype: explicitGenotype,
      phenotype: explicitPhenotype,
    });
    createdHorseIds.push(horse.id);

    const rows = await prisma.$queryRaw`
      SELECT "colorGenotype", phenotype
      FROM horses
      WHERE id = ${horse.id}
    `;
    const { colorGenotype, phenotype } = rows[0];

    // Caller-supplied values must NOT be overwritten by auto-generation.
    expect(colorGenotype.E_Extension).toBe('E/E');
    expect(colorGenotype.A_Agouti).toBe('a/a');
    expect(phenotype.colorName).toBe('Black');
  });
});
