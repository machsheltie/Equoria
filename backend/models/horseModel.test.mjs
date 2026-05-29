import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';

/**
 * Horse Model epigeneticModifiers contract — REAL DB integration tests
 * (Equoria-382n6; updated Equoria-313oc).
 *
 * Per CLAUDE.md Testing Philosophy ("No mocks. Ever. All backend tests run
 * against the real test database"), this suite runs `createHorse()` against
 * the canonical DB with real parent horses.
 *
 * CONTRACT (post Equoria-313oc, review decision B1): `createHorse` is the
 * GENERIC creation path and does NOT roll at-birth epigenetic traits. The
 * former horseModel fallback (Impl B, `utils/atBirthTraits.mjs`) was deleted.
 * At-birth trait assignment now lives exclusively in the live foaling path
 * (`foalingService.createFoalFromPregnancy` → `applyEpigeneticTraitsAtBirth`),
 * which passes the resolved modifiers down to createHorse. Therefore
 * createHorse must:
 *   - persist a well-formed `{ positive, negative, hidden }` structure for a
 *     newborn (defaulting to empty arrays when none supplied),
 *   - persist caller-supplied modifiers VERBATIM (no merge, no extra traits),
 *   - never invoke any at-birth pipeline regardless of age/parents/flags.
 *
 * Fixtures use the `TestFixture-` prefix and scoped (id-keyed) cleanup per
 * CONTRIBUTING.md. No bare `deleteMany()`; no mocks.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { createHorse } from '../models/horseModel.mjs';

const PREFIX = `TestFixture-horseModel-${randomBytes(4).toString('hex')}`;

let breedId;
let sireId;
let damId;
const createdHorseIds = [];

/** Persist a parent horse via the real createHorse path (auto-fills color). */
async function makeParent(suffix, sex) {
  const horse = await createHorse({
    name: `${PREFIX}-${suffix}`,
    age: 5,
    sex,
    dateOfBirth: new Date('2019-01-01'),
    breed: { connect: { id: breedId } },
  });
  createdHorseIds.push(horse.id);
  return horse.id;
}

beforeAll(async () => {
  // Dedicated TestFixture breed so the suite is self-contained and cleanup
  // is fully scoped. Breed name is unique per schema.
  const breed = await prisma.breed.create({
    data: { name: `${PREFIX}-breed`, description: 'at-birth trait fixture breed' },
  });
  breedId = breed.id;

  sireId = await makeParent('sire', 'Stallion');
  damId = await makeParent('dam', 'Mare');
}, 120000);

afterAll(async () => {
  // Scoped cleanup — only the rows this suite created (CLAUDE.md §2).
  if (createdHorseIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    createdHorseIds.length = 0;
  }
  if (breedId) {
    await prisma.breed.deleteMany({ where: { id: breedId } });
  }
});

describe('Horse Model epigeneticModifiers contract (real DB)', () => {
  describe('createHorse never rolls at-birth traits (Equoria-313oc)', () => {
    it('persists a newborn (age 0) with real sire+dam and a well-formed, EMPTY epigeneticModifiers structure', async () => {
      const result = await createHorse({
        name: `${PREFIX}-foal-newborn`,
        age: 0,
        sex: 'Filly',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
        sireId,
        damId,
      });
      createdHorseIds.push(result.id);

      // Round-trip the persisted row (not the in-memory return value) to prove
      // the persisted modifiers actually landed in the DB.
      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted).not.toBeNull();
      expect(persisted.sireId).toBe(sireId);
      expect(persisted.damId).toBe(damId);

      const mods = persisted.epigeneticModifiers;
      expect(mods).toBeTruthy();
      expect(Array.isArray(mods.positive)).toBe(true);
      expect(Array.isArray(mods.negative)).toBe(true);
      expect(Array.isArray(mods.hidden)).toBe(true);
      // SENTINEL: createHorse must NOT roll any at-birth traits even with a
      // real sire+dam newborn — the fallback (Impl B) was removed. If anyone
      // re-introduces an at-birth roll into createHorse, this fails.
      expect(mods).toEqual({ positive: [], negative: [], hidden: [] });
    });

    it('persists caller-supplied modifiers VERBATIM for a newborn (no merge, no extra traits)', async () => {
      const supplied = {
        positive: ['existing_trait'],
        negative: ['existing_negative'],
        hidden: [],
      };
      const result = await createHorse({
        name: `${PREFIX}-foal-merge`,
        age: 0,
        sex: 'Colt',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
        sireId,
        damId,
        epigeneticModifiers: supplied,
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      const mods = persisted.epigeneticModifiers;
      // The caller-supplied traits must be persisted exactly — createHorse does
      // not add stochastic at-birth traits on top.
      expect(mods).toEqual(supplied);
    });

    it('does NOT apply at-birth traits for an older horse (age > 0) — empty modifiers persisted', async () => {
      const result = await createHorse({
        name: `${PREFIX}-adult`,
        age: 5,
        sex: 'Mare',
        dateOfBirth: new Date('2019-01-01'),
        breed: { connect: { id: breedId } },
        sireId,
        damId,
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    });

    it('does NOT apply at-birth traits for a newborn WITHOUT parents — empty modifiers persisted', async () => {
      const result = await createHorse({
        name: `${PREFIX}-foundling`,
        age: 0,
        sex: 'Filly',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted.sireId).toBeNull();
      expect(persisted.damId).toBeNull();
      expect(persisted.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    });

    it('does NOT apply at-birth traits when only a sire is supplied (missing dam)', async () => {
      const result = await createHorse({
        name: `${PREFIX}-sire-only`,
        age: 0,
        sex: 'Colt',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
        sireId,
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    });

    it('does NOT apply at-birth traits when only a dam is supplied (missing sire)', async () => {
      const result = await createHorse({
        name: `${PREFIX}-dam-only`,
        age: 0,
        sex: 'Filly',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
        damId,
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    });

    it('skips the at-birth pipeline when the upstream _epigeneticTraitsApplied flag is set', async () => {
      // When the breeding/foaling layer has already applied traits, the model
      // must NOT re-run the pipeline (prevents double application). It persists
      // exactly the caller-supplied modifiers.
      const supplied = { positive: ['prewired'], negative: [], hidden: ['prehidden'] };
      const result = await createHorse({
        name: `${PREFIX}-preapplied`,
        age: 0,
        sex: 'Colt',
        dateOfBirth: new Date(),
        breed: { connect: { id: breedId } },
        sireId,
        damId,
        epigeneticModifiers: supplied,
        _epigeneticTraitsApplied: true,
      });
      createdHorseIds.push(result.id);

      const persisted = await prisma.horse.findUnique({ where: { id: result.id } });
      expect(persisted.epigeneticModifiers).toEqual(supplied);
    });
  });
});
