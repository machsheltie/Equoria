/**
 * addXpToHorseAtomicity.integration.test.mjs
 *
 * Sentinel-positive real-DB coverage for Equoria-geo1a.
 *
 * DEFECT (pre-fix): horseXpModelService.addXpToHorse read horseXp/availableStat-
 * Points, computed new ABSOLUTE values in JS, wrote them back unconditionally, then
 * created the horseXpEvent audit row in a SECOND, un-transacted statement. Two
 * failure modes:
 *   1. Lost update — two concurrent XP awards to the same horse (executeClosedShows
 *      pays entries via Promise.all) both read the same base; last writer wins; XP
 *      and derived stat points are silently lost.
 *   2. Audit drift — a crash between the two statements leaves horseXp changed with
 *      no HorseXpEvent row (or vice-versa), so Horse.horseXp stops equaling
 *      SUM(HorseXpEvent.amount).
 *
 * FIX: a single $transaction of RELATIVE increments —
 *   tx.horse.update({ horseXp: { increment: amount } })  (returns the new value)
 *   -> statPointsGained = calc(newXp) - calc(newXp - amount)
 *   -> tx.horse.update({ availableStatPoints: { increment: statPointsGained } })
 *   -> tx.horseXpEvent.create(...)  (same tx)
 * The row lock from the first UPDATE serializes competing awards (no lost update);
 * the audit row commits or rolls back together with the XP write (no drift).
 *
 * INVARIANTS asserted:
 *   - Horse.horseXp == SUM(HorseXpEvent.amount) for the horse.
 *   - Stat points gained == earned(newXp) - earned(oldXp), summed exactly once
 *     across concurrent awards (threshold crossed exactly once).
 *   - A failure at the audit-create boundary rolls the XP write back (atomicity).
 *
 * Real DB only, no mocks, no bypass headers. Fixtures are TestFixture- named;
 * cleanup is id-scoped + fail-loud (horseXpEvent rows cascade-delete with the
 * horse per schema onDelete: Cascade). CLAUDE.md §2/§3.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { addXpToHorse } from '../services/horseXpModelService.mjs';

const CONCURRENCY = 10;
const XP_EACH = 15; // 10 x 15 = 150 -> crosses the 100-XP stat-point threshold once

// A NUL character (char code 0), built at runtime so the SOURCE file contains no
// literal NUL byte. It is a valid JS string that passes addXpToHorse's reason
// validation, but Postgres text columns reject NUL, so horseXpEvent.create throws
// at the DB boundary while the horseXp increment would otherwise apply — the exact
// injection needed to prove the audit row is inside the transaction.
const NUL_CHAR = String.fromCharCode(0);

let ownerId;
const createdHorseIds = [];

async function makeHorse(horseXp, availableStatPoints) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-geo1a-horse-${randomBytes(8).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      age: 5,
      userId: ownerId,
      horseXp,
      availableStatPoints,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  const uniq = randomBytes(8).toString('hex');
  const owner = await prisma.user.create({
    data: {
      email: `testfixture-geo1a-${uniq}@test.com`,
      username: `TestFixturegeo1a${uniq}`,
      password: 'irrelevant-hash',
      firstName: 'Geo1a',
      lastName: 'Tester',
      money: 1000,
    },
  });
  ownerId = owner.id;
}, 120000);

afterAll(async () => {
  // FK order: Horse.userId is onDelete:Restrict — delete horses BEFORE the user.
  // horse_xp_events cascade-delete with the horse. id-scoped, fail-loud.
  if (createdHorseIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  if (ownerId) {
    await prisma.user.deleteMany({ where: { id: ownerId } });
  }
}, 120000);

describe('INTEGRATION: addXpToHorse atomic XP award (Equoria-geo1a)', () => {
  it('SENTINEL: concurrent XP awards do not lose updates and keep horseXp == SUM(events)', async () => {
    const horse = await makeHorse(0, 0);

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => addXpToHorse(horse.id, XP_EACH, 'TestFixture-geo1a-concurrent')),
    );

    // Every award must succeed.
    expect(results.every(r => r.success)).toBe(true);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, availableStatPoints: true },
    });

    const events = await prisma.horseXpEvent.findMany({ where: { horseId: horse.id } });
    const eventSum = events.reduce((sum, e) => sum + e.amount, 0);

    // XP conservation: all N increments applied (pre-fix: last-writer-wins loses most).
    expect(after.horseXp).toBe(CONCURRENCY * XP_EACH); // 150
    // Audit consistency: one event per award, and horseXp == SUM(events) (base was 0).
    expect(events.length).toBe(CONCURRENCY); // 10
    expect(eventSum).toBe(CONCURRENCY * XP_EACH); // 150
    expect(after.horseXp).toBe(eventSum);
    // Stat-point conservation: 0 -> 150 crosses the 100 threshold exactly once.
    expect(after.availableStatPoints).toBe(1);
  }, 120000);

  it('SENTINEL: a failure at the audit-create boundary rolls back the XP write (atomicity)', async () => {
    const horse = await makeHorse(0, 0);

    const result = await addXpToHorse(horse.id, 5, `bad${NUL_CHAR}reason`);

    expect(result.success).toBe(false);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true },
    });
    const events = await prisma.horseXpEvent.findMany({ where: { horseId: horse.id } });

    // The XP write must NOT have leaked through (pre-fix: horseXp === 5, drift).
    expect(after.horseXp).toBe(0);
    // No partial audit row.
    expect(events.length).toBe(0);
  }, 120000);

  it('happy path preserved: a single award increments XP, gains the threshold point, and writes one event', async () => {
    const horse = await makeHorse(95, 0);

    const result = await addXpToHorse(horse.id, 10, 'TestFixture-geo1a-single');

    expect(result.success).toBe(true);
    expect(result.currentXP).toBe(105);
    expect(result.xpGained).toBe(10);
    expect(result.statPointsGained).toBe(1); // 95 -> 105 crosses 100
    expect(result.availableStatPoints).toBe(1);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, availableStatPoints: true },
    });
    expect(after.horseXp).toBe(105);
    expect(after.availableStatPoints).toBe(1);

    const events = await prisma.horseXpEvent.findMany({ where: { horseId: horse.id } });
    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(10);
  }, 120000);
});
