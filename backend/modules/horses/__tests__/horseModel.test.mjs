/**
 * Horse Model — Discipline Score Tests
 *
 * Tests updateDisciplineScore and getDisciplineScores end-to-end against the
 * real DB. No mocks of any kind.
 *
 * Fixtures:
 *   - Horses created per-test via prisma.horse.create (no breed required)
 *
 * Cleanup: suite afterAll prefix-scoped, fail-loud deleteMany (Equoria-pemoo).
 *   Each test uses a unique PREFIX suffix, so the single sweep covers all
 *   fixtures with no per-test swallowed delete.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { updateDisciplineScore, getDisciplineScores } from '../services/horseModelService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-HorseModel-';

// ─── fixtures ─────────────────────────────────────────────────────────────────

async function mkHorse(suffix) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
    },
  });
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

// ─── updateDisciplineScore ────────────────────────────────────────────────────

describe('updateDisciplineScore', () => {
  it('sets a discipline score for a horse with no prior scores', async () => {
    const horse = await mkHorse('UDS1');
    const result = await updateDisciplineScore(horse.id, 'Dressage', 5);

    expect(result.disciplineScores).toEqual({ Dressage: 5 });
  });

  it('accumulates points on a second call to the same discipline', async () => {
    const horse = await mkHorse('UDS2');
    await updateDisciplineScore(horse.id, 'Dressage', 5);
    const result = await updateDisciplineScore(horse.id, 'Dressage', 5);

    expect(result.disciplineScores.Dressage).toBe(10);
  });

  it('tracks multiple disciplines independently on the same horse', async () => {
    const horse = await mkHorse('UDS3');
    await updateDisciplineScore(horse.id, 'Dressage', 5);
    const result = await updateDisciplineScore(horse.id, 'Show Jumping', 3);

    expect(result.disciplineScores).toEqual({ Dressage: 5, 'Show Jumping': 3 });
  });

  it('throws for an invalid horse ID', async () => {
    await expect(updateDisciplineScore(-1, 'Dressage', 5)).rejects.toThrow('Invalid horse ID provided');
    await expect(updateDisciplineScore('invalid', 'Dressage', 5)).rejects.toThrow('Invalid horse ID provided');
  });

  it('throws when the horse does not exist', async () => {
    await expect(updateDisciplineScore(999999999, 'Dressage', 5)).rejects.toThrow('Horse with ID 999999999 not found');
  });

  it('throws for an empty or null discipline name', async () => {
    const horse = await mkHorse('UDS6');
    await expect(updateDisciplineScore(horse.id, '', 5)).rejects.toThrow('Discipline must be a non-empty string');
    await expect(updateDisciplineScore(horse.id, null, 5)).rejects.toThrow('Discipline must be a non-empty string');
  });

  it('throws for non-positive points values', async () => {
    const horse = await mkHorse('UDS7');
    await expect(updateDisciplineScore(horse.id, 'Dressage', 0)).rejects.toThrow(
      'Points to add must be a positive number',
    );
    await expect(updateDisciplineScore(horse.id, 'Dressage', -5)).rejects.toThrow(
      'Points to add must be a positive number',
    );
    await expect(updateDisciplineScore(horse.id, 'Dressage', 'invalid')).rejects.toThrow(
      'Points to add must be a positive number',
    );
  });
});

// ─── getDisciplineScores ──────────────────────────────────────────────────────

describe('getDisciplineScores', () => {
  it('returns an empty object for a horse with no discipline scores', async () => {
    const horse = await mkHorse('GDS1');
    const scores = await getDisciplineScores(horse.id);

    expect(scores).toEqual({});
  });

  it('returns the current scores after they have been set', async () => {
    const horse = await mkHorse('GDS2');
    await updateDisciplineScore(horse.id, 'Dressage', 5);
    await updateDisciplineScore(horse.id, 'Show Jumping', 3);

    const scores = await getDisciplineScores(horse.id);

    expect(scores).toEqual({ Dressage: 5, 'Show Jumping': 3 });
  });

  it('throws for an invalid horse ID', async () => {
    await expect(getDisciplineScores(-1)).rejects.toThrow('Invalid horse ID provided');
    await expect(getDisciplineScores('invalid')).rejects.toThrow('Invalid horse ID provided');
  });

  it('throws when the horse does not exist', async () => {
    await expect(getDisciplineScores(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });
});
