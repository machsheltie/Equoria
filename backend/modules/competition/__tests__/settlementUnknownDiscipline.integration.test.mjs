/**
 * settlementUnknownDiscipline.integration.test.mjs (Equoria-576c0 B3 review, item 1)
 *
 * B3 made an unknown discipline an error in the post-show stat gain. A show row
 * that still carries a discipline outside the bible's 23 (here the legacy
 * 'Obedience Training') would then throw inside the per-entry settlement
 * transaction whenever the stat-gain roll succeeds. That rejects the executor's
 * Promise.all, executeClosedShows rethrows, every later show that night is
 * skipped, and the bad show fails again every night.
 *
 * Contract: such a show still settles (placements, Horse Points, prizes). Only
 * the random stat gain is skipped. A valid show in the same nightly run settles
 * exactly as before, stat gains included.
 *
 * Escrow ownership: both shows are created through the real createShow
 * controller, which debits the test-owned creator and credits
 * SystemAccount[showEscrow] by the prize, so the run never depends on what the
 * shared escrow singleton happens to hold (it passes on a fresh database where
 * showEscrow = 0). Three entrants per show take the whole prize (50/30/20), so
 * settlement drains every escrow column it owns to 0. createShow only accepts
 * the 23, so the legacy show is created as Dressage and then given the legacy
 * name on its own row, the shape a pre-B3 row has. Teardown re-settles any
 * still-funded owned show through the real executor before deleting rows, so a
 * failing run does not orphan escrow credit either.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup; the executor is
 * scoped by body.showIds and the stat-gain roll is forced through the
 * executor's statGainRng option (the awardPlacementProgression rng seam).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createShow } from '../shows/showController.mjs';
import { computePlacementAwards } from '../services/competitionAwards.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => randomBytes(6).toString('hex');
const PRIZE = 100;
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

async function makeUser(tag, money) {
  return prisma.user.create({
    data: {
      email: `b3unk-${tag}-${uid()}@test.local`,
      username: `b3u${tag}${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Unknown',
      lastName: 'Discipline',
      money,
    },
  });
}

async function makeHorse(ownerId, band, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-b3unk-${uid()}`,
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
      intelligence: band,
      flexibility: band,
    },
    horseIds,
  );
}

function fakeRes() {
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

/** A Dressage show funded through the real createShow path (prize -> showEscrow). */
async function createFundedShow(creatorId) {
  const res = fakeRes();
  await createShow(
    {
      user: { id: creatorId },
      body: { name: `TestFixture-b3unk-${uid()}`, discipline: 'Dressage', entryFee: 0, prize: PRIZE },
    },
    res,
  );
  expect(res.statusCode).toBe(201);
  return res.body.data.show;
}

const STATS = { precision: true, focus: true, obedience: true, intelligence: true };

describe('nightly settlement with a discipline outside the 23', () => {
  it('settles the legacy show without stat gains, and the valid show in the same run still settles', async () => {
    const creator = await makeUser('c', 2 * PRIZE);
    const owner = await makeUser('o', 0);
    const horseIds = [];
    // Bands far apart so luck (+1..+10%) cannot reorder them.
    const bands = [90, 60, 30];
    const legacyHorses = [];
    const validHorses = [];
    for (const band of bands) {
      legacyHorses.push(await makeHorse(owner.id, band, horseIds));
    }
    for (const band of bands) {
      validHorses.push(await makeHorse(owner.id, band, horseIds));
    }

    // Legacy show first in id order, so the old code would fail before the valid one.
    const legacyShow = await createFundedShow(creator.id);
    const validShow = await createFundedShow(creator.id);
    const showIds = [legacyShow.id, validShow.id];
    // Registered first (the tracker runs callbacks in registration order): a show
    // this test funded but did not finish settling is settled through the real
    // executor before any row is deleted, so its escrow credit reaches its owners
    // instead of being orphaned.
    cleanup.add(async () => {
      const funded = await prisma.show.findMany({
        where: { id: { in: showIds }, status: 'open', OR: [{ prizeEscrow: { gt: 0 } }, { feeEscrow: { gt: 0 } }] },
        select: { id: true },
      });
      if (funded.length) {
        await prisma.show.updateMany({
          where: { id: { in: funded.map(s => s.id) } },
          data: { discipline: 'Dressage', closeDate: new Date(Date.now() - 60 * 1000) },
        });
        await executeClosedShows({ body: { showIds: funded.map(s => s.id) } }, null);
      }
    }, 'settle still-funded shows');
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(
      () => prisma.userTransaction.deleteMany({ where: { userId: { in: [creator.id, owner.id] } } }),
      'userTransaction',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [creator.id, owner.id] } } }), 'user');

    // The legacy row: a discipline outside the 23, and both shows due tonight.
    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.show.update({
      where: { id: legacyShow.id },
      data: { discipline: 'Obedience Training', closeDate: pastClose },
    });
    await prisma.show.update({ where: { id: validShow.id }, data: { closeDate: pastClose } });

    await prisma.showEntry.createMany({
      data: [
        ...legacyHorses.map(h => ({ showId: legacyShow.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
        ...validHorses.map(h => ({ showId: validShow.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
      ],
    });
    const statsBefore = new Map();
    for (const h of [...legacyHorses, ...validHorses]) {
      statsBefore.set(h.id, await prisma.horse.findUnique({ where: { id: h.id }, select: STATS }));
    }

    // Every top-3 roll succeeds and picks the first stat (Dressage: precision).
    await expect(executeClosedShows({ body: { showIds } }, null, { statGainRng: () => 0 })).resolves.not.toThrow();

    const shows = await prisma.show.findMany({
      where: { id: { in: showIds } },
      select: { id: true, status: true, prizeEscrow: true, feeEscrow: true },
      orderBy: { id: 'asc' },
    });
    // Both settled, and every escrow dollar these shows held reached an owner.
    expect(shows.map(s => [s.status, s.prizeEscrow, s.feeEscrow])).toEqual([
      ['completed', 0, 0],
      ['completed', 0, 0],
    ]);

    const results = await prisma.competitionResult.findMany({
      where: { showId: { in: showIds } },
      select: {
        showId: true,
        horseId: true,
        placement: true,
        horsePointsAwarded: true,
        statGains: true,
        prizeWon: true,
      },
    });
    expect(results).toHaveLength(6);
    const expectedPrize = { 1: 50, 2: 30, 3: 20 };

    // The legacy show: placements, Horse Points and prizes as today; no stat gains.
    for (const [i, h] of legacyHorses.entries()) {
      const r = results.find(x => x.horseId === h.id);
      const placement = i + 1;
      expect(r).toMatchObject({
        showId: legacyShow.id,
        placement,
        horsePointsAwarded: computePlacementAwards(placement).horseXp,
        statGains: null,
      });
      expect(Number(r.prizeWon)).toBe(expectedPrize[placement]);
      const after = await prisma.horse.findUnique({ where: { id: h.id }, select: STATS });
      expect(after).toEqual(statsBefore.get(h.id));
    }

    // The valid show: unchanged behaviour, every forced top-3 roll raises precision.
    for (const [i, h] of validHorses.entries()) {
      const r = results.find(x => x.horseId === h.id);
      const placement = i + 1;
      expect(r).toMatchObject({
        showId: validShow.id,
        placement,
        horsePointsAwarded: computePlacementAwards(placement).horseXp,
        statGains: { stat: 'precision', gain: 1 },
      });
      expect(Number(r.prizeWon)).toBe(expectedPrize[placement]);
      const after = await prisma.horse.findUnique({ where: { id: h.id }, select: STATS });
      expect(after.precision).toBe(statsBefore.get(h.id).precision + 1);
    }

    // Both prize pools reached the owner in full.
    const ownerAfter = await prisma.user.findUnique({ where: { id: owner.id }, select: { money: true } });
    expect(ownerAfter.money).toBe(2 * PRIZE);
  }, 90000);
});
