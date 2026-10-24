/**
 * Monthly leaderboard totals follow settlement, exactly once (Equoria-y3nia).
 *
 * Owner ruling q42 (2026-10-23): the totals are updated as shows settle, inside
 * the settlement transaction. A settlement that two executors race for counts
 * once; the backfill fills history idempotently.
 *
 * Real DB, real settlement service, scoped fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';
import { gameMonthKey } from '../../../utils/gameTime.mjs';
import { backfillLeaderboardMonthlyTotals } from '../../../scripts/backfillLeaderboardMonthlyTotals.mjs';

const fx = createFundedShowFixtures('TestFixture-LBMonthly');
const month = gameMonthKey();
const extraHorseIds = [];

afterAll(async () => {
  await prisma.horseMonthlyTotal.deleteMany({ where: { horseId: { in: extraHorseIds } } });
  await fx.cleanup();
}, 60000);

const playerTotals = async playerId =>
  Object.fromEntries(
    (await prisma.playerMonthlyTotal.findMany({ where: { playerId, month } })).map(r => [r.category, r.value]),
  );
const horseTotals = async horseId =>
  Object.fromEntries(
    (await prisma.horseMonthlyTotal.findMany({ where: { horseId, month } })).map(r => [r.category, r.value]),
  );

async function expectTotalsMatchResults(show) {
  const results = await prisma.competitionResult.findMany({ where: { showId: show.showId } });
  expect(results).toHaveLength(show.entrants.length);
  for (const entrant of show.entrants) {
    const result = results.find(r => r.horseId === entrant.horse.id);
    const win = result.placement === 1 ? 1 : 0;
    const prize = Number(result.prizeWon);
    const horse = await horseTotals(entrant.horse.id);
    expect(horse.shows).toBe(1);
    expect(horse.wins ?? 0).toBe(win);
    expect(horse.earnings ?? 0).toBe(prize);
    expect(horse['disciplineWins:Dressage'] ?? 0).toBe(win);
    expect(horse.points).toBe(result.horsePointsAwarded);
    const player = await playerTotals(entrant.owner.id);
    expect(player.shows).toBe(1);
    expect(player.wins ?? 0).toBe(win);
    expect(player.earnings ?? 0).toBe(prize);
    // Owner xp is paid to the top three only, and counted with it.
    const xp = await prisma.xpEvent.aggregate({
      where: { userId: entrant.owner.id },
      _sum: { amount: true },
    });
    expect(player.xp ?? 0).toBe(xp._sum.amount ?? 0);
  }
}

describe('settlement updates the monthly totals (Equoria-y3nia)', () => {
  it('counts every entrant once, in the current Eastern game month', async () => {
    const show = await fx.buildClosedShow({ prize: 1000, entryFee: 20, entrantCount: 4 });
    await executeClosedShows({ body: { showIds: [show.showId] } }, null);
    await expectTotalsMatchResults(show);
    const winner = await prisma.competitionResult.findFirst({ where: { showId: show.showId, placement: 1 } });
    expect((await horseTotals(winner.horseId)).wins).toBe(1);
  }, 60000);

  it('two executors racing for one show count it once', async () => {
    const show = await fx.buildClosedShow({ prize: 1000, entryFee: 20, entrantCount: 3 });
    await Promise.all([
      executeClosedShows({ body: { showIds: [show.showId] } }, null),
      executeClosedShows({ body: { showIds: [show.showId] } }, null),
    ]);
    await expectTotalsMatchResults(show);
  }, 60000);

  it('a settlement that is run again counts nothing more', async () => {
    const show = await fx.buildClosedShow({ prize: 1000, entryFee: 20, entrantCount: 3 });
    await executeClosedShows({ body: { showIds: [show.showId] } }, null);
    await executeClosedShows({ body: { showIds: [show.showId] } }, null);
    await expectTotalsMatchResults(show);
  }, 60000);
});

describe('backfillLeaderboardMonthlyTotals', () => {
  it('fills history by Eastern game month, idempotently, and a dry run writes nothing', async () => {
    const show = await fx.buildClosedShow({ prize: 1000, entryFee: 20, entrantCount: 3 });
    await executeClosedShows({ body: { showIds: [show.showId] } }, null);
    const userIds = show.entrants.map(e => e.owner.id);
    const horseIds = show.entrants.map(e => e.horse.id);
    extraHorseIds.push(...horseIds);

    // Move the show's results to two different game months, either side of
    // midnight Eastern on 2027-01-01 (05:00Z), and forget the live totals.
    const [first, second] = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      orderBy: { id: 'asc' },
    });
    await prisma.competitionResult.update({
      where: { id: first.id },
      data: { runDate: new Date('2027-01-01T04:59:59Z') },
    });
    await prisma.competitionResult.update({
      where: { id: second.id },
      data: { runDate: new Date('2027-01-01T05:00:00Z') },
    });
    await prisma.horseMonthlyTotal.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.playerMonthlyTotal.deleteMany({ where: { playerId: { in: userIds } } });

    const dry = await backfillLeaderboardMonthlyTotals({ dryRun: true, userIds });
    expect(dry.pending.horses).toBeGreaterThan(0);
    expect(dry.written).toEqual({ players: 0, horses: 0 });
    expect(await prisma.horseMonthlyTotal.count({ where: { horseId: { in: horseIds } } })).toBe(0);

    const applied = await backfillLeaderboardMonthlyTotals({ dryRun: false, userIds });
    expect(applied.written.horses).toBe(dry.pending.horses);
    expect(applied.written.players).toBe(dry.pending.players);

    const monthOf = async horseId =>
      (await prisma.horseMonthlyTotal.findMany({ where: { horseId, category: 'shows' } })).map(r => r.month);
    expect(await monthOf(first.horseId)).toEqual(['2026-12']);
    expect(await monthOf(second.horseId)).toEqual(['2027-01']);
    const secondTotals = await prisma.horseMonthlyTotal.findMany({ where: { horseId: second.horseId } });
    const valueOf = category => secondTotals.find(r => r.category === category)?.value ?? 0;
    expect(valueOf('wins')).toBe(second.placement === 1 ? 1 : 0);
    expect(valueOf('earnings')).toBe(Number(second.prizeWon));
    // Points follow the XP event's own date (now), not the moved result.
    const points = await prisma.horseMonthlyTotal.findMany({
      where: { horseId: second.horseId, category: 'points' },
    });
    expect(points.map(r => [r.month, r.value])).toEqual([[month, second.horsePointsAwarded]]);

    const again = await backfillLeaderboardMonthlyTotals({ dryRun: false, userIds });
    expect(again.pending).toEqual({ players: 0, horses: 0 });
    expect(again.written).toEqual({ players: 0, horses: 0 });
  }, 60000);
});
