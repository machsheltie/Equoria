/**
 * Show settlement records each horse's winnings on the horse (Equoria-xal4m).
 *
 * The defect: the nightly executor paid prize money into the owner's wallet but
 * never added it to Horse.totalEarnings, the column the earnings leaderboard and
 * the horse pages read. The legacy instant path did (updateHorseEarnings), but
 * it is 410 Gone, so no live result has ever reached a horse's earnings.
 *
 * Invariant: a horse's totalEarnings grows by exactly the prizeWon its result
 * records, once — including when two executors race for the same show.
 *
 * Real DB, real controllers, scoped fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';

const PRIZE = 1000;
const ENTRY_FEE = 20;

const fx = createFundedShowFixtures('TestFixture-xal4m');

afterAll(() => fx.cleanup(), 60000);

async function earningsOf(horseId) {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { totalEarnings: true } });
  return row.totalEarnings;
}

async function prizeByHorse(showId) {
  const rows = await prisma.competitionResult.findMany({
    where: { showId },
    select: { horseId: true, prizeWon: true },
  });
  return new Map(rows.map(r => [r.horseId, Number(r.prizeWon)]));
}

describe('horse earnings from show settlement (Equoria-xal4m)', () => {
  it('adds each placed horse its prize, on top of what it had already earned', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee: ENTRY_FEE, entrantCount: 4 });
    const earlier = 250;
    await prisma.horse.update({ where: { id: show.entrants[0].horse.id }, data: { totalEarnings: earlier } });

    await executeClosedShows({ body: { showIds: [show.showId] } }, null);

    const prizes = await prizeByHorse(show.showId);
    expect(prizes.size).toBe(4);
    for (const [index, entrant] of show.entrants.entries()) {
      const start = index === 0 ? earlier : 0;
      expect(await earningsOf(entrant.horse.id)).toBe(start + prizes.get(entrant.horse.id));
    }
    // Placed horses earned the whole prize between them; the 4th earned nothing.
    expect([...prizes.values()].filter(p => p > 0)).toHaveLength(3);
    expect([...prizes.values()].reduce((s, p) => s + p, 0)).toBe(PRIZE);
  }, 60000);

  it('two executors racing for one show add the earnings once', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee: ENTRY_FEE, entrantCount: 3 });

    await Promise.all([
      executeClosedShows({ body: { showIds: [show.showId] } }, null),
      executeClosedShows({ body: { showIds: [show.showId] } }, null),
    ]);

    const prizes = await prizeByHorse(show.showId);
    expect(prizes.size).toBe(3);
    for (const entrant of show.entrants) {
      expect(await earningsOf(entrant.horse.id)).toBe(prizes.get(entrant.horse.id));
    }
    const total = await prisma.horse.aggregate({
      where: { id: { in: show.entrants.map(e => e.horse.id) } },
      _sum: { totalEarnings: true },
    });
    expect(total._sum.totalEarnings).toBe(PRIZE);
  }, 60000);
});
