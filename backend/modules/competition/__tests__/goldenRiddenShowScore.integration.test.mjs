/**
 * goldenRiddenShowScore.integration.test.mjs (Equoria-k1p62.3)
 *
 * One ridden show settled end to end by the real nightly executor, with every
 * live scoring factor in play (epic Equoria-k1p62, owner rulings 2026-10-15
 * to 2026-10-23):
 *
 *   score = round((base + training + tack)
 *                 x (1 + (luck + rider + temperament + health) / 100)),
 *   x.5 rounds up
 *
 *   base        50/30/20 of the discipline's three stats (Dressage: precision,
 *               focus, obedience)
 *   training    the horse's trained value in the show's discipline (+5 per
 *               week trained there), flat; other disciplines' training adds 0
 *   tack        saddle + bridle: discipline tack +5 each in its own discipline,
 *               All Purpose +2 each, flat
 *   luck        +1..+10% whole; the injected rng 0.5 rolls +6% for everyone
 *   rider       bonus minus penalty, in percent (riderBonus.computeRiderModifiers)
 *   temperament +5 / 0 / -5% from the owner's matrix
 *   health      Excellent +5, Very Good +3, Good 0, Fair -3, Bad -5 %
 *   traits      nothing, revealed, hidden or flags, until traits are reworked
 *
 * Then placements, the 50/30/20 prize split from the show's escrow, Horse
 * Points 10/5/3 and money conservation over the suite's own wallets + escrow.
 *
 * The show and entries are built through the real createShow / enterShow
 * controllers (escrow-funded, entry rules enforced). The post-show +1 stat
 * roll (decision E, kept) is not rolled here (statGainRng never succeeds); its
 * own suites cover it.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { careForHealth } from '../../../__tests__/helpers/healthFixture.mjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const uid = () => randomBytes(5).toString('hex');
const fixtures = createFundedShowFixtures('TestFixture-k1p62g');
// The prize is always 10x the entry fee (owner ruling 2026-10-23, Equoria-v0ys3).
const PRIZE = 1000;
const entryFee = PRIZE / 10;
const own = createCleanupTracker();
// Our horses and riders first (results and entries cascade with the horse),
// then the fixture's shows, transactions and users.
afterAll(async () => {
  await own.run();
  await fixtures.cleanup();
}, 60000);

/**
 * An entrant whose horse carries the given stats, traits, training, tack,
 * temperament and health (a vet finding; fed today), ridden by an employed
 * rider with the given personality and skill level.
 */
async function makeCompetitor({ stats, traits, training, tack, temperament, health, rider }) {
  const owner = await fixtures.makeUser(entryFee, 'entrant');
  const horse = await createTestHorse(prisma, {
    name: `TestFixture-k1p62g-horse-${uid()}`,
    sex: 'Mare',
    dateOfBirth: competitionDateOfBirth(),
    age: 7,
    userId: owner.id,
    ...careForHealth(health),
    lastFedDate: new Date(),
    temperament,
    ...stats,
    ...traits,
    disciplineScores: training,
    tack,
  });
  own.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), `horse ${horse.id}`);
  await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id, rider }, own);
  return { owner, horse };
}

describe('golden ridden show score: every live factor, settled by the nightly executor (k1p62.3)', () => {
  it('scores, places, pays 50/30/20 and awards Horse Points 10/5/3 exactly', async () => {
    const { creator, showId } = await fixtures.createFundedShow({ prize: PRIZE, entryFee });

    // Rider level (owner rulings 2026-10-29: q282 retired the old skill word, q302 gave
    // the star level a show bonus of +0 / +1 / +2 / +3 / +4 % from Rookie to Expert).
    // Old contract: A's 'experienced' rider +3 (119), B's 'rookie' rider -1 (72), C's
    // 'developing' rider 0 (95).
    // A: base 0.5*80 + 0.3*70 + 0.2*60 = 73; three weeks of Dressage +15;
    // Dressage saddle + Dressage bridle +10 -> 98. Luck +6, Expert rider +4 and
    // methodical in Dressage +2, Calm in Dressage +5, Excellent health +5 -> +22%.
    // 98 x 1.22 = 119.56 -> 120. Its revealed Dressage trait adds nothing.
    const a = await makeCompetitor({
      stats: { precision: 80, focus: 70, obedience: 60 },
      traits: {
        epigeneticModifiers: { positive: ['disciplineAffinityDressage'], negative: [], hidden: [] },
      },
      training: { Dressage: 15 },
      tack: { saddle: 'dressage-saddle', bridle: 'double-bridle' },
      temperament: 'Calm',
      health: 'Excellent',
      rider: { personality: 'methodical', starLevel: 'expert' },
    });
    // B: base 70; trained only in Racing, so 0 here; All Purpose saddle +
    // bridle +4 -> 74. Luck +6, Rookie rider +0 with no Dressage affinity 0, Nervous
    // in Dressage -5, Fair health -3 -> -2%. 74 x 0.98 = 72.52 -> 73. Its hidden trait
    // adds nothing.
    const b = await makeCompetitor({
      stats: { precision: 70, focus: 70, obedience: 70 },
      traits: {
        epigeneticModifiers: { positive: [], negative: [], hidden: ['disciplineAffinityDressage'] },
      },
      training: { Racing: 30 },
      tack: { saddle: 'all-purpose-saddle', bridle: 'all-purpose-bridle' },
      temperament: 'Nervous',
      health: 'Fair',
      rider: { personality: 'daring', starLevel: 'rookie' },
    });
    // C: base 76; one week of Dressage +5; Jump saddle (not Dressage) 0 +
    // Snaffle bridle (Dressage, Show Jumping) +5 -> 86. Luck +6, Intermediate rider
    // +2 with no Dressage affinity 0, Steady in Dressage +5, Good health 0 -> +13%.
    // 86 x 1.13 = 97.18 -> 97.
    const c = await makeCompetitor({
      stats: { precision: 76, focus: 76, obedience: 76 },
      traits: {},
      training: { Dressage: 5 },
      tack: { saddle: 'jumping-saddle', bridle: 'snaffle-bridle' },
      temperament: 'Steady',
      health: 'Good',
      rider: { personality: 'intuitive', starLevel: 'intermediate' },
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
      statGainRng: () => 0.999, // no post-show stat gain this run
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
    expect(resultOf(a)).toEqual({ score: 120, placement: 1, prizeWon: 500, horsePointsAwarded: 10 });
    expect(resultOf(c)).toEqual({ score: 97, placement: 2, prizeWon: 300, horsePointsAwarded: 5 });
    expect(resultOf(b)).toEqual({ score: 73, placement: 3, prizeWon: 200, horsePointsAwarded: 3 });

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
