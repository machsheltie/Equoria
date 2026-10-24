/**
 * A show that settled only in part is finished by the next run, and nobody is
 * paid twice (Equoria-cmw85.2).
 *
 * The defect: when an entry's settlement transaction fails, the show is already
 * 'completed' (Equoria-koodu claim-then-process) and the nightly scan only
 * matches 'open' shows, so the entrant who placed never received a result row
 * or a prize and nothing ever came back for it. 'completed' while the show
 * still holds its stagedOrdering is the record of exactly that.
 *
 * The failure is real, not mocked: one horse's lifetime winnings are set to the
 * top of the Int range, so the `totalEarnings: { increment: prize }` leg of that
 * entrant's settlement transaction overflows inside Postgres and the whole
 * transaction (result row, prize, progression) rolls back. Restoring the
 * column is the "fix the cause" step before the re-run.
 *
 * Real DB, real controllers (createShow / enterShow fund the escrow), scoped
 * fixtures. Conservation is asserted over suite-owned wallets plus the show's
 * own escrow columns.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { findPartiallySettledShowIds } from '../shows/showSettlementRecovery.mjs';
import { createFundedShowFixtures, moneyOf } from './helpers/fundedShowFixtures.mjs';

const PRIZE = 1000;
const entryFee = PRIZE / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23, Equoria-v0ys3)
const intMax = 2147483647;

const fx = createFundedShowFixtures('TestFixture-cmw852');

afterAll(() => fx.cleanup(), 60000);

async function setEarnings(horseId, totalEarnings) {
  await prisma.horse.update({ where: { id: horseId }, data: { totalEarnings } });
}

/** Let the run that left a show half-settled be an hour old: the grace period has passed. */
async function letGracePass(showId) {
  await prisma.show.update({
    where: { id: showId },
    data: { executedAt: new Date(Date.now() - 60 * 60 * 1000) },
  });
}

async function run(showIds) {
  try {
    await executeClosedShows({ body: { showIds } }, null);
    return null;
  } catch (error) {
    return error;
  }
}

async function stagedOrderingIsSet(showId) {
  const rows = await prisma.$queryRaw`
    SELECT ("stagedOrdering" IS NOT NULL) AS "isSet" FROM "shows" WHERE "id" = ${showId}`;
  return rows[0].isSet;
}

/** Entrants with the result row they received, keyed by horse id. */
async function resultsByHorse(showId) {
  const rows = await prisma.competitionResult.findMany({
    where: { showId },
    select: { horseId: true, prizeWon: true, placement: true },
  });
  return new Map(rows.map(r => [r.horseId, r]));
}

describe('re-running a partially settled show (Equoria-cmw85.2)', () => {
  it('pays the missed placing exactly once, leaves the paid entrants alone, and conserves money', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    const poisoned = show.entrants[1];
    await setEarnings(poisoned.horse.id, intMax);
    const heldBefore = await fx.heldMoney(show);

    // First run: the poisoned entrant's settlement rolls back; the others settle.
    const error = await run([show.showId]);
    expect(error).not.toBeNull();
    const afterFirst = await resultsByHorse(show.showId);
    expect(afterFirst.size).toBe(2);
    expect(afterFirst.has(poisoned.horse.id)).toBe(false);
    expect((await prisma.show.findUnique({ where: { id: show.showId } })).status).toBe('completed');
    expect(await stagedOrderingIsSet(show.showId)).toBe(true);
    expect(await moneyOf(poisoned.owner.id)).toBe(0);
    const paidOwners = show.entrants.filter(e => e !== poisoned);
    const walletsAfterFirst = await Promise.all(paidOwners.map(e => moneyOf(e.owner.id)));

    // The cause is fixed; the next run, once the grace period has passed, finishes the show.
    await setEarnings(poisoned.horse.id, 0);
    await letGracePass(show.showId);
    expect(await run([show.showId])).toBeNull();

    const afterSecond = await resultsByHorse(show.showId);
    expect(afterSecond.size).toBe(3);
    const missed = afterSecond.get(poisoned.horse.id);
    expect(await moneyOf(poisoned.owner.id)).toBe(Number(missed.prizeWon));
    expect(Number(missed.prizeWon)).toBeGreaterThan(0);

    // The two entrants who were already paid are not paid again, and their
    // result rows are the ones the first run wrote.
    expect(await Promise.all(paidOwners.map(e => moneyOf(e.owner.id)))).toEqual(walletsAfterFirst);
    for (const e of paidOwners) {
      expect(afterSecond.get(e.horse.id).placement).toBe(afterFirst.get(e.horse.id).placement);
    }

    // The three placings paid the whole prize; the escrow is empty; the creator
    // got the fees once; the show is fully settled; no money appeared or vanished.
    const settled = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(settled.status).toBe('completed');
    expect(settled.prizeEscrow).toBe(0);
    expect(settled.feeEscrow).toBe(0);
    expect([...afterSecond.values()].reduce((s, r) => s + Number(r.prizeWon), 0)).toBe(PRIZE);
    expect(await moneyOf(show.creator.id)).toBe(entryFee * 3);
    expect(await stagedOrderingIsSet(show.showId)).toBe(false);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
    const horse = await prisma.horse.findUnique({
      where: { id: poisoned.horse.id },
      select: { totalEarnings: true },
    });
    expect(horse.totalEarnings).toBe(Number(missed.prizeWon));

    // A third run has nothing left to do.
    expect(await run([show.showId])).toBeNull();
    expect(await prisma.competitionResult.count({ where: { showId: show.showId } })).toBe(3);
    expect(await Promise.all(paidOwners.map(e => moneyOf(e.owner.id)))).toEqual(walletsAfterFirst);
    expect(await moneyOf(poisoned.owner.id)).toBe(Number(missed.prizeWon));
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 90000);

  it('returns the unpaid share to the creator once, when the failed entry was the winner of a two-horse show', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 2 });
    // Poison both so whichever places first fails; heal and re-run to see the
    // winner's leg (which carries the unpaid-share refund) settle exactly once.
    for (const e of show.entrants) {
      await setEarnings(e.horse.id, intMax);
    }
    const heldBefore = await fx.heldMoney(show);

    expect(await run([show.showId])).not.toBeNull();
    expect(await prisma.competitionResult.count({ where: { showId: show.showId } })).toBe(0);

    // Heal only the SECOND placing's horse and run: it settles, the winner's
    // does not, so the winner's leg (and the refund it carries) is pending.
    const staged = await prisma.$queryRaw`
      SELECT "stagedOrdering" AS so FROM "shows" WHERE "id" = ${show.showId}`;
    const ordering = staged[0].so;
    const winnerHorseId = ordering.find(s => s.placement === 1).horseId;
    const secondHorseId = ordering.find(s => s.placement === 2).horseId;
    await setEarnings(secondHorseId, 0);
    await letGracePass(show.showId);
    expect(await run([show.showId])).not.toBeNull();
    expect((await resultsByHorse(show.showId)).size).toBe(1);

    await setEarnings(winnerHorseId, 0);
    await letGracePass(show.showId);
    expect(await run([show.showId])).toBeNull();

    const results = await resultsByHorse(show.showId);
    expect(results.size).toBe(2);
    const settled = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(settled.prizeEscrow).toBe(0);
    expect(settled.feeEscrow).toBe(0);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
    // Two entrants: placed shares 50% and 30%; the other 20% went back to the
    // creator, once, together with the entry fees.
    const placed = [...results.values()].reduce((s, r) => s + Number(r.prizeWon), 0);
    expect(placed).toBe(PRIZE * 0.5 + PRIZE * 0.3);
    expect(await moneyOf(show.creator.id)).toBe(PRIZE - placed + entryFee * 2);
  }, 90000);

  it('never picks up a show whose payout finished (no stagedOrdering) or that is still open', async () => {
    const done = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    expect(await run([done.showId])).toBeNull();
    expect(await stagedOrderingIsSet(done.showId)).toBe(false);
    const open = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });

    const ids = await findPartiallySettledShowIds({
      now: new Date(Date.now() + 24 * 60 * 60 * 1000),
      showIds: null,
    });
    expect(ids).not.toContain(done.showId);
    expect(ids).not.toContain(open.showId);
  }, 90000);

  it('leaves a payout that may still be running alone until its grace period has passed', async () => {
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee, entrantCount: 3 });
    await setEarnings(show.entrants[0].horse.id, intMax);
    expect(await run([show.showId])).not.toBeNull(); // 'completed' with its stagedOrdering kept
    const now = new Date();

    // The run that left it half-settled finished just now: a scan must not
    // collide with a payout that could still be in flight.
    expect(await findPartiallySettledShowIds({ now, showIds: null })).not.toContain(show.showId);
    // Named explicitly (admin POST /shows/execute, a concurrent executor), the same.
    expect(await findPartiallySettledShowIds({ now, showIds: [show.showId] })).not.toContain(show.showId);
    // Once the grace has passed, a scan finds it, named or not.
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    expect(await findPartiallySettledShowIds({ now: later, showIds: null })).toContain(show.showId);
    expect(await findPartiallySettledShowIds({ now: later, showIds: [show.showId] })).toContain(show.showId);
  }, 90000);
});
