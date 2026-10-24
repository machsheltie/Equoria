/**
 * A tie at the nightly show is settled by a luck re-roll, never shared
 * (Equoria-bvddn.22; owner ruling 2026-10-22).
 *
 * Three identical horses (same stats, same rider, no temperament) scored with a
 * fixed luck seam all score the same. Before the ruling the executor ranked
 * them by a stable sort over entries read with no ORDER BY, so their placings
 * were whatever order the database returned. Now the tied horses re-roll the
 * luck roll (in horseId order, so the injected rng decides): the placings are
 * strict 1/2/3, the 50/30/20 prizes are paid unsplit, and each result keeps
 * the score the horses tied on.
 *
 * Real DB, real controllers, scoped fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';

const prizePool = 1000;
const fee = prizePool / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23, Equoria-v0ys3)
const fx = createFundedShowFixtures('TestFixture-bvddn22');

afterAll(() => fx.cleanup(), 60000);

/**
 * Scoring takes one luck roll per entrant (all 0 here, so every horse gets the
 * same +1%); the tie re-roll then takes one roll per tied horse.
 */
function scoreThenRerolls(entrants, rerolls) {
  const queue = [...Array(entrants).fill(0), ...rerolls];
  return () => (queue.length > 0 ? queue.shift() : 0.5);
}

describe('a tied show (Equoria-bvddn.22)', () => {
  it('places tied horses by a luck re-roll: strict placings, unsplit prizes, the tied score kept', async () => {
    const show = await fx.buildClosedShow({ prize: prizePool, entryFee: fee, entrantCount: 3 });
    const [low, mid, high] = [...show.entrants].sort((a, b) => a.horse.id - b.horse.id);
    // Re-rolls in horseId order: low 2%, mid 10%, high 6% -> mid, high, low.
    const scoreRng = scoreThenRerolls(3, [0.15, 0.95, 0.55]);

    await executeClosedShows({ body: { showIds: [show.showId] } }, null, { scoreRng });

    const results = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      select: { horseId: true, placement: true, prizeWon: true, score: true },
    });
    const byHorse = new Map(results.map(r => [r.horseId, r]));
    expect(byHorse.get(mid.horse.id).placement).toBe(1);
    expect(byHorse.get(high.horse.id).placement).toBe(2);
    expect(byHorse.get(low.horse.id).placement).toBe(3);
    expect(new Set(results.map(r => Number(r.score))).size).toBe(1);

    expect(Number(byHorse.get(mid.horse.id).prizeWon)).toBe(500);
    expect(Number(byHorse.get(high.horse.id).prizeWon)).toBe(300);
    expect(Number(byHorse.get(low.horse.id).prizeWon)).toBe(200);
    expect(await moneyOf(mid.owner.id)).toBe(500);
    expect(await moneyOf(high.owner.id)).toBe(300);
    expect(await moneyOf(low.owner.id)).toBe(200);
  }, 60000);
});
