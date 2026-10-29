/**
 * healthModifierSettlement.integration.test.mjs (Equoria-k1p62)
 *
 * Owner rulings 2026-10-23 (decision C, epic Equoria-k1p62): a horse's health
 * modifies its show score by the bible's table, summed with the other percent
 * terms: Excellent +5%, Very Good +3%, Good 0, Fair -3%, Bad -5%. The care
 * vocabulary's Poor, Bad and Critical are all Bad. The health read is the
 * horse's displayed health (the worse of feed and vet health), the same state
 * every gate reads.
 *
 * Five horses, one Dressage show, no rider, Bold temperament (Dressage
 * neutral), luck pinned to +1% through scoreRng, no stat-gain roll succeeds.
 * Owner ruling 2026-10-23 (Equoria-qwz60): the displayed band comes from days
 * since the vet visit (0-7 Excellent, 15-21 Good, 22-28 Fair, 29+ Bad) with a
 * feeding today; a Poor or Critical vet finding is Bad. Old contract: a stored
 * healthStatus word set the band. Distinct bases keep the scores apart.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

describe('nightly settlement applies the health modifier (decision C)', () => {
  it('Excellent +5%, Good 0, Fair -3%, Poor and Critical -5% (Bad)', async () => {
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
    const owner = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `k1p62-health-${uid()}@test.local`,
        username: `k1h${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Health',
        lastName: 'Modifier',
        money: 0,
      },
    });
    const horseIds = [];
    const makeHorse = (base, health) =>
      createTestHorse(
        prisma,
        {
          name: `TestFixture-k1p62h-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          temperament: 'Bold', // Dressage: neutral
          precision: base,
          focus: base,
          obedience: base,
          ...health,
        },
        horseIds,
      );
    const fedToday = new Date();
    const vettedDaysAgo = days => gameCalendarDate(new Date(), -days);
    const cases = [
      // [label, base, health fields, expected]
      // Excellent: 100 x (1 + (1 + 5) / 100) = 106.
      ['excellent', 100, { lastVettedDate: vettedDaysAgo(0), lastFedDate: fedToday }, 106],
      // Good (vetted 15 days ago): 102 x 1.01 = 103.02 -> 103.
      ['good', 102, { lastVettedDate: vettedDaysAgo(15), lastFedDate: fedToday }, 103],
      // Fair (vetted 22 days ago): 104 x (1 + (1 - 3) / 100) = 101.92 -> 102.
      ['fair', 104, { lastVettedDate: vettedDaysAgo(22), lastFedDate: fedToday }, 102],
      // Poor is Bad: 108 x (1 + (1 - 5) / 100) = 103.68 -> 104.
      ['poor', 108, { healthStatus: 'Poor', lastVettedDate: vettedDaysAgo(0), lastFedDate: fedToday }, 104],
      // Vetted 29 days ago is Bad: 112 x 0.96 = 107.52 -> 108.
      ['critical', 112, { lastVettedDate: vettedDaysAgo(29), lastFedDate: fedToday }, 108],
    ];
    const horses = [];
    for (const [label, base, health, expected] of cases) {
      horses.push({ label, expected, horse: await makeHorse(base, health) });
    }

    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-k1p62h-${uid()}`,
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
