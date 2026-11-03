/**
 * E2E fixture: make a freshly seeded horse one a player could train.
 *
 * A horse seeded through the real createHorse pipeline (fixtures/ownedHorses.ts)
 * has never seen a vet and has no trainer, and both rules now refuse training:
 *   - Health comes from days since the vet, and a horse never vetted is Bad
 *     (owner ruling 2026-10-23, Equoria-qwz60; backend/utils/horseHealth.mjs
 *     getVetHealth). Bad health blocks training.
 *   - A trainer is required to train (owner ruling 2026-10-26, q81,
 *     Equoria-r8a6h).
 * The Training Grounds list therefore showed the seeded horse as "Not Fit to
 * Train" with no Train button. Old contract: a seeded horse that had been fed
 * could train at once.
 *
 * This writes the vet visit and the trainer assignment from the spec's own Node
 * process, straight into the test database, the pattern of feedHistory.ts and
 * the backend's tests/helpers/assignTrainer.mjs. The trainer belongs to no
 * player, so it never fills the shared player's trainer roster cap. The training
 * itself still runs over the real UI and HTTP route.
 *
 * NOT PERMITTED here: production routes, `x-test-*` headers, or anything that
 * runs inside the backend process. This only touches the rows it creates and
 * the one horse it is given.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

type PrismaSubset = {
  horse: {
    updateMany: (_args: {
      where: { id: number };
      data: { lastVettedDate: Date };
    }) => Promise<{ count: number }>;
  };
  trainer: {
    create: (_args: { data: Record<string, unknown> }) => Promise<{ id: number }>;
    deleteMany: (_args: { where: { id: { in: number[] } } }) => Promise<{ count: number }>;
  };
  trainerAssignment: {
    create: (_args: { data: { trainerId: number; horseId: number } }) => Promise<{ id: number }>;
  };
};

// Dynamic import so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the feedHistory pattern). The
// client is returned whole so each delegate keeps its Prisma `this`.
async function getPrisma(): Promise<PrismaSubset> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const client = mod.default as PrismaSubset | undefined;
  if (!client?.horse || !client.trainer || !client.trainerAssignment) {
    throw new Error('Could not resolve prisma client from packages/database/prismaClient.mjs');
  }
  return client;
}

/**
 * Give the horse a vet visit today and an assigned fixture trainer.
 * Fails loudly unless exactly that one horse row was written.
 * @returns the fixture trainer's id, for removeFixtureTrainer().
 */
export async function makeHorseReadyToTrain(horseId: number): Promise<number> {
  const prisma = await getPrisma();
  const { count } = await prisma.horse.updateMany({
    where: { id: horseId },
    data: { lastVettedDate: new Date() },
  });
  if (count !== 1) {
    throw new Error(
      `trainingReadiness fixture expected to update horse ${horseId}, updated ${count} row(s)`
    );
  }
  const trainer = await prisma.trainer.create({
    data: {
      firstName: 'E2EFixture',
      lastName: `Trainer${horseId}`,
      personality: 'focused',
      skillLevel: 'novice',
      speciality: 'Dressage',
      bio: 'E2E fixture trainer',
    },
  });
  await prisma.trainerAssignment.create({ data: { trainerId: trainer.id, horseId } });
  return trainer.id;
}

/** Remove a trainer makeHorseReadyToTrain created (its assignment cascades). */
export async function removeFixtureTrainer(trainerId: number): Promise<void> {
  const prisma = await getPrisma();
  const { count } = await prisma.trainer.deleteMany({ where: { id: { in: [trainerId] } } });
  if (count !== 1) {
    throw new Error(
      `trainingReadiness fixture expected to remove trainer ${trainerId}, removed ${count}`
    );
  }
}
