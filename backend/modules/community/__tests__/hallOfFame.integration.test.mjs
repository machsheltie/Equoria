/**
 * Hall of Fame: nominations, weekly votes, run-offs, inductions (Equoria-vb1n0).
 *
 * Owner rulings 2026-10-28 (vb1n0, q257-q259):
 *   - only a retired horse (21) can be nominated, by its owner, once ever;
 *   - week N's nominations are week N+1's nominees (Eastern game weeks);
 *   - each player has one vote per round, and may vote for her own horse;
 *   - the top horse at the end of the week is inducted, with the date it joined;
 *   - a tied top vote opens a one-game-day run-off between the tied horses only,
 *     like club elections; a horse that is not inducted has used its one chance;
 *   - the Hall of Fame started empty.
 *
 * Real routes, real service, real database. The rounds step is run with
 * synthetic Eastern weeks far in the future so it never meets real rounds.
 * Fixtures are scoped and removed fail-loud.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate, gameDateParts, sameGameClockDaysLater, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { castHallOfFameVote, nominateHorse, runHallOfFameRounds } from '../services/hallOfFameService.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const PREFIX = 'TestFixture-vb1n0';
const ORIGIN = 'http://localhost:3000';
const HOUR = 3_600_000;

/** Sunday 00:00 Eastern (owner ruling q265) of a random week in 2091 (never a real week). */
function syntheticWeek() {
  const k = Math.floor(Math.random() * 2000);
  return startOfGameWeek(new Date(Date.UTC(2091, 0, 10) + k * 7 * 24 * HOUR), 0);
}

function fixtures() {
  const cleanup = createCleanupTracker();
  const users = [];
  const horses = [];

  async function player() {
    const uid = randomBytes(6).toString('hex');
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `vb1n0_${uid}`,
        email: `${PREFIX}-${uid}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Hall',
        lastName: 'Fame',
        money: 1000,
      },
    });
    users.push(user);
    return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
  }

  /** A horse `ageYears` old at `at`. */
  async function horse(owner, ageYears, at = new Date()) {
    const row = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${PREFIX}-${randomBytes(4).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(at, -(ageYears * 7 + 1)),
        age: ageYears,
        userId: owner.id,
      }),
    });
    horses.push(row);
    return row;
  }

  cleanup.add(async () => {
    const horseIds = horses.map(h => h.id);
    // Rounds holding these horses (weekly rounds and their run-offs); votes,
    // candidates and inductions cascade with them.
    await prisma.hallOfFameRound.deleteMany({
      where: { candidates: { some: { nomination: { horseId: { in: horseIds } } } } },
    });
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
  }, 'hall of fame fixtures');

  return { cleanup, player, horse };
}

async function post(token, path, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(`/api/v1/hall-of-fame${path}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

const get = (token, path = '') =>
  request(app).get(`/api/v1/hall-of-fame${path}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

describe('Hall of Fame (Equoria-vb1n0)', () => {
  let f;
  afterEach(async () => {
    await f.cleanup.run();
  });

  it('a retired horse is nominated by its owner once, ever', async () => {
    f = fixtures();
    const { user, token } = await f.player();
    const { token: otherToken } = await f.player();
    const retired = await f.horse(user, 21);
    const young = await f.horse(user, 20);

    const status = await get(token, `/horses/${retired.id}`);
    expect(status.status).toBe(200);
    expect(status.body.data).toEqual({ canNominate: true, nominated: false, inducted: false });

    expect((await post(otherToken, '/nominations', { horseId: retired.id })).status).toBe(404);
    expect((await post(token, '/nominations', { horseId: young.id })).status).toBe(400);

    const first = await post(token, '/nominations', { horseId: retired.id });
    expect(first.status).toBe(201);
    const second = await post(token, '/nominations', { horseId: retired.id });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('alreadyNominated');

    const after = await get(token, `/horses/${retired.id}`);
    expect(after.body.data).toEqual({ canNominate: false, nominated: true, inducted: false });
    expect(await prisma.hallOfFameNomination.count({ where: { horseId: retired.id } })).toBe(1);
  }, 60000);

  it("week N's nominations are week N+1's nominees; a later nomination waits", async () => {
    f = fixtures();
    const { user } = await f.player();
    const weekN = syntheticWeek();
    const weekN1 = sameGameClockDaysLater(weekN, 7);
    const early = await f.horse(user, 22, weekN);
    const lastHour = await f.horse(user, 22, weekN);
    const late = await f.horse(user, 22, weekN1);

    // The week turns at Sunday 00:00 Eastern (owner ruling q265): Saturday 23:00
    // is still week N; Sunday 02:00 is week N+1.
    expect(gameDateParts(weekN1)).toMatchObject({ weekday: 0, hour: 0, minute: 0 });
    await nominateHorse(early.id, user.id, new Date(weekN.getTime() + 30 * HOUR));
    const saturdayNight = await nominateHorse(lastHour.id, user.id, new Date(weekN1.getTime() - HOUR));
    expect(saturdayNight.weekStart.toISOString()).toBe(weekN.toISOString());
    const sunday = await nominateHorse(late.id, user.id, new Date(weekN1.getTime() + 2 * HOUR));
    expect(sunday.weekStart.toISOString()).toBe(weekN1.toISOString());

    await runHallOfFameRounds(new Date(weekN1.getTime() + HOUR));
    const round = await prisma.hallOfFameRound.findUnique({
      where: { weekStart: weekN1 },
      select: {
        startsAt: true,
        endsAt: true,
        candidates: { select: { nomination: { select: { horseId: true } } } },
      },
    });
    expect(round.startsAt.toISOString()).toBe(weekN1.toISOString());
    expect(round.endsAt.toISOString()).toBe(sameGameClockDaysLater(weekN1, 7).toISOString());
    expect(round.candidates.map(c => c.nomination.horseId).sort()).toEqual([early.id, lastHour.id].sort());
  }, 60000);

  it('one vote per player per round, and a player may vote for her own horse', async () => {
    f = fixtures();
    const { user, token } = await f.player();
    const retired = await f.horse(user, 23);
    const rival = await f.horse(user, 24);
    const nominations = await Promise.all(
      [retired, rival].map(h =>
        prisma.hallOfFameNomination.create({
          data: { horseId: h.id, nominatedById: user.id, weekStart: syntheticWeek() },
        }),
      ),
    );
    const now = Date.now();
    const round = await prisma.hallOfFameRound.create({
      data: {
        startsAt: new Date(now - HOUR),
        endsAt: new Date(now + 24 * HOUR),
        candidates: { create: nominations.map(n => ({ nominationId: n.id })) },
      },
      select: { id: true, candidates: { orderBy: { id: 'asc' }, select: { id: true } } },
    });
    const [own, other] = round.candidates;

    const vote = await post(token, '/votes', { candidateId: own.id });
    expect(vote.status).toBe(201);
    const again = await post(token, '/votes', { candidateId: other.id });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('alreadyVoted');

    const page = await get(token);
    expect(page.status).toBe(200);
    const shown = page.body.data.rounds.find(r => r.roundId === round.id);
    expect(shown.myVoteCandidateId).toBe(own.id);
    expect(shown.nominees.map(n => n.horseId)).toEqual([retired.id, rival.id]);
    expect(shown.nominees[0]).not.toHaveProperty('votes');
  }, 60000);

  it('the top horse is inducted at the end of the week, with the date it joined', async () => {
    f = fixtures();
    const { user } = await f.player();
    const voters = await Promise.all([f.player(), f.player()]);
    const weekN = syntheticWeek();
    const weekN1 = sameGameClockDaysLater(weekN, 7);
    const star = await f.horse(user, 22, weekN);
    const other = await f.horse(user, 22, weekN);
    await nominateHorse(star.id, user.id, new Date(weekN.getTime() + HOUR));
    await nominateHorse(other.id, user.id, new Date(weekN.getTime() + HOUR));
    await runHallOfFameRounds(new Date(weekN1.getTime() + HOUR));

    const round = await prisma.hallOfFameRound.findUnique({
      where: { weekStart: weekN1 },
      select: { id: true, candidates: { select: { id: true, nomination: { select: { horseId: true } } } } },
    });
    const starCandidate = round.candidates.find(c => c.nomination.horseId === star.id);
    const otherCandidate = round.candidates.find(c => c.nomination.horseId === other.id);
    const midWeek = new Date(weekN1.getTime() + 50 * HOUR);
    await castHallOfFameVote(starCandidate.id, voters[0].user.id, midWeek);
    await castHallOfFameVote(starCandidate.id, voters[1].user.id, midWeek);
    await castHallOfFameVote(otherCandidate.id, user.id, midWeek);

    const endOfWeek = new Date(sameGameClockDaysLater(weekN1, 7).getTime() + 13 * 60_000);
    const result = await runHallOfFameRounds(endOfWeek);
    expect(result.inducted).toBeGreaterThanOrEqual(1);

    const induction = await prisma.hallOfFameInduction.findUnique({ where: { horseId: star.id } });
    expect(induction.inductedAt.toISOString()).toBe(endOfWeek.toISOString());
    expect(await prisma.hallOfFameInduction.count({ where: { horseId: other.id } })).toBe(0);

    // The page lists the inducted horse with the date it joined.
    const page = await get(voters[0].token);
    const shown = page.body.data.inductees.find(i => i.horseId === star.id);
    expect(shown.inductedAt).toBe(endOfWeek.toISOString());

    // The horse that lost has used its one chance: never nominated again, never re-entered.
    await expect(nominateHorse(other.id, user.id, endOfWeek)).rejects.toMatchObject({
      status: 409,
      code: 'alreadyNominated',
    });
    await runHallOfFameRounds(new Date(endOfWeek.getTime() + HOUR));
    const later = await prisma.hallOfFameCandidate.count({
      where: { nomination: { horseId: other.id } },
    });
    expect(later).toBe(1);
  }, 60000);

  it('a tied top vote opens a one-day run-off between only the tied horses', async () => {
    f = fixtures();
    const { user } = await f.player();
    const voters = await Promise.all([f.player(), f.player(), f.player(), f.player(), f.player()]);
    const weekN = syntheticWeek();
    const weekN1 = sameGameClockDaysLater(weekN, 7);
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => f.horse(user, 22, weekN)));
    for (const h of [a, b, c]) {
      await nominateHorse(h.id, user.id, new Date(weekN.getTime() + HOUR));
    }
    await runHallOfFameRounds(new Date(weekN1.getTime() + HOUR));
    const round = await prisma.hallOfFameRound.findUnique({
      where: { weekStart: weekN1 },
      select: { id: true, candidates: { select: { id: true, nomination: { select: { horseId: true } } } } },
    });
    const cand = h => round.candidates.find(x => x.nomination.horseId === h.id).id;
    const midWeek = new Date(weekN1.getTime() + 50 * HOUR);
    await castHallOfFameVote(cand(a), voters[0].user.id, midWeek);
    await castHallOfFameVote(cand(a), voters[1].user.id, midWeek);
    await castHallOfFameVote(cand(b), voters[2].user.id, midWeek);
    await castHallOfFameVote(cand(b), voters[3].user.id, midWeek);
    await castHallOfFameVote(cand(c), voters[4].user.id, midWeek);

    const endOfWeek = new Date(sameGameClockDaysLater(weekN1, 7).getTime() + 13 * 60_000);
    await runHallOfFameRounds(endOfWeek);

    const closed = await prisma.hallOfFameRound.findUnique({
      where: { id: round.id },
      select: { outcome: true, induction: true },
    });
    expect(closed.outcome).toBe('runoff');
    expect(closed.induction).toBeNull();
    const runoff = await prisma.hallOfFameRound.findUnique({
      where: { runoffOfId: round.id },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        candidates: { select: { id: true, nomination: { select: { horseId: true } } } },
      },
    });
    expect(runoff.startsAt.toISOString()).toBe(endOfWeek.toISOString());
    expect(runoff.endsAt.toISOString()).toBe(sameGameClockDaysLater(endOfWeek, 1).toISOString());
    expect(runoff.candidates.map(x => x.nomination.horseId).sort()).toEqual([a.id, b.id].sort());

    // Run-off votes are a new round: the same players vote again.
    const runoffCand = h => runoff.candidates.find(x => x.nomination.horseId === h.id).id;
    const inRunoff = new Date(endOfWeek.getTime() + HOUR);
    await castHallOfFameVote(runoffCand(b), voters[0].user.id, inRunoff);
    await castHallOfFameVote(runoffCand(b), voters[1].user.id, inRunoff);
    await castHallOfFameVote(runoffCand(a), voters[2].user.id, inRunoff);

    const runoffEnd = new Date(runoff.endsAt.getTime() + 13 * 60_000);
    await runHallOfFameRounds(runoffEnd);
    const induction = await prisma.hallOfFameInduction.findUnique({ where: { horseId: b.id } });
    expect(induction.inductedAt.toISOString()).toBe(runoffEnd.toISOString());
    expect(induction.roundId).toBe(runoff.id);
    expect(await prisma.hallOfFameInduction.count({ where: { horseId: { in: [a.id, c.id] } } })).toBe(0);
  }, 90000);
});
