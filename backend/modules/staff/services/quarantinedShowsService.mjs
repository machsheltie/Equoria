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
import { deployedCommitSha } from '../../../utils/deployedCommitSha.mjs';

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
  const toolUses = await latestToolUses(
    client,
    shows.map(s => String(s.id)),
  );
  return shows.map(({ _count, ...show }) => ({
    ...show,
    entryCount: _count.entries,
    ...testRunState(toolUses.get(String(show.id))),
  }));
}

/**
 * The newest use of the owner's tools on each show (Equoria-yqi49). The tools
 * record every test run and run in the staff action log under this capability,
 * with `after.action` 'testRun' or 'runShow' and the commit the server ran.
 */
async function latestToolUses(client, targetIds) {
  if (targetIds.length === 0) {
    return new Map();
  }
  const rows = await client.staffActionLog.findMany({
    where: {
      capability: 'shows.quarantine.resolve',
      targetType: 'show',
      targetId: { in: targetIds },
    },
    orderBy: { id: 'desc' },
    distinct: ['targetId'],
    select: { targetId: true, outcome: true, after: true, createdAt: true },
  });
  return new Map(rows.map(row => [row.targetId, row]));
}

/**
 * Whether Run Show is unlocked: the newest tool use is a passed test run on the
 * commit the server runs now. The run route checks the same thing again.
 */
function testRunState(latest) {
  const after = latest?.after && typeof latest.after === 'object' ? latest.after : {};
  if (!latest || after.action !== 'testRun') {
    return { lastTestRun: null, runShowReady: false };
  }
  const passed = latest.outcome === 'succeeded';
  const sameCommit = (after.commitSha ?? null) === deployedCommitSha();
  return {
    lastTestRun: { testedAt: latest.createdAt, passed, sameCommit },
    runShowReady: passed && sameCommit,
  };
}
