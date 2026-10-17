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
 * Contract: such a show still settles (placements, Horse Points, prize). Only
 * the random stat gain is skipped. A valid show in the same nightly run settles
 * exactly as before, stat gain included.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup; the executor is
 * scoped by body.showIds and the stat-gain roll is forced through the
 * executor's statGainRng option (the awardPlacementProgression rng seam).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { computePlacementAwards } from '../services/competitionAwards.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

async function makeUser(tag) {
  return prisma.user.create({
    data: {
      email: `b3unk-${tag}-${uid()}@test.local`,
      username: `b3u${tag}${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Unknown',
      lastName: 'Discipline',
      money: 0,
    },
  });
}

async function makeHorse(ownerId, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-b3unk-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      speed: 50,
      stamina: 50,
      agility: 50,
      balance: 50,
      precision: 50,
      boldness: 50,
      focus: 50,
      obedience: 50,
      intelligence: 50,
    },
    horseIds,
  );
}

async function makeClosedShow(creatorId, discipline) {
  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.show.create({
    data: {
      name: `TestFixture-b3unk-${uid()}`,
      discipline,
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 100,
      prizeEscrow: 100,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: creatorId,
    },
  });
}

const STATS = { precision: true, focus: true, obedience: true, intelligence: true };

describe('nightly settlement with a discipline outside the 23', () => {
  it('settles the legacy show without a stat gain, and the valid show in the same run still settles', async () => {
    const creator = await makeUser('c');
    const owner = await makeUser('o');
    const horseIds = [];
    const legacyHorse = await makeHorse(owner.id, horseIds);
    const validHorse = await makeHorse(owner.id, horseIds);
    // Legacy show first in id order, so the old code would fail before the valid one.
    const legacyShow = await makeClosedShow(creator.id, 'Obedience Training');
    const validShow = await makeClosedShow(creator.id, 'Dressage');
    const showIds = [legacyShow.id, validShow.id];
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [creator.id, owner.id] } } }), 'user');

    await prisma.showEntry.createMany({
      data: [
        { showId: legacyShow.id, horseId: legacyHorse.id, userId: owner.id, feePaid: 0 },
        { showId: validShow.id, horseId: validHorse.id, userId: owner.id, feePaid: 0 },
      ],
    });

    // The roll always succeeds and picks the first stat (Dressage: precision).
    await expect(executeClosedShows({ body: { showIds } }, null, { statGainRng: () => 0 })).resolves.not.toThrow();

    const shows = await prisma.show.findMany({
      where: { id: { in: showIds } },
      select: { id: true, status: true },
    });
    expect(shows.map(s => s.status)).toEqual(['completed', 'completed']);

    const results = await prisma.competitionResult.findMany({
      where: { showId: { in: showIds } },
      select: { showId: true, placement: true, horsePointsAwarded: true, statGains: true, prizeWon: true },
    });
    const byShow = new Map(results.map(r => [r.showId, r]));
    const legacy = byShow.get(legacyShow.id);
    const valid = byShow.get(validShow.id);

    // The legacy show: placement, Horse Points and prize as today; no stat gain.
    expect(legacy).toMatchObject({ placement: '1', horsePointsAwarded: computePlacementAwards(1).horseXp });
    expect(legacy.statGains).toBeNull();
    expect(Number(legacy.prizeWon)).toBeGreaterThan(0);
    const legacyAfter = await prisma.horse.findUnique({ where: { id: legacyHorse.id }, select: STATS });
    expect(legacyAfter).toEqual({ precision: 50, focus: 50, obedience: 50, intelligence: 50 });

    // The valid show: unchanged behaviour, the forced roll raises precision.
    expect(valid).toMatchObject({
      placement: '1',
      horsePointsAwarded: computePlacementAwards(1).horseXp,
      statGains: { stat: 'precision', gain: 1 },
    });
    expect(Number(valid.prizeWon)).toBeGreaterThan(0);
    const validAfter = await prisma.horse.findUnique({ where: { id: validHorse.id }, select: STATS });
    expect(validAfter.precision).toBe(51);

    // Both prizes reached the owner.
    const ownerAfter = await prisma.user.findUnique({ where: { id: owner.id }, select: { money: true } });
    expect(ownerAfter.money).toBe(Number(legacy.prizeWon) + Number(valid.prizeWon));
  }, 60000);
});
