/**
 * temperamentSettlement.integration.test.mjs (Equoria-576c0 B6)
 *
 * The nightly executor loads each horse's temperament and scores it as a
 * +5 / 0 / -5 percent term (owner ruling R1, summed once per C2). A horse
 * whose temperament is null settles with a 0 term (the approved O5 interim
 * behaviour: exactly what every horse got before B6) while the valid horses
 * in the same run get their matrix term.
 *
 * One Dressage show, three horses with base 100 (all ten stats 100):
 *   Calm (Positive)    100 x (1 + 0.01 + 0.05) = 106
 *   null temperament   100 x (1 + 0.01)        = 101
 *   Nervous (Negative) 100 x (1 + 0.01 - 0.05) = 96
 * Luck is pinned to +1% through the executor's scoreRng option (rng 0); no
 * stat-gain roll succeeds (statGainRng 0.999). Real DB, TestFixture- fixtures,
 * id-scoped fail-loud cleanup, executor scoped by body.showIds.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

const STATS_100 = {
  speed: 100,
  stamina: 100,
  agility: 100,
  balance: 100,
  precision: 100,
  intelligence: 100,
  boldness: 100,
  flexibility: 100,
  obedience: 100,
  focus: 100,
};

describe('nightly settlement scores temperament as a percent term (B6)', () => {
  it('Calm +5%, Nervous -5%, and a null temperament settles with 0 in the same run', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `b6-${uid()}@test.local`,
        username: `b6${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Temperament',
        lastName: 'Term',
        money: 0,
      },
    });
    const horseIds = [];
    const makeHorse = temperament =>
      createTestHorse(
        prisma,
        {
          name: `TestFixture-b6-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          // Owner ruling 2026-10-23 (decision C, Equoria-k1p62): health is a percent term in
          // every score; Good health (fed today) is 0%, so this test still isolates its
          // own factor. Old fixture: healthStatus 'healthy' (no health term then).
          healthStatus: 'Good',
          lastFedDate: new Date(),
          temperament,
          ...STATS_100,
        },
        horseIds,
      );
    const calm = await makeHorse('Calm');
    const unrecorded = await makeHorse(null);
    const nervous = await makeHorse('Nervous');

    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-b6-${uid()}`,
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
      data: [calm, unrecorded, nervous].map(h => ({
        showId: show.id,
        horseId: h.id,
        userId: owner.id,
        feePaid: 0,
      })),
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null, {
      scoreRng: () => 0,
      statGainRng: () => 0.999,
    });

    const settled = await prisma.show.findUnique({ where: { id: show.id }, select: { status: true } });
    expect(settled.status).toBe('completed');
    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, score: true },
    });
    const byHorse = new Map(results.map(r => [r.horseId, r]));
    expect(results).toHaveLength(3);
    expect(Number(byHorse.get(calm.id).score)).toBe(106);
    expect(byHorse.get(calm.id).placement).toBe(1);
    expect(Number(byHorse.get(unrecorded.id).score)).toBe(101);
    expect(byHorse.get(unrecorded.id).placement).toBe(2);
    expect(Number(byHorse.get(nervous.id).score)).toBe(96);
    expect(byHorse.get(nervous.id).placement).toBe(3);
  }, 60000);
});
