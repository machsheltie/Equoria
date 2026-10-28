/**
 * Escrow-funded ridden shows built through the real controllers, for the
 * settlement suites (Equoria-wmwbr, fzmiy, cmw85.1, xal4m).
 *
 * createShow debits the creator the prize into SystemAccount[show_escrow] and
 * enterShow debits each entrant the fee into it, so a show built here holds
 * exactly the money a player-made show holds. Every row is recorded in an id
 * collector and removed by `cleanup()`, which fails loud.
 *
 * Money conservation is asserted over suite-owned wallets plus the show's own
 * prizeEscrow + feeEscrow columns (Equoria-3n2g4): money that left a player
 * sits in those columns until settlement moves it to another suite player.
 * The shared SystemAccount rows are never read for an exact balance, because
 * other suites move them concurrently.
 */

import { randomBytes } from 'node:crypto';
import { expect } from '@jest/globals';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { createShow, enterShow } from '../../shows/showController.mjs';
import { createTestHorse } from '../../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  competitionDateOfBirth,
  giveEligibleRider,
} from '../../../../__tests__/helpers/eligibleCompetitor.mjs';

const uid = () => randomBytes(5).toString('hex');

/** Minimal Express res for direct controller calls. */
export function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

export async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

/**
 * @param {string} prefix - TestFixture-... name prefix for every row.
 */
export function createFundedShowFixtures(prefix) {
  const userIds = [];
  const horseIds = [];
  const riderIds = [];
  const showIds = [];

  async function makeUser(money, role) {
    const tag = uid();
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        // The unique tag must survive the 30-character cut: truncate the readable
        // prefix, never the tag (Equoria-63ifs).
        username: `${`${prefix}-${role}`.slice(0, 30 - tag.length - 1).replace(/-+$/, '')}-${tag}`,
        email: `${prefix}-${role}-${tag}@test.local`,
        password: 'irrelevant-hash',
        firstName: 'Settle',
        lastName: role,
        money,
      },
    });
    userIds.push(user.id);
    return user;
  }

  /** A player with one horse eligible for a ridden Dressage show. */
  async function makeEntrant(money = 0) {
    const owner = await makeUser(money, 'entrant');
    const horse = await createTestHorse(
      prisma,
      {
        name: `${prefix}-horse-${uid()}`,
        sex: 'Mare',
        dateOfBirth: competitionDateOfBirth(),
        age: 7,
        userId: owner.id,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health, which refuses entry (Equoria-0d4wa)
        speed: 60,
        stamina: 60,
        agility: 60,
        balance: 60,
        precision: 60,
        boldness: 60,
      },
      horseIds,
    );
    await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id }, riderIds);
    return { owner, horse };
  }

  /** A creator funded with exactly the prize creates the show; returns ids. */
  async function createFundedShow({ prize, entryFee }) {
    // createShow derives the prize as 10 x entryFee (owner ruling 2026-10-23,
    // Equoria-v0ys3), so a fixture asking for any other prize is a wrong fixture.
    if (prize !== 10 * entryFee) {
      throw new Error(`fixture prize ${prize} must be 10 x entryFee ${entryFee}`);
    }
    const creator = await makeUser(prize, 'creator');
    const res = fakeRes();
    await createShow(
      {
        user: { id: creator.id },
        body: {
          name: `${prefix}-show-${uid()}`,
          discipline: 'Dressage',
          entryFee,
          prize,
          level: 1,
        },
      },
      res,
    );
    expect(res.statusCode).toBe(201);
    const showId = res.body.data.show.id;
    showIds.push(showId);
    return { creator, showId };
  }

  /** Enter one horse through POST /shows/:id/enter; returns the response. */
  async function enter(showId, entrant) {
    const res = fakeRes();
    await enterShow(
      {
        user: { id: entrant.owner.id },
        params: { id: String(showId) },
        body: { horseId: entrant.horse.id },
      },
      res,
    );
    return res;
  }

  /** Move the show's closeDate into the past so the executor will run it. */
  async function close(showId) {
    await prisma.show.update({
      where: { id: showId },
      data: { closeDate: new Date(Date.now() - 60 * 60 * 1000) },
    });
  }

  /** A closed show with `entrantCount` entrants, each funded with exactly the fee. */
  async function buildClosedShow({ prize, entryFee, entrantCount }) {
    const { creator, showId } = await createFundedShow({ prize, entryFee });
    const entrants = [];
    for (let i = 0; i < entrantCount; i++) {
      const entrant = await makeEntrant(entryFee);
      const res = await enter(showId, entrant);
      expect(res.statusCode).toBe(201);
      entrants.push(entrant);
    }
    await close(showId);
    return { creator, showId, entrants };
  }

  /**
   * Suite-owned money for one show: the wallets of its creator and entrants
   * plus what the show still holds in escrow.
   */
  async function heldMoney({ creator, showId, entrants }) {
    const wallets = await Promise.all([creator.id, ...entrants.map(e => e.owner.id)].map(moneyOf));
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { prizeEscrow: true, feeEscrow: true },
    });
    return wallets.reduce((sum, m) => sum + m, 0) + show.prizeEscrow + show.feeEscrow;
  }

  async function cleanup() {
    const tracker = createCleanupTracker();
    tracker.add(
      () => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }),
      'competitionResult',
    );
    tracker.add(
      () => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }),
      'showEntry',
    );
    tracker.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
    tracker.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
    tracker.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    tracker.add(
      () => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }),
      'userTransaction',
    );
    tracker.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
    await tracker.run();
  }

  return {
    makeUser,
    makeEntrant,
    createFundedShow,
    enter,
    close,
    buildClosedShow,
    heldMoney,
    cleanup,
  };
}
