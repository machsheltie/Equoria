/**
 * matchingTraitSettlement.integration.test.mjs (Equoria-k1p62.1)
 *
 * Owner rulings 2026-10-19/20 and decision D (2026-10-23, epic Equoria-k1p62):
 * a horse whose discipline trait matches the show's discipline scores +5 FLAT
 * points, added to the 50/30/20 base before the luck, rider and temperament
 * percentages. A hidden trait is inert until revealed (owner 2026-10-19).
 *
 * Until the one-per-horse discipline trait has its own storage, the trait it
 * replaces is the representation: a revealed (epigeneticModifiers.positive)
 * disciplineAffinity<Discipline> key.
 *
 * Three horses, one Dressage show, no rider, a Dressage-neutral temperament
 * (Bold), luck pinned to the lowest roll (+1%) through scoreRng, no stat-gain
 * roll succeeds. Each horse's precision/focus/obedience are equal, so its base
 * is that value. Distinct bases keep the scores apart (no tie re-roll).
 *
 * Real DB, TestFixture- fixtures, id-scoped fail-loud cleanup.
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
      email: `k1p62-trait-${uid()}@test.local`,
      username: `k1t${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Matching',
      lastName: 'Trait',
      money: 0,
    },
  });
}

/** A horse whose Dressage base is `base`, carrying `modifiers`. */
async function makeHorse(ownerId, base, modifiers, horseIds) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-k1p62t-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      temperament: 'Bold', // Dressage: neutral (0%)
      precision: base,
      focus: base,
      obedience: base,
      epigeneticModifiers: { positive: [], negative: [], hidden: [], ...modifiers },
    },
    horseIds,
  );
}

describe('nightly settlement adds the matching discipline trait (+5 flat, k1p62.1)', () => {
  it('a revealed matching trait adds 5 before the percentages; hidden or other-discipline traits add nothing', async () => {
    const owner = await makeOwner();
    const horseIds = [];
    // (50 + 5) x 1.01 = 55.55 -> 56. Without the trait: 50.5 -> 51.
    const revealed = await makeHorse(owner.id, 50, { positive: ['disciplineAffinityDressage'] }, horseIds);
    // Hidden = inert: 52 x 1.01 = 52.52 -> 53.
    const hidden = await makeHorse(owner.id, 52, { hidden: ['disciplineAffinityDressage'] }, horseIds);
    // Another discipline's trait: 54 x 1.01 = 54.54 -> 55.
    const otherDiscipline = await makeHorse(owner.id, 54, { positive: ['disciplineAffinityRacing'] }, horseIds);

    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-k1p62t-${uid()}`,
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
      data: [revealed, hidden, otherDiscipline].map(h => ({
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

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, score: true },
    });
    const scoreOf = horse => Number(results.find(r => r.horseId === horse.id).score);
    expect(scoreOf(revealed)).toBe(56);
    expect(scoreOf(hidden)).toBe(53);
    expect(scoreOf(otherDiscipline)).toBe(55);
    const placementOf = horse => results.find(r => r.horseId === horse.id).placement;
    expect([revealed, otherDiscipline, hidden].map(placementOf)).toEqual([1, 2, 3]);
  }, 60000);
});
