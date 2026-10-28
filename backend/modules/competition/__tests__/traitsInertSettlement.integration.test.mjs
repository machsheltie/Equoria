/**
 * traitsInertSettlement.integration.test.mjs (Equoria-k1p62)
 *
 * Owner ruling 2026-10-23 (epic Equoria-k1p62, replacing decision D's
 * matching-trait +5): there is NO flat matching-trait bonus. Each active trait
 * does only what that trait individually defines, and until traits are
 * reworked, traits contribute NOTHING to a show score. Traits and flags are one
 * family (owner ruling 2026-10-19), so a horse's epigenetic flags do not move
 * its rider's percentages either.
 *
 * Four horses with identical stats, health (Good, 0%), temperament (Bold,
 * Dressage-neutral) and rider (experienced + methodical in Dressage: +5%), in
 * one Dressage show: no traits; a revealed Dressage affinity trait; a spread
 * of revealed, negative and hidden traits; four positive flags. Every one
 * scores the same: base 200 x (1 + (6 luck + 5 rider) / 100) = 222.
 * (A base of 200 makes a 0.4% rider-flag nudge cross a rounding boundary, so
 * the test would see it.)
 *
 * The scores tie, so the tie re-roll orders them; the injected rng rolls +6%
 * luck for the four entries, then distinct tie-break rolls.
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
import { giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const uid = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
afterAll(() => cleanup.run(), 60000);

/** +6% luck for the four entries, then four distinct tie-break rolls. */
function scoreRngSequence() {
  const rolls = [0.5, 0.5, 0.5, 0.5, 0.95, 0.75, 0.35, 0.15];
  let i = 0;
  return () => (i < rolls.length ? rolls[i++] : 0.5);
}

describe('traits contribute nothing to a ridden show score (owner ruling 2026-10-23)', () => {
  it('a horse with any traits or flags scores exactly what the same horse scores without them', async () => {
    const owner = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `k1p62-traits-${uid()}@test.local`,
        username: `k1n${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Inert',
        lastName: 'Traits',
        money: 0,
      },
    });
    const horseIds = [];
    // Registered first so it runs last: riders, horses (results and entries
    // cascade), then the owner.
    const show = await prisma.show.create({
      data: {
        name: `TestFixture-k1p62n-${uid()}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: new Date(Date.now() - 60 * 60 * 1000),
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: new Date(Date.now() - 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
    });
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: show.id } }), 'show');
    const riderCleanup = createCleanupTracker();
    cleanup.add(() => riderCleanup.run(), 'riders');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');

    const makeHorse = async extra => {
      const horse = await createTestHorse(
        prisma,
        {
          name: `TestFixture-k1p62n-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          ...careForHealth('Good'), // with fed today: displayed Good, 0%
          lastFedDate: new Date(),
          temperament: 'Bold', // Dressage: neutral
          precision: 200,
          focus: 200,
          obedience: 200,
          ...extra,
        },
        horseIds,
      );
      await giveEligibleRider(
        prisma,
        {
          horseId: horse.id,
          userId: owner.id,
          rider: { skillLevel: 'experienced', personality: 'methodical' },
        },
        riderCleanup,
      );
      return horse;
    };

    const plain = await makeHorse({});
    const matchingTrait = await makeHorse({
      epigeneticModifiers: { positive: ['disciplineAffinityDressage'], negative: [], hidden: [] },
    });
    const manyTraits = await makeHorse({
      epigeneticModifiers: {
        positive: ['brave', 'confident', 'showCalm', 'crowdReady', 'presentationBoosted'],
        negative: ['fearful', 'skittish'],
        hidden: ['legendaryBloodline', 'disciplineAffinityDressage'],
      },
    });
    const flagged = await makeHorse({
      epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient'],
    });
    const horses = { plain, matchingTrait, manyTraits, flagged };

    await prisma.showEntry.createMany({
      data: Object.values(horses).map(h => ({
        showId: show.id,
        horseId: h.id,
        userId: owner.id,
        feePaid: 0,
      })),
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null, {
      scoreRng: scoreRngSequence(),
      statGainRng: () => 0.999,
    });

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, score: true },
    });
    const scores = Object.fromEntries(
      Object.entries(horses).map(([label, h]) => [label, Number(results.find(r => r.horseId === h.id).score)]),
    );
    expect(scores).toEqual({ plain: 222, matchingTrait: 222, manyTraits: 222, flagged: 222 });
  }, 60000);
});
