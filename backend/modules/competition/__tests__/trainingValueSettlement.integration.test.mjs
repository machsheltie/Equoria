/**
 * trainingValueSettlement.integration.test.mjs (Equoria-k1p62)
 *
 * Owner ruling 2026-10-23 (decision B, epic Equoria-k1p62): the show score
 * includes the horse's TRAINED VALUE in the show's discipline, as flat points:
 * each week trained there adds +5, so it grows week after week. Five weeks of
 * Saddleseat, entered in a Saddleseat show, is +25. Training in another
 * discipline adds nothing here. The value is the one training writes,
 * Horse.disciplineScores[discipline].
 *
 * Five horses, one Saddleseat show (flexibility / balance / obedience), no
 * rider, Good health (0%), a Saddleseat-neutral temperament (Calm), luck
 * pinned to +1% through scoreRng, no stat-gain roll succeeds. Each horse's
 * three stats are equal, so its base is that value; distinct bases keep the
 * scores apart.
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

describe('nightly settlement adds the trained value in the show discipline (decision B)', () => {
  it('adds the accumulated discipline training as flat points before the percentages', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `k1p62-train-${uid()}@test.local`,
        username: `k1r${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Trained',
        lastName: 'Value',
        money: 0,
      },
    });
    const horseIds = [];
    const makeHorse = (base, disciplineScores) =>
      createTestHorse(
        prisma,
        {
          name: `TestFixture-k1p62r-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          ...careForHealth('Good'), // with fed today: displayed Good, 0%
          lastFedDate: new Date(),
          temperament: 'Calm', // Saddleseat: neutral
          flexibility: base,
          balance: base,
          obedience: base,
          disciplineScores,
        },
        horseIds,
      );

    const cases = [
      // [label, base, disciplineScores, expected]
      // Five weeks of Saddleseat: (40 + 25) x 1.01 = 65.65 -> 66.
      ['five weeks of saddleseat', 40, { Saddleseat: 25 }, 66],
      // Trained only elsewhere: 42 x 1.01 = 42.42 -> 42.
      ['trained elsewhere', 42, { Dressage: 50, Racing: 30 }, 42],
      // Two weeks here plus other disciplines: (44 + 10) x 1.01 = 54.54 -> 55.
      ['two weeks here and elsewhere', 44, { Saddleseat: 10, Dressage: 40 }, 55],
      // Never trained: 46 x 1.01 = 46.46 -> 46.
      ['never trained', 46, {}, 46],
      // A stored value that is not a number counts for nothing: 48 x 1.01 = 48.48 -> 48.
      ['malformed value', 48, { Saddleseat: 'lots' }, 48],
    ];
    const horses = [];
    for (const [label, base, disciplineScores, expected] of cases) {
      horses.push({ label, expected, horse: await makeHorse(base, disciplineScores) });
    }

    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-k1p62r-${uid()}`,
        discipline: 'Saddleseat',
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
