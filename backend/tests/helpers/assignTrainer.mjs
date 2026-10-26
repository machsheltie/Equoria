/**
 * Fixture helper: give a test horse an assigned trainer (owner ruling 2026-10-26,
 * Equoria-r8a6h q81: a trainer is required to train).
 *
 * The fixture trainer belongs to no user and charges no per-training fee
 * (sessionRate 0), so a test about something else (XP, cooldown, scores) sees the
 * same money and writes it saw before. A test about the fee creates its own trainer.
 * Deleting the horse cascades the assignment; call cleanupTestTrainers() in the
 * suite's cleanup to remove the trainer rows this helper created.
 */
import prisma from '../../../packages/database/prismaClient.mjs';

const createdTrainerIds = new Set();

/**
 * @param {number|{id:number}} horse - the horse (or its id)
 * @param {object} [client] - prisma client or transaction (default: the shared client)
 * @returns {Promise<{trainer:object, assignment:object}>}
 */
export async function assignTestTrainer(horse, client = prisma) {
  const horseId = typeof horse === 'number' ? horse : horse.id;
  const trainer = await client.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Trainer${horseId}`,
      personality: 'focused',
      skillLevel: 'novice',
      speciality: 'Dressage',
      sessionRate: 0,
      bio: 'fixture trainer',
    },
  });
  createdTrainerIds.add(trainer.id);
  const assignment = await client.trainerAssignment.create({
    data: { trainerId: trainer.id, horseId },
  });
  return { trainer, assignment };
}

/** Remove the trainers assignTestTrainer created (their assignments cascade). */
export async function cleanupTestTrainers() {
  const ids = [...createdTrainerIds];
  if (ids.length === 0) {
    return;
  }
  await prisma.trainer.deleteMany({ where: { id: { in: ids } } });
  createdTrainerIds.clear();
}
