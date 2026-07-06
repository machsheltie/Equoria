/**
 * addXpToUserAtomicity.integration.test.mjs
 *
 * Sentinel-positive real-DB coverage for Equoria-jvi3u.
 *
 * DEFECT (pre-fix): userModelService.addXpToUser read the user row, computed
 * `xp += amount` and level-ups in JS, then wrote ABSOLUTE values
 * `user.update({ data: { xp, level } })`. The XpEvent audit row was written
 * SEPARATELY by the caller (competition/training controllers via logXpEvent),
 * un-transacted. Two failure modes:
 *   1. Lost update — two concurrent awards to the same user (executeClosedShows
 *      pays owners via Promise.all; a competition payout + a training completion
 *      landing together) both read the same base xp; last writer wins; one award
 *      is silently lost. A stale writer could also REGRESS level.
 *   2. Audit drift — User.xp and SUM(XpEvent.amount) were maintained by two
 *      independent statements; a crash between them left them disagreeing.
 *
 * FIX (Equoria-jvi3u, per the oey96.4 show-xp-award architecture §4.2): a
 * tx-aware core addXpToUserCore(db, userId, amount, reason) —
 *   db.user.update({ xp: { increment: amount } })   (returns the new xp)
 *   -> targetLevel = max(1, floor(newXp / 100))  (derived from the RETURNED value)
 *   -> db.user.updateMany({ where: { id, level: { lt: target } }, data: { level: target } })
 *      (CONDITIONAL — a stale concurrent writer can never LOWER the level)
 *   -> db.xpEvent.create(...)                        (same client / same tx)
 * The public addXpToUser(userId, amount, reason='XP award') wraps the core in
 * one prisma.$transaction. The row lock from the increment serializes competing
 * awards (none lost); the audit row commits or rolls back together with the XP
 * write (User.xp == SUM(XpEvent.amount) always holds).
 *
 * INVARIANTS asserted:
 *   - User.xp == base + SUM(award amounts) (no lost updates under concurrency).
 *   - User.xp == SUM(XpEvent.amount) when all xp came from awards.
 *   - User.level is monotone non-decreasing and equals max(1, floor(xp/100)).
 *   - A failure at the audit-create boundary rolls the XP write back (atomicity).
 *
 * Real DB only, no mocks, no bypass headers. Fixtures are TestFixture- named;
 * cleanup is id-scoped + fail-loud (xp_events cascade-delete with the user per
 * schema onDelete: Cascade). CLAUDE.md §2/§3.
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { addXpToUser } from '../services/userModelService.mjs';

const CONCURRENCY = 10;
const XP_EACH = 5; // 10 x 5 = 50

// A NUL character (char code 0), built at runtime so the SOURCE file contains no
// literal NUL byte. It is a valid JS string that passes addXpToUser's reason
// validation, but Postgres text columns reject NUL, so xpEvent.create throws at
// the DB boundary while the xp increment would otherwise apply — the exact
// injection needed to prove the audit row is inside the transaction.
const NUL_CHAR = String.fromCharCode(0);

const createdUserIds = [];

async function makeUser(xp) {
  const uniq = randomBytes(8).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `testfixture-jvi3u-${uniq}@test.com`,
      username: `TestFixturejvi3u${uniq}`,
      password: 'irrelevant-hash',
      firstName: 'Jvi3u',
      lastName: 'Tester',
      money: 1000,
      xp, // level is left at its default (1); max(1, floor(xp/100)) is the invariant
    },
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  // xp_events cascade-delete with the user (onDelete: Cascade), but delete them
  // first anyway for an explicit, id-scoped, fail-loud teardown. CLAUDE.md §2.
  if (createdUserIds.length > 0) {
    await prisma.xpEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}, 120000);

describe('INTEGRATION: addXpToUser atomic XP award (Equoria-jvi3u)', () => {
  it('SENTINEL: concurrent awards do not lose updates and keep xp == SUM(events)', async () => {
    const user = await makeUser(0);

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => addXpToUser(user.id, XP_EACH, 'TestFixture-jvi3u-concurrent')),
    );

    // Every award must succeed.
    expect(results.every(r => r.success)).toBe(true);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { xp: true, level: true },
    });
    const events = await prisma.xpEvent.findMany({ where: { userId: user.id } });
    const eventSum = events.reduce((sum, e) => sum + e.amount, 0);

    // XP conservation: all N increments applied (pre-fix: last-writer-wins loses most).
    expect(after.xp).toBe(CONCURRENCY * XP_EACH); // 50
    // Level stays 1 (max(1, floor(50/100)) == 1).
    expect(after.level).toBe(1);
    // Audit consistency: one event per award, and xp == SUM(events) (base was 0).
    expect(events.length).toBe(CONCURRENCY); // 10
    expect(eventSum).toBe(CONCURRENCY * XP_EACH); // 50
    expect(after.xp).toBe(eventSum);
  }, 120000);

  it('SENTINEL: concurrent awards raise level exactly once when crossing a threshold', async () => {
    // Base xp 195 -> level 1 (max(1, floor(195/100)) == 1). +50 -> 245 -> level 2.
    const user = await makeUser(195);

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => addXpToUser(user.id, XP_EACH, 'TestFixture-jvi3u-levelup')),
    );
    expect(results.every(r => r.success)).toBe(true);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { xp: true, level: true },
    });
    const events = await prisma.xpEvent.findMany({ where: { userId: user.id } });

    expect(after.xp).toBe(195 + CONCURRENCY * XP_EACH); // 245
    // Threshold crossed exactly once: 195 (L1) -> 245 (L2). Never over/under-shoots.
    expect(after.level).toBe(2);
    expect(events.length).toBe(CONCURRENCY); // 10
    // Exactly one award reports the level-up.
    expect(results.filter(r => r.leveledUp).length).toBe(1);
    expect(results.reduce((sum, r) => sum + (r.levelsGained || 0), 0)).toBe(1);
  }, 120000);

  it('SENTINEL: a failure at the audit-create boundary rolls back the XP write (atomicity)', async () => {
    const user = await makeUser(0);

    const result = await addXpToUser(user.id, XP_EACH, `bad${NUL_CHAR}reason`);

    expect(result.success).toBe(false);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { xp: true },
    });
    const events = await prisma.xpEvent.findMany({ where: { userId: user.id } });

    // The XP write must NOT have leaked through (pre-fix: xp === 5, drift).
    expect(after.xp).toBe(0);
    // No partial audit row.
    expect(events.length).toBe(0);
  }, 120000);

  it('happy path preserved: a single award increments xp, crosses the level threshold, writes one event with the reason', async () => {
    // 195 (L1) -> 205 (L2): the sole level-1 span is xp 0..199, so this crosses.
    const user = await makeUser(195);

    const result = await addXpToUser(user.id, 10, 'TestFixture-jvi3u-single');

    expect(result.success).toBe(true);
    expect(result.currentXP).toBe(205);
    expect(result.currentLevel).toBe(2);
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(1);
    expect(result.xpGained).toBe(10);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { xp: true, level: true },
    });
    expect(after.xp).toBe(205);
    expect(after.level).toBe(2);

    const events = await prisma.xpEvent.findMany({ where: { userId: user.id } });
    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(10);
    expect(events[0].reason).toBe('TestFixture-jvi3u-single');
  }, 120000);

  it('two-arg backward-compat call still writes an audit event with the default reason', async () => {
    const user = await makeUser(0);

    const result = await addXpToUser(user.id, XP_EACH); // no reason arg

    expect(result.success).toBe(true);
    const events = await prisma.xpEvent.findMany({ where: { userId: user.id } });
    expect(events.length).toBe(1);
    expect(events[0].amount).toBe(XP_EACH);
    expect(events[0].reason).toBe('XP award');
  }, 120000);
});
