/**
 * The discipline trait is +5 flat points at a show, before the percentages
 * (Equoria-n7ph5).
 *
 * Owner rulings 2026-10-20/21: every horse has exactly one discipline trait, worth +5 at
 * every show in that discipline, added to the base score BEFORE the luck, rider,
 * temperament and health percentages (tack and trait bonuses are flat points). The +5 a
 * store or starter horse is born with comes from its breed (the approved q232 list in
 * breeds.defaultTrait), read here from the real seeded breed rows.
 *
 * Real DB for the breed, real scorer, no mocks; the only seam is the luck rng.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { breedBirthDisciplineScores } from '../../horses/index.mjs';
import { scoreShowEntries } from '../services/competitionScoring.mjs';

const flat = v => ({
  speed: v,
  stamina: v,
  agility: v,
  balance: v,
  precision: v,
  intelligence: v,
  boldness: v,
  flexibility: v,
  obedience: v,
  focus: v,
});

let birthScores;
let discipline;

beforeAll(async () => {
  const breeds = await prisma.breed.findMany({
    select: { id: true, defaultTrait: true, breedGeneticProfile: true },
    orderBy: { id: 'asc' },
  });
  for (const breed of breeds) {
    const scores = breedBirthDisciplineScores(breed);
    const [name] = Object.keys(scores ?? {});
    if (name && name !== 'Racing' && name !== 'Gaited') {
      birthScores = scores;
      discipline = name;
      break;
    }
  }
  if (!discipline) {
    throw new Error('needs the seeded breeds with their approved defaults; refusing to skip.');
  }
});

describe('the discipline trait at a show (Equoria-n7ph5)', () => {
  const scoreIn = (horse, showDiscipline) =>
    scoreShowEntries({
      show: { id: 0, discipline: showDiscipline },
      entries: [{ horseId: 1, horse }],
      assignmentByHorseId: new Map(),
      rng: () => 0.999999, // luck +10%
    })[0];

  it("is born as +5 in the breed's discipline", () => {
    expect(birthScores).toEqual({ [discipline]: 5 });
  });

  it('adds 5 to the base in that discipline, before the percentages, and nothing in another', () => {
    const horse = {
      id: 1,
      name: 'TestFixture-n7ph5-show',
      temperament: null,
      epigeneticFlags: null,
      disciplineScores: birthScores,
      ...careForHealth('Good'),
      ...flat(100),
    };

    const own = scoreIn(horse, discipline);
    expect(own.breakdown.trainingPoints).toBe(5);
    // (100 + 5) x 1.10 = 115.5 -> 116. Added after the percentages it would be 115.
    expect(own.score).toBe(116);

    const other = scoreIn(horse, 'Racing');
    expect(other.breakdown.trainingPoints).toBe(0);
    expect(other.score).toBe(110);
  });
});
