/**
 * weightedBaseSettlement.integration.test.mjs (Equoria-576c0 B4a)
 *
 * The nightly executor scores a ridden show on the discipline's 50/30/20 base
 * (owner ruling R8, BIBLE 13:45-73). The executor's horse select must load
 * every stat a discipline can weigh: before B4a it loaded only speed,
 * stamina, agility, balance, precision and boldness, so focus and obedience
 * (Dressage's secondary and tertiary) never reached the scorer.
 *
 * Two horses, one Dressage show. Under the old flat 5-stat average the
 * all-rounder wins 72 to 34; under the Dressage weighting the specialist
 * wins 83 to 35.
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup. The executor is
 * scoped by body.showIds; luck is pinned through its scoreRng option to the
 * lowest roll, +1% (Owner rulings C1/C2 (2026-10-16, Equoria-576c0 B5); old contract: rng() = 0.5
 * gave luck 0, scores 83 and 35), and no stat-gain roll succeeds (statGainRng 0.999).
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

async function makeOwner() {
  return prisma.user.create({
    data: {
      email: `b4a-${uid()}@test.local`,
      username: `b4a${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Weighted',
      lastName: 'Base',
      money: 0,
    },
  });
}

const BASE_STATS = {
  speed: 50,
  stamina: 50,
  agility: 50,
  balance: 50,
  precision: 50,
  intelligence: 50,
  boldness: 50,
  flexibility: 50,
  obedience: 50,
  focus: 50,
};

async function makeHorse(ownerId, stats, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-b4a-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      ...BASE_STATS,
      ...stats,
    },
    horseIds,
  );
}

describe('nightly settlement scores the discipline’s 50/30/20 base (B4a)', () => {
  it('a Dressage specialist beats a higher-average all-rounder in a Dressage show', async () => {
    const owner = await makeOwner();
    const horseIds = [];
    // Old flat base (speed+stamina+agility+precision+boldness)/5 = 34; Dressage 0.5*90+0.3*80+0.2*70 = 83.
    const specialist = await makeHorse(
      owner.id,
      { precision: 90, focus: 80, obedience: 70, speed: 20, stamina: 20, agility: 20, boldness: 20 },
      horseIds,
    );
    // Old flat base (80*4+40)/5 = 72; Dressage 0.5*40+0.3*30+0.2*30 = 35.
    const allRounder = await makeHorse(
      owner.id,
      { speed: 80, stamina: 80, agility: 80, boldness: 80, precision: 40, focus: 30, obedience: 30 },
      horseIds,
    );
    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-b4a-${uid()}`,
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
      data: [specialist, allRounder].map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null, {
      scoreRng: () => 0,
      statGainRng: () => 0.999,
    });

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, score: true },
    });
    const byHorse = new Map(results.map(r => [r.horseId, r]));
    expect(byHorse.get(specialist.id)).toMatchObject({ placement: 1 });
    expect(Number(byHorse.get(specialist.id).score)).toBe(84); // 83 x 1.01 = 83.83
    expect(byHorse.get(allRounder.id)).toMatchObject({ placement: 2 });
    expect(Number(byHorse.get(allRounder.id).score)).toBe(35); // 35 x 1.01 = 35.35
  }, 60000);
});
