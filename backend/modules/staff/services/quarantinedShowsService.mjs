/**
 * Quarantined shows, read for the staff list (Equoria-c7mx0.1).
 *
 * Owner ruling 2026-10-23 (Stacey): a show whose execution failed 3 times is
 * quarantined (the show-execution reaper sets the status; so does the half-settled
 * payout re-drive after 3 failed tries, Equoria-o1vns; it is never retried
 * automatically) and listed for the Owner alone to resolve (Equoria-ehlbj). This is that list:
 * read-only, newest first, with what a staff member needs to decide — how many
 * attempts failed, how much prize and fee escrow is still held, and how many
 * entries are waiting. It lives in the staff module and reads Show directly so
 * the staff module takes no dependency on competition (which reaches staff
 * through users, so that edge would make a module cycle).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/** The list is bounded; quarantine is rare, so this is far above any real backlog. */
export const quarantinedShowsLimit = 200;

/**
 * @param {Object} [client] - Prisma client (default: the shared one)
 * @returns {Promise<Array<Object>>} quarantined shows, newest first
 */
export async function listQuarantinedShows(client = prisma) {
  const shows = await client.show.findMany({
    where: { status: 'quarantined' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: quarantinedShowsLimit,
    select: {
      id: true,
      name: true,
      discipline: true,
      showType: true,
      status: true,
      closeDate: true,
      executionAttempts: true,
      prizeEscrow: true,
      feeEscrow: true,
      createdByUserId: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });
  return shows.map(({ _count, ...show }) => ({ ...show, entryCount: _count.entries }));
}
