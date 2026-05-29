/**
 * Integration Test: Horse Model epigeneticModifiers contract — Real Database
 * (updated Equoria-313oc).
 *
 * Tests the createHorse() function with real DB. No game-mechanic mocks.
 *
 * CONTRACT (post Equoria-313oc): createHorse is the generic creation path and
 * does NOT roll at-birth epigenetic traits — the former horseModel fallback
 * (Impl B, `utils/atBirthTraits.mjs`) was deleted. At-birth assignment lives
 * only in `foalingService.createFoalFromPregnancy`. So createHorse:
 * - persists a well-formed { positive, negative, hidden } shape for a newborn
 *   (empty arrays when none supplied),
 * - persists caller-supplied epigeneticModifiers VERBATIM (no merge),
 * - never applies at-birth traits for adults, foundlings, or single-parent foals.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createHorse } from '../services/horseModelService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const UNIQUE = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

let breed;
let sire;
let dam;
const createdHorseIds = [];

beforeAll(async () => {
  breed =
    (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ||
    (await prisma.breed.create({ data: { name: 'Thoroughbred', description: 'Test breed' } }));

  sire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Sire_AtBirth_${UNIQUE}`,
      sex: 'Stallion',
      age: 5,
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      breed: { connect: { id: breed.id } },
      healthStatus: 'Good',
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    },
  });

  dam = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `Dam_AtBirth_${UNIQUE}`,
      sex: 'Mare',
      age: 5,
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      breed: { connect: { id: breed.id } },
      healthStatus: 'Good',
      stressLevel: 25,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    },
  });
});

afterAll(async () => {
  if (createdHorseIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  await prisma.horse.deleteMany({ where: { id: sire.id } });
  await prisma.horse.deleteMany({ where: { id: dam.id } });
});

describe('Horse Model epigeneticModifiers contract — Real Database', () => {
  it('creates a foal with correct (empty) epigeneticModifiers shape when both parents present', async () => {
    const foal = await createHorse({
      name: `Foal_WithParents_${UNIQUE}`,
      sex: 'Mare',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      sireId: sire.id,
      damId: dam.id,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    });

    createdHorseIds.push(foal.id);

    expect(foal).toBeDefined();
    expect(foal.id).toBeDefined();
    expect(foal.epigeneticModifiers).toBeDefined();
    expect(Array.isArray(foal.epigeneticModifiers.positive)).toBe(true);
    expect(Array.isArray(foal.epigeneticModifiers.negative)).toBe(true);
    expect(Array.isArray(foal.epigeneticModifiers.hidden)).toBe(true);
    // SENTINEL (Equoria-313oc): createHorse must NOT roll at-birth traits even
    // for a real sire+dam newborn. The Impl B fallback was removed.
    expect(foal.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('persists caller-supplied epigenetic traits VERBATIM (no merge, no extra traits)', async () => {
    const existingTraits = {
      positive: ['existing_positive_trait'],
      negative: ['existing_negative_trait'],
      hidden: [],
    };

    const foal = await createHorse({
      name: `Foal_MergeTraits_${UNIQUE}`,
      sex: 'Stallion',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      sireId: sire.id,
      damId: dam.id,
      epigeneticModifiers: existingTraits,
    });

    createdHorseIds.push(foal.id);

    // Supplied traits must be persisted exactly — createHorse does not add
    // stochastic at-birth traits on top.
    expect(foal.epigeneticModifiers).toEqual(existingTraits);
  });

  it('creates adult horse (age > 0) with empty epigeneticModifiers — no at-birth traits', async () => {
    const adult = await createHorse({
      name: `Adult_NoAtBirth_${UNIQUE}`,
      sex: 'Mare',
      age: 5,
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      breed: { connect: { id: breed.id } },
      sireId: sire.id,
      damId: dam.id,
    });

    createdHorseIds.push(adult.id);

    // Age > 0 → at-birth traits should NOT be applied
    expect(adult.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('creates foundling foal (no parents) with empty epigeneticModifiers', async () => {
    const foundling = await createHorse({
      name: `Foundling_${UNIQUE}`,
      sex: 'Stallion',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
    });

    createdHorseIds.push(foundling.id);

    expect(foundling.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('creates foal even when sireId is missing — no trait application', async () => {
    const foal = await createHorse({
      name: `Foal_NoSire_${UNIQUE}`,
      sex: 'Mare',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      damId: dam.id, // only dam, no sire
    });

    createdHorseIds.push(foal.id);

    expect(foal).toBeDefined();
    // No at-birth traits since sire is missing
    expect(foal.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('creates foal even when damId is missing — no trait application', async () => {
    const foal = await createHorse({
      name: `Foal_NoDam_${UNIQUE}`,
      sex: 'Stallion',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      sireId: sire.id, // only sire, no dam
    });

    createdHorseIds.push(foal.id);

    expect(foal).toBeDefined();
    expect(foal.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('uses _epigeneticTraitsApplied flag to skip trait re-application (double-apply prevention)', async () => {
    // When the controller has already applied traits (createFoal flow), it sets
    // _epigeneticTraitsApplied = true to prevent double application in the model.
    // The model should use whatever epigeneticModifiers were passed and NOT call atBirthTraits again.
    const preAppliedTraits = {
      positive: ['controller_applied_trait'],
      negative: [],
      hidden: [],
    };

    const foal = await createHorse({
      name: `Foal_PreApplied_${UNIQUE}`,
      sex: 'Mare',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      sireId: sire.id,
      damId: dam.id,
      epigeneticModifiers: preAppliedTraits,
      _epigeneticTraitsApplied: true, // signal: skip atBirthTraits
    });

    createdHorseIds.push(foal.id);

    expect(foal).toBeDefined();
    // The pre-applied traits must be preserved exactly — no additional at-birth traits added
    expect(foal.epigeneticModifiers.positive).toContain('controller_applied_trait');
  });

  it('correctly links sire and dam on the created horse record', async () => {
    const foal = await createHorse({
      name: `Foal_Linked_${UNIQUE}`,
      sex: 'Mare',
      age: 0,
      dateOfBirth: new Date(),
      breed: { connect: { id: breed.id } },
      sireId: sire.id,
      damId: dam.id,
    });

    createdHorseIds.push(foal.id);

    expect(foal.sireId).toBe(sire.id);
    expect(foal.damId).toBe(dam.id);
  });
});
