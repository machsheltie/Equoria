/**
 * resultProgressionRecord.integration.test.mjs (Equoria-q4uem.10, slice A1)
 *
 * Owner ruling R6 (Stacey, 2026-10-15): each competition result records the
 * Horse Points awarded and the post-show stat gain. Before A1 the executor
 * threw away awardPlacementProgression's return value, so a result row could
 * not say what the horse earned (BIBLE 13: "the result history should record
 * whether a stat increased and which stat"; "history should not be recomputed").
 *
 * A1 only RECORDS what the award table pays; it changed no award, roll or odds.
 * The table itself is owner ruling R8's 10/5/3/1 (Track B B1, Equoria-576c0),
 * and this test follows it through computePlacementAwards, never a literal.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup, executor always
 * scoped by body.showIds.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { awardPlacementProgression, computePlacementAwards } from '../services/competitionAwards.mjs';
import { recordProgressionOnResult } from '../services/competitionResultRecord.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => randomBytes(6).toString('hex');
// The Dressage stats the post-show roll may raise (utils/competitionRewards.mjs).
const DRESSAGE_GAIN_STATS = ['precision', 'focus', 'obedience'];

const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

function registerCleanup({ showIds = [], horseIds = [], userIds = [] }) {
  if (showIds.length) {
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  }
  if (horseIds.length) {
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  }
  if (userIds.length) {
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  }
}

async function makeOwner(tag) {
  return prisma.user.create({
    data: {
      emailVerified: true,
      email: `q4uem10-${tag}-${uid()}@test.local`,
      username: `q10${tag}${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Record',
      lastName: 'Owner',
      money: 0,
    },
  });
}

async function makeHorse(ownerId, band, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-q4uem10-${band}-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      speed: band,
      stamina: band,
      agility: band,
      balance: band,
      precision: band,
      boldness: band,
      focus: band,
      obedience: band,
    },
    horseIds,
  );
}

async function makeCloseableShow(creatorId, tag, extra = {}) {
  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.show.create({
    data: {
      name: `TestFixture-q4uem10-${tag}-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: creatorId,
      ...extra,
    },
  });
}

const STAT_SELECT = { precision: true, focus: true, obedience: true };

describe('competition results record Horse Points and stat gains (R6)', () => {
  it('the nightly executor records every entrant’s Horse Points and only a stat gain that really happened', async () => {
    const owner = await makeOwner('A');
    const horseIds = [];
    // Bands far apart so luck cannot reorder them (avg ±9 points).
    const horses = [];
    for (const band of [90, 70, 50, 30]) {
      horses.push(await makeHorse(owner.id, band, horseIds));
    }
    const show = await makeCloseableShow(owner.id, 'A');
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.showEntry.createMany({
      data: horses.map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
    });
    const before = new Map();
    for (const h of horses) {
      before.set(h.id, await prisma.horse.findUnique({ where: { id: h.id }, select: STAT_SELECT }));
    }

    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, horsePointsAwarded: true, statGains: true },
    });
    expect(results).toHaveLength(4);
    for (const r of results) {
      const placement = Number(r.placement);
      // Whatever the table pays: 10/5/3/1 (owner ruling R8, Track B B1).
      expect(r.horsePointsAwarded).toBe(computePlacementAwards(placement).horseXp);

      const after = await prisma.horse.findUnique({ where: { id: r.horseId }, select: STAT_SELECT });
      const raised = DRESSAGE_GAIN_STATS.filter(s => after[s] !== before.get(r.horseId)[s]);
      if (r.statGains === null) {
        expect(raised).toEqual([]);
      } else {
        expect(placement).toBeLessThanOrEqual(3);
        expect(r.statGains).toEqual({ stat: raised[0], gain: 1 });
        expect(raised).toHaveLength(1);
        expect(after[raised[0]] - before.get(r.horseId)[raised[0]]).toBe(1);
      }
    }
  }, 60000);

  it('records the rolled stat gain on the result row', async () => {
    const owner = await makeOwner('B');
    const horseIds = [];
    const horse = await makeHorse(owner.id, 50, horseIds);
    const show = await makeCloseableShow(owner.id, 'B', { status: 'completed' });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.competitionResult.create({
      data: {
        score: 60,
        placement: 1,
        discipline: 'Dressage',
        runDate: new Date(),
        showName: show.name,
        prizeWon: 0,
        horseId: horse.id,
        showId: show.id,
      },
    });

    await prisma.$transaction(async tx => {
      const progression = await awardPlacementProgression(tx, {
        horseId: horse.id,
        ownerId: owner.id,
        placementNumber: 1,
        discipline: 'Dressage',
        horseName: horse.name,
        rng: () => 0, // the roll succeeds and picks the first Dressage stat (precision)
      });
      await recordProgressionOnResult(tx, { showId: show.id, horseId: horse.id }, progression);
    });

    const row = await prisma.competitionResult.findUnique({
      where: { showId_horseId: { showId: show.id, horseId: horse.id } },
      select: { horsePointsAwarded: true, statGains: true },
    });
    expect(row).toEqual({
      horsePointsAwarded: computePlacementAwards(1).horseXp,
      statGains: { stat: 'precision', gain: 1 },
    });
  }, 30000);

  // Owner ruling R8 (2026-10-15): stats are never capped. Old contract: a horse at
  // 100 gained nothing and the row recorded statGains null.
  it('records the gain for a stat already at 100, which now rises to 101', async () => {
    const owner = await makeOwner('C');
    const horseIds = [];
    const horse = await makeHorse(owner.id, 50, horseIds);
    await prisma.horse.update({ where: { id: horse.id }, data: { precision: 100 } });
    const show = await makeCloseableShow(owner.id, 'C', { status: 'completed' });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.competitionResult.create({
      data: {
        score: 60,
        placement: 1,
        discipline: 'Dressage',
        runDate: new Date(),
        showName: show.name,
        prizeWon: 0,
        horseId: horse.id,
        showId: show.id,
      },
    });

    await prisma.$transaction(async tx => {
      const progression = await awardPlacementProgression(tx, {
        horseId: horse.id,
        ownerId: owner.id,
        placementNumber: 1,
        discipline: 'Dressage',
        horseName: horse.name,
        rng: () => 0,
      });
      await recordProgressionOnResult(tx, { showId: show.id, horseId: horse.id }, progression);
    });

    const row = await prisma.competitionResult.findUnique({
      where: { showId_horseId: { showId: show.id, horseId: horse.id } },
      select: { horsePointsAwarded: true, statGains: true },
    });
    expect(row).toEqual({
      horsePointsAwarded: computePlacementAwards(1).horseXp,
      statGains: { stat: 'precision', gain: 1 },
    });
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { precision: true } });
    expect(after.precision).toBe(101);
  }, 30000);

  it('a crash re-drive that replays a staged ordering still records progression', async () => {
    const owner = await makeOwner('D');
    const horseIds = [];
    const first = await makeHorse(owner.id, 40, horseIds);
    const second = await makeHorse(owner.id, 40, horseIds);
    // Staged by an earlier, crashed claim: the replay must pay these placements verbatim.
    const show = await makeCloseableShow(owner.id, 'D', {
      stagedOrdering: [
        { horseId: second.id, userId: owner.id, horseName: second.name, score: 70, placement: 1, riderId: null },
        { horseId: first.id, userId: owner.id, horseName: first.name, score: 30, placement: 2, riderId: null },
      ],
    });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.showEntry.createMany({
      data: [first, second].map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const rows = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, horsePointsAwarded: true },
    });
    const byHorse = new Map(rows.map(r => [r.horseId, r]));
    expect(byHorse.get(second.id)).toMatchObject({
      placement: 1,
      horsePointsAwarded: computePlacementAwards(1).horseXp,
    });
    expect(byHorse.get(first.id)).toMatchObject({
      placement: 2,
      horsePointsAwarded: computePlacementAwards(2).horseXp,
    });
  }, 60000);
});
