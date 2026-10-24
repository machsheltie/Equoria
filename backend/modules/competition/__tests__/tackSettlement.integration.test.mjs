/**
 * tackSettlement.integration.test.mjs (Equoria-k1p62.2)
 *
 * Owner decision A + D (2026-10-23, epic Equoria-k1p62): the nightly executor
 * adds tack to a ridden show score as FLAT points. Only the saddle and bridle
 * slots count: discipline tack +5 each in its own discipline only, All Purpose
 * +2 each anywhere, so at most +10. Before this, no live scoring path read
 * Horse.tack at all (k1p62 audit).
 *
 * Flat points join the 50/30/20 base before the percentages, like the matching
 * trait (decision D groups them). Eight horses, one Dressage show, no rider, a
 * Dressage-neutral temperament (Bold), luck pinned to +1% through scoreRng, no
 * stat-gain roll succeeds. Each horse's precision/focus/obedience are equal, so
 * its base is that value; distinct bases keep the scores apart.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

async function makeOwner() {
  return prisma.user.create({
    data: {
      email: `k1p62-tack-${uid()}@test.local`,
      username: `k1k${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Tack',
      lastName: 'Scoring',
      money: 0,
    },
  });
}

/** A horse whose Dressage base is `base`, wearing `tack`. */
async function makeHorse(ownerId, base, tack, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-k1p62k-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      ...careForHealth('Good'), // with fed today: displayed Good, 0%
      lastFedDate: new Date(),
      temperament: 'Bold', // Dressage: neutral (0%)
      precision: base,
      focus: base,
      obedience: base,
      tack,
    },
    horseIds,
  );
}

describe('nightly settlement adds saddle and bridle points (decision A, k1p62.2)', () => {
  it('scores discipline tack only in its own discipline, All Purpose anywhere, and nothing else', async () => {
    const owner = await makeOwner();
    const horseIds = [];
    const cases = [
      // [label, base, tack, expected score]
      // Dressage saddle + Dressage bridle: (39 + 10) x 1.01 = 49.49 -> 49.
      ['dressage saddle + bridle', 39, { saddle: 'dressage-saddle', bridle: 'double-bridle' }, 49],
      // All Purpose pair: (42 + 4) x 1.01 = 46.46 -> 46.
      ['all purpose pair', 42, { saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' }, 46],
      // Other disciplines' tack: 44 x 1.01 = 44.44 -> 44.
      ['other-discipline tack', 44, { saddle: 'jumping-saddle', bridle: 'racing-bridle' }, 44],
      // Dressage saddle + All Purpose bridle: (46 + 7) x 1.01 = 53.53 -> 54.
      ['mixed', 46, { saddle: 'dressage-saddle', bridle: 'all-purpose-bridle' }, 54],
      // Crafted Dressage bridle alone: (49 + 5) x 1.01 = 54.54 -> 55.
      ['crafted dressage bridle', 49, { bridle: 'crafted-precision-bridle' }, 55],
      // Stale bonus mirrors with nothing in the slots: 50 x 1.01 = 50.5 -> 51.
      ['mirrors only', 50, { saddleBonus: 7, bridleBonus: 5 }, 51],
      // Decorations and a halter: 52 x 1.01 = 52.52 -> 53.
      ['decorations', 52, { halter: 'show-halter', decorations: ['parade-blanket'] }, 53],
      // Items the owner deleted (q05, 2026-10-23) still named in the slots score nothing: 56 x 1.01 = 56.56 -> 57.
      ['deleted crafted pair', 56, { saddle: 'crafted-event-saddle', bridle: 'crafted-dyed-bridle' }, 57],
    ];
    const horses = [];
    for (const [label, base, tack, expected] of cases) {
      horses.push({ label, expected, horse: await makeHorse(owner.id, base, tack, horseIds) });
    }

    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-k1p62k-${uid()}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: pastClose,
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastClose,
        createdByUserId: owner.id,
      },
    });
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');

    await prisma.showEntry.createMany({
      data: horses.map(({ horse }) => ({
        showId: show.id,
        horseId: horse.id,
        userId: owner.id,
        feePaid: 0,
      })),
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null, {
      scoreRng: () => 0,
      statGainRng: () => 0.999,
    });

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, score: true },
    });
    const scores = Object.fromEntries(
      horses.map(({ label, horse }) => [label, Number(results.find(r => r.horseId === horse.id).score)]),
    );
    expect(scores).toEqual(Object.fromEntries(horses.map(({ label, expected }) => [label, expected])));
  }, 60000);
});
