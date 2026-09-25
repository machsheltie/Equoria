/**
 * Equoria-8jyiv — erasure of a player another player voted for.
 *
 * The defect: `eraseUserAccount()` cleared the ballots the erased user CAST,
 * then deleted the user's own `ClubCandidate` rows. Ballots OTHER players cast
 * FOR that candidacy survived, and `ClubBallot.candidate` is RESTRICT, so the
 * candidate delete failed with PostgresError 23001 and the whole erasure
 * rolled back. Standing in someone else's club election and receiving one vote
 * locked the account out of erasure permanently (the shape never changes, so a
 * retry never clears it). Players can no longer delete their own accounts
 * (Equoria-gfany), but the owner keeps `eraseUserAccount()` for erasure run by
 * hand, which hit the same wall.
 *
 * Owner ruling 2026-09-25 (fix it; withdraw chosen as the defensible state):
 * the erased user's candidacy is WITHDRAWN — the candidacy and the ballots
 * cast for it are removed. Other candidates, their ballots, the election and
 * the club are untouched. `ClubElection` stores no winner, so no recorded
 * outcome is rewritten.
 *
 * RED on the pre-fix code: the erase throws 23001 and every row survives.
 *
 * Real database, no mocks, id-scoped fail-loud cleanup in FK order.
 *
 * @module modules/users/__tests__/gdprClubBallotErasure.integration
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';

const PREFIX = 'TestFixture-8jyiv';
const tag = () => randomBytes(6).toString('hex');

async function makeUser(label) {
  const t = tag();
  return prisma.user.create({
    data: {
      username: `${PREFIX}-${label}-${t}`,
      email: `${PREFIX}-${label}-${t}@example.com`.toLowerCase(),
      password: 'irrelevant-not-a-login-test',
      firstName: '8jyiv',
      lastName: label,
      money: 0,
      settings: {},
    },
  });
}

describe('Equoria-8jyiv — erasing a player who received club-election votes', () => {
  const cleanup = createCleanupTracker();

  afterEach(() => cleanup.run(), 30000);

  it('withdraws their candidacy and the votes for it, leaving the rest of the election intact', async () => {
    const leader = await makeUser('leader'); // leads the club, votes for the subject
    const subject = await makeUser('subject'); // stands, receives a vote, is erased
    const rival = await makeUser('rival'); // stands in the same election
    const rivalVoter = await makeUser('rivalvoter'); // votes for the rival

    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-club-${tag()}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'erasure fixture',
        leaderId: leader.id,
      },
    });
    const now = Date.now();
    const election = await prisma.clubElection.create({
      data: {
        clubId: club.id,
        position: 'president',
        status: 'open',
        startsAt: new Date(now - 86_400_000),
        endsAt: new Date(now + 86_400_000),
      },
    });
    const memberships = await Promise.all(
      [leader, subject, rival, rivalVoter].map(u =>
        prisma.clubMembership.create({ data: { clubId: club.id, userId: u.id } }),
      ),
    );
    const subjectCandidacy = await prisma.clubCandidate.create({
      data: { electionId: election.id, userId: subject.id, statement: 'vote for me' },
    });
    const rivalCandidacy = await prisma.clubCandidate.create({
      data: { electionId: election.id, userId: rival.id, statement: 'no, me' },
    });
    const ballotForSubject = await prisma.clubBallot.create({
      data: { electionId: election.id, voterId: leader.id, candidateId: subjectCandidacy.id },
    });
    const ballotForRival = await prisma.clubBallot.create({
      data: { electionId: election.id, voterId: rivalVoter.id, candidateId: rivalCandidacy.id },
    });

    // FK order: ballots → candidates → election → memberships → club → users.
    // On success the subject's rows are already gone; these are then no-ops.
    const ballotIds = [ballotForSubject.id, ballotForRival.id];
    const candidateIds = [subjectCandidacy.id, rivalCandidacy.id];
    const membershipIds = memberships.map(m => m.id);
    const userIds = [leader.id, subject.id, rival.id, rivalVoter.id];
    cleanup.add(() => prisma.clubBallot.deleteMany({ where: { id: { in: ballotIds } } }), 'ballots');
    cleanup.add(() => prisma.clubCandidate.deleteMany({ where: { id: { in: candidateIds } } }), 'candidates');
    cleanup.add(() => prisma.clubElection.deleteMany({ where: { id: election.id } }), 'election');
    cleanup.add(() => prisma.clubMembership.deleteMany({ where: { id: { in: membershipIds } } }), 'memberships');
    cleanup.add(() => prisma.club.deleteMany({ where: { id: club.id } }), 'club');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

    // Pre-fix: throws PostgresError 23001 on clubCandidate.deleteMany.
    await expect(eraseUserAccount(subject.id)).resolves.toEqual({ deleted: true });

    // The subject, their candidacy and the vote cast for it are gone.
    expect(await prisma.user.findUnique({ where: { id: subject.id } })).toBeNull();
    expect(await prisma.clubCandidate.findUnique({ where: { id: subjectCandidacy.id } })).toBeNull();
    expect(await prisma.clubBallot.findUnique({ where: { id: ballotForSubject.id } })).toBeNull();

    // Everything else in the election survives untouched.
    expect(await prisma.clubCandidate.findUnique({ where: { id: rivalCandidacy.id } })).toEqual(rivalCandidacy);
    expect(await prisma.clubBallot.findUnique({ where: { id: ballotForRival.id } })).toEqual(ballotForRival);
    expect(await prisma.clubElection.findUnique({ where: { id: election.id } })).toEqual(election);
    expect(await prisma.club.findUnique({ where: { id: club.id } })).toEqual(club);

    // The voter whose ballot was withdrawn is otherwise untouched: still a
    // user, still a member, and free to vote again in the open election.
    expect(await prisma.user.findUnique({ where: { id: leader.id } })).not.toBeNull();
    expect(await prisma.clubMembership.count({ where: { clubId: club.id, userId: leader.id } })).toBe(1);
    expect(await prisma.clubMembership.count({ where: { clubId: club.id } })).toBe(3);
  }, 60000);
});
