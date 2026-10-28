/**
 * gaitedBreedTrainingGate.integration.test.mjs (Equoria-uszhf)
 *
 * Owner ruling 2026-10-19: Gaited is a breed property (the breed's
 * breedGeneticProfile.ratingProfiles.isGaitedBreed) that alone gates Gaited
 * training; a non-gaited breed can never train Gaited, whatever traits it
 * carries. Old contract: computeCanTrain and the trainable-disciplines list
 * required a 'gaited' epigenetic trait, so a horse of a gaited breed was
 * refused and a non-gaited horse holding the trait was let in.
 *
 * Real DB, the seeded breeds (American Saddlebred gaited, Thoroughbred not),
 * real canTrain / trainHorse / getTrainableHorses; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { canTrain, getTrainableHorses, trainHorse } from '../controllers/trainingController.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const gaitedBreedName = 'American Saddlebred';
const plainBreedName = 'Thoroughbred';
const rand = () => randomBytes(6).toString('hex');
const gameAgeDob = years => gameCalendarDate(new Date(), -(years * 7 + 1));

const cleanup = createCleanupTracker();
const horseIds = [];
let user;
let gaitedBreed;
let plainBreed;

async function makeHorse(breed, fields = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-uszhf-${rand()}`,
      dateOfBirth: gameAgeDob(6),
      age: 6,
      sex: 'Mare',
      userId: user.id,
      breedId: breed.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      ...fields,
    },
  });
  horseIds.push(horse.id);
  await assignTestTrainer(horse);
  return horse;
}

beforeAll(async () => {
  gaitedBreed = await prisma.breed.findUnique({ where: { name: gaitedBreedName } });
  plainBreed = await prisma.breed.findUnique({ where: { name: plainBreedName } });
  if (!gaitedBreed || !plainBreed) {
    throw new Error(`Needs the seeded breeds ${gaitedBreedName} and ${plainBreedName}; refusing to skip.`);
  }
  if (gaitedBreed.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== true) {
    throw new Error(`${gaitedBreedName} is expected to be gaited in the seeded data.`);
  }
  if (plainBreed.breedGeneticProfile?.ratingProfiles?.isGaitedBreed !== false) {
    throw new Error(`${plainBreedName} is expected to be non-gaited in the seeded data.`);
  }
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-uszhf-${rand()}`,
      email: `testfixture-uszhf-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Gaited',
      lastName: 'Gate',
      money: 100000,
    },
  });
  cleanup.add(() => cleanupTestTrainers(), 'trainers');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'training logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('Gaited training is gated by the breed alone (Equoria-uszhf)', () => {
  it('a gaited-breed horse with no Gaited trait may train Gaited, and does', async () => {
    const horse = await makeHorse(gaitedBreed, {
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    });
    expect(await canTrain(horse.id, 'Gaited')).toMatchObject({ eligible: true });

    const result = await trainHorse(horse.id, 'Gaited');
    expect(result.success).toBe(true);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { disciplineScores: true },
    });
    expect(after.disciplineScores?.Gaited).toBeGreaterThan(0);
  });

  it('a non-gaited horse holding a stray Gaited trait may not train Gaited', async () => {
    const horse = await makeHorse(plainBreed, {
      epigeneticModifiers: { positive: ['gaited', 'Gaited'], negative: [], hidden: [] },
    });
    expect(await canTrain(horse.id, 'Gaited')).toEqual(
      expect.objectContaining({ eligible: false, reason: 'Only gaited breeds can train in Gaited' }),
    );
    const result = await trainHorse(horse.id, 'Gaited');
    expect(result.success).toBe(false);
    // The breed gate is Gaited only: the same horse may train another discipline.
    expect(await canTrain(horse.id, 'Dressage')).toMatchObject({ eligible: true });
  });

  it('the trainable-disciplines list offers Gaited to gaited breeds only', async () => {
    const gaited = await makeHorse(gaitedBreed);
    const stray = await makeHorse(plainBreed, {
      epigeneticModifiers: { positive: ['gaited', 'Gaited'], negative: [], hidden: [] },
    });
    const list = await getTrainableHorses(user.id);
    const byId = new Map(list.map(h => [h.horseId, h]));
    expect(byId.get(gaited.id).trainableDisciplines).toContain('Gaited');
    expect(byId.get(stray.id).trainableDisciplines).not.toContain('Gaited');
    expect(byId.get(stray.id).trainableDisciplines).toContain('Dressage');
  });
});
