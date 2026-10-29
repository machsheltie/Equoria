/**
 * A sold horse's past results stay with the player who entered them
 * (Equoria-r9q06, audit COMP-23).
 *
 * The defect: player records (competition stats, prize history, My Results)
 * selected results by the horse's CURRENT owner, so selling a horse moved its
 * past wins onto the buyer's record and off the seller's. Owner ruling q256
 * (2026-10-28): the player who entered the show keeps those wins in their
 * totals; the buyer's record must not gain them.
 *
 * Real DB, real controllers (show created, entered and settled through the
 * production paths), scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../modules/competition/shows/showExecutionService.mjs';
import { createFundedShowFixtures } from '../modules/competition/__tests__/helpers/fundedShowFixtures.mjs';
import { computeUserCompetitionStats } from '../modules/users/services/userStatsService.mjs';
import { getUserPrizeHistory } from '../modules/users/services/userPrizeHistoryService.mjs';
import { getResultsByUser } from '../modules/competition/services/resultModelService.mjs';

const PRIZE = 1000;
const entryFee = PRIZE / 10;
const fx = createFundedShowFixtures('TestFixture-r9q06');

let seller;
let buyer;
let soldHorse;
let showId;

beforeAll(async () => {
  const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 1 });
  showId = show.showId;
  seller = show.entrants[0].owner;
  soldHorse = show.entrants[0].horse;
  await executeClosedShows({ body: { showIds: [showId] } }, null);
  buyer = await fx.makeUser(0, 'buyer');
  // The sale: the horse changes hands after the show has settled.
  await prisma.horse.update({ where: { id: soldHorse.id }, data: { userId: buyer.id } });
}, 120000);

afterAll(() => fx.cleanup(), 60000);

describe('a sold horse keeps its past results on the entrant’s record (Equoria-r9q06)', () => {
  it('records the entering player on the result', async () => {
    const row = await prisma.competitionResult.findFirst({
      where: { showId, horseId: soldHorse.id },
      select: { entrantUserId: true, placement: true },
    });
    expect(row).toEqual({ entrantUserId: seller.id, placement: 1 });
  });

  it("competition stats: the seller keeps the win; the buyer's record gains nothing", async () => {
    const sellerStats = await computeUserCompetitionStats(seller.id);
    expect(sellerStats.totalCompetitions).toBe(1);
    expect(sellerStats.totalWins).toBe(1);
    // A lone entrant wins half the prize (50/30/20); the rest returns to the host.
    expect(sellerStats.totalPrizeMoney).toBe(PRIZE / 2);

    const buyerStats = await computeUserCompetitionStats(buyer.id);
    expect(buyerStats.totalCompetitions).toBe(0);
    expect(buyerStats.totalWins).toBe(0);
    expect(buyerStats.totalPrizeMoney).toBe(0);
  });

  it('prize history and My Results follow the entrant, not the new owner', async () => {
    const sellerHistory = await getUserPrizeHistory(seller.id, { limit: 10, offset: 0 });
    expect(sellerHistory.total).toBe(1);
    expect((await getUserPrizeHistory(buyer.id, { limit: 10, offset: 0 })).total).toBe(0);

    expect((await getResultsByUser(seller.id)).map(r => r.showId)).toEqual([showId]);
    expect(await getResultsByUser(buyer.id)).toEqual([]);
  });
});
