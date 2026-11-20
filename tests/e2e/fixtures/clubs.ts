/**
 * E2E fixture: remove a club a spec created through the real club routes
 * (Equoria-m00gp).
 *
 * There is no player-facing route that deletes a club, so the spec creates its
 * club and election through the real API and removes exactly those rows here,
 * from its own Node process, straight in the test database (the
 * prizeHistory.ts / feedHistory.ts pattern). Elections do not cascade from the
 * club, so they go first; memberships cascade with the club. Fails loudly
 * unless exactly the one club was removed.
 *
 * NOT PERMITTED here: production routes, `x-test-*` headers, or anything that
 * runs inside the backend process.
 */

import { loadE2ePrisma } from '../helpers/e2eTestStack.mjs';

type ClubTx = {
  clubElection: { deleteMany: (_a: { where: { clubId: number } }) => Promise<{ count: number }> };
  club: { deleteMany: (_a: { where: { id: number } }) => Promise<{ count: number }> };
};
type PrismaSubset = ClubTx & {
  $transaction: <T>(_fn: (_tx: ClubTx) => Promise<T>) => Promise<T>;
};

async function getPrisma(): Promise<PrismaSubset> {
  const prisma = (await loadE2ePrisma()) as Partial<PrismaSubset> | undefined;
  if (!prisma?.club || !prisma?.clubElection || !prisma?.$transaction) {
    throw new Error('Could not resolve prisma from packages/database/prismaClient.mjs');
  }
  return prisma as PrismaSubset;
}

/** Delete one club and its elections (memberships cascade). */
export async function removeClub(clubId: number): Promise<void> {
  const prisma = await getPrisma();
  const removed = await prisma.$transaction(async (tx) => {
    await tx.clubElection.deleteMany({ where: { clubId } });
    const { count } = await tx.club.deleteMany({ where: { id: clubId } });
    return count;
  });
  if (removed !== 1) {
    throw new Error(`clubs fixture expected to delete club ${clubId}, deleted ${removed}`);
  }
}
