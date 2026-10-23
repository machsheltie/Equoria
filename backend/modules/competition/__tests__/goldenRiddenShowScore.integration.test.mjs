/**
 * goldenRiddenShowScore.integration.test.mjs (Equoria-k1p62.3)
 *
 * One ridden show settled end to end by the real nightly executor, with every
 * live scoring factor in play (epic Equoria-k1p62, owner rulings 2026-10-15
 * to 2026-10-23):
 *
 *   score = round((base + trait + tack) x (1 + (luck + rider + temperament) / 100)),
 *   x.5 rounds up
 *
 *   base        50/30/20 of the discipline's three stats (Dressage: precision,
 *               focus, obedience)
 *   trait       +5 flat for a revealed trait matching the discipline; hidden = 0
 *   tack        saddle + bridle: discipline tack +5 each in its own discipline,
 *               All Purpose +2 each, flat
 *   luck        +1..+10% whole; the injected rng 0.5 rolls +6% for everyone
 *   rider       bonus minus penalty, in percent (riderBonus.computeRiderModifiers)
 *   temperament +5 / 0 / -5% from the owner's matrix
 *
 * Then placements, the 50/30/20 prize split from the show's escrow, Horse
 * Points 10/5/3 and money conservation over the suite's own wallets + escrow.
 *
 * The show and entries are built through the real createShow / enterShow
 * controllers (escrow-funded, entry rules enforced). Training (decision B),
 * health (decision C) and the post-show stat roll (decision E) are still open
 * with the owner, so they are held out: no horse has a discipline score that
 * could matter, every horse is in good health, and no stat-gain roll succeeds.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  competitionDateOfBirth,
  giveEligibleRider,
  healthyAndFed,
} from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const uid = () => randomBytes(5).toString('hex');
const fixtures = createFundedShowFixtures('TestFixture-k1p62g');
const own = createCleanupTracker();
// Our horses and riders first (results and entries cascade with the horse),
// then the fixture's shows, transactions and users.
afterAll(async () => {
  await own.run();
  await fixtures.cleanup();
}, 60000);

/**
 * An entrant whose horse carries the given stats, traits, tack and temperament,
 * ridden by an employed rider with the given personality and skill level.
 */
async function makeCompetitor({ stats, modifiers, tack, temperament, rider }) {
  const owner = await fixtures.makeUser(0, 'entrant');
  const horse = await createTestHorse(prisma, {
    name: `TestFixture-k1p62g-horse-${uid()}`,
    sex: 'Mare',
    dateOfBirth: competitionDateOfBirth(),
    age: 7,
    userId: owner.id,
    ...healthyAndFed(),
    temperament,
    ...stats,
    epigeneticModifiers: { positive: [], negative: [], hidden: [], ...modifiers },
    tack,
  });
  own.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), `horse ${horse.id}`);
  await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id, rider }, own);
  return { owner, horse };
}

describe('golden ridden show score: every live factor, settled by the nightly executor (k1p62.3)', () => {
  it('scores, places, pays 50/30/20 and awards Horse Points 10/5/3 exactly', async () => {
    const { creator, showId } = await fixtures.createFundedShow({ prize: 1000, entryFee: 0 });

    // A: base 0.5*80 + 0.3*70 + 0.2*60 = 73; revealed Dressage trait +5; Dressage
    // saddle + Dressage bridle +10 -> 88. Luck +6, rider experienced (+3) and
    // methodical in Dressage (+2) = +5, Calm in Dressage +5 -> +16%.
    // 88 x 1.16 = 102.08 -> 102.
    const a = await makeCompetitor({
      stats: { precision: 80, focus: 70, obedience: 60 },
      modifiers: { positive: ['disciplineAffinityDressage'] },
      tack: { saddle: 'dressage-saddle', bridle: 'double-bridle' },
      temperament: 'Calm',
      rider: { skillLevel: 'experienced', personality: 'methodical' },
    });
    // B: base 70; the Dressage trait is hidden, so inert; All Purpose saddle +
    // bridle +4 -> 74. Luck +6, rider rookie (penalty 1) with no Dressage
    // affinity = -1, Nervous in Dressage -5 -> 0%. 74 x 1.00 = 74.
    const b = await makeCompetitor({
      stats: { precision: 70, focus: 70, obedience: 70 },
      modifiers: { hidden: ['disciplineAffinityDressage'] },
      tack: { saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' },
      temperament: 'Nervous',
      rider: { skillLevel: 'rookie', personality: 'daring' },
    });
    // C: base 76; no trait; Jump saddle (not Dressage) 0 + Snaffle bridle
    // (Dressage, Show Jumping) +5 -> 81. Luck +6, rider developing with no
    // Dressage affinity 0, Steady in Dressage +5 -> +11%. 81 x 1.11 = 89.91 -> 90.
    const c = await makeCompetitor({
      stats: { precision: 76, focus: 76, obedience: 76 },
      modifiers: {},
      tack: { saddle: 'jumping-saddle', bridle: 'snaffle-bridle' },
      temperament: 'Steady',
      rider: { skillLevel: 'developing', personality: 'intuitive' },
    });

    const entrants = [a, b, c];
    for (const entrant of entrants) {
      const res = await fixtures.enter(showId, entrant);
      expect(res.statusCode).toBe(201);
    }
    await fixtures.close(showId);
    const heldBefore = await fixtures.heldMoney({ creator, showId, entrants });

    await executeClosedShows({ body: { showIds: [showId] } }, null, {
      scoreRng: () => 0.5, // every luck roll +6%
      statGainRng: () => 0.999, // no post-show stat gain (decision E held out)
    });

    const results = await prisma.competitionResult.findMany({
      where: { showId },
      select: { horseId: true, score: true, placement: true, prizeWon: true, horsePointsAwarded: true },
    });
    const resultOf = ({ horse }) => {
      const row = results.find(r => r.horseId === horse.id);
      return {
        score: Number(row.score),
        placement: row.placement,
        prizeWon: Number(row.prizeWon),
        horsePointsAwarded: row.horsePointsAwarded,
      };
    };
    expect(resultOf(a)).toEqual({ score: 102, placement: 1, prizeWon: 500, horsePointsAwarded: 10 });
    expect(resultOf(c)).toEqual({ score: 90, placement: 2, prizeWon: 300, horsePointsAwarded: 5 });
    expect(resultOf(b)).toEqual({ score: 74, placement: 3, prizeWon: 200, horsePointsAwarded: 3 });

    const horses = await prisma.horse.findMany({
      where: { id: { in: entrants.map(e => e.horse.id) } },
      select: { id: true, horseXp: true, totalEarnings: true },
    });
    const horseRow = ({ horse }) => horses.find(h => h.id === horse.id);
    expect([a, c, b].map(e => horseRow(e).horseXp)).toEqual([10, 5, 3]);
    expect([a, c, b].map(e => horseRow(e).totalEarnings)).toEqual([500, 300, 200]);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { status: true, prizeEscrow: true, feeEscrow: true },
    });
    expect(show).toEqual({ status: 'completed', prizeEscrow: 0, feeEscrow: 0 });
    expect(await fixtures.heldMoney({ creator, showId, entrants })).toBe(heldBefore);
  }, 90000);
});
