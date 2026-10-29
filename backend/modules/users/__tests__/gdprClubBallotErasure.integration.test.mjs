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
      emailVerified: true,
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
    // Cleanup is registered before the creates it undoes (Equoria-bfqna); each id is
    // pushed as its row is created and the lists are read when the cleanup runs, so a
    // throw on a later create cannot strand the rows created before it.
    // FK order: ballots → candidates → election → memberships → club → users.
    // On success the subject's rows are already gone; these are then no-ops.
    const ballotIds = [];
    const candidateIds = [];
    const electionIds = [];
    const clubIds = [];
    const userIds = [];
    cleanup.add(() => prisma.clubBallot.deleteMany({ where: { id: { in: ballotIds } } }), 'ballots');
    cleanup.add(() => prisma.clubCandidate.deleteMany({ where: { id: { in: candidateIds } } }), 'candidates');
    cleanup.add(() => prisma.clubElection.deleteMany({ where: { id: { in: electionIds } } }), 'election');
    // Every membership of this test's own club (no other row can belong to it).
    cleanup.add(() => prisma.clubMembership.deleteMany({ where: { clubId: { in: clubIds } } }), 'memberships');
    cleanup.add(() => prisma.club.deleteMany({ where: { id: { in: clubIds } } }), 'club');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

    const leader = await makeUser('leader'); // leads the club, votes for the subject
    userIds.push(leader.id);
    const subject = await makeUser('subject'); // stands, receives a vote, is erased
    userIds.push(subject.id);
    const rival = await makeUser('rival'); // stands in the same election
    userIds.push(rival.id);
    const rivalVoter = await makeUser('rivalvoter'); // votes for the rival
    userIds.push(rivalVoter.id);

    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-club-${tag()}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'erasure fixture',
        leaderId: leader.id,
      },
    });
    clubIds.push(club.id);
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
    electionIds.push(election.id);
    // One at a time: a rejected Promise.all could leave a sibling create still in flight
    // while the cleanup runs.
    for (const u of [leader, subject, rival, rivalVoter]) {
      await prisma.clubMembership.create({ data: { clubId: club.id, userId: u.id } });
    }
    const subjectCandidacy = await prisma.clubCandidate.create({
      data: { electionId: election.id, userId: subject.id, statement: 'vote for me' },
    });
    candidateIds.push(subjectCandidacy.id);
    const rivalCandidacy = await prisma.clubCandidate.create({
      data: { electionId: election.id, userId: rival.id, statement: 'no, me' },
    });
    candidateIds.push(rivalCandidacy.id);
    const ballotForSubject = await prisma.clubBallot.create({
      data: { electionId: election.id, voterId: leader.id, candidateId: subjectCandidacy.id },
    });
    ballotIds.push(ballotForSubject.id);
    const ballotForRival = await prisma.clubBallot.create({
      data: { electionId: election.id, voterId: rivalVoter.id, candidateId: rivalCandidacy.id },
    });
    ballotIds.push(ballotForRival.id);

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
