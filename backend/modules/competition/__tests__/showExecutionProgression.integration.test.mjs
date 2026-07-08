/**
 * showExecutionProgression.integration.test.mjs (Equoria-oey96.4)
 *
 * The overnight show executor (`executeClosedShows`) is the ONLY live
 * competition path (the legacy instant path is 410 Gone). Per audit finding
 * [P1-3] it created a competitionResult, paid prize money, awarded RIDER
 * XP/stats, and set the firstWin milestone — but awarded NO horse XP, NO user
 * XP, and NO stat gains. Competing therefore produced zero horse/owner
 * progression. This is the ATDD suite for the fix.
 *
 * Design: docs/architecture/show-xp-award-architecture.md §5.
 * All real-DB (CLAUDE.md §3, no mocks), TestFixture- fixtures via
 * createTestHorse, id-scoped fail-loud cleanup, execute runs ALWAYS scoped via
 * body.showIds so the shared canonical DB is never swept unscoped.
 *
 * Test classes:
 *   A. Awards happen — the red proof of the gap (deltas = 0 on master).
 *   B. Exactly-once under two concurrent executeClosedShows on scoped showIds.
 *   C. Atomicity — a planted P2002 on competitionResult.create rolls back the
 *      whole per-entry unit (no partial XP / money / stat award).
 *
 * PRD-03 §2.1 award table (pinned in competitionAwards.computePlacementAwards):
 *   1st -> horseXp 30, userXp 20, statChance 10%
 *   2nd -> horseXp 27, userXp 15, statChance  5%
 *   3rd -> horseXp 25, userXp 10, statChance  3%
 *   4th+-> horseXp 20, userXp  0, statChance  0%
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showController.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => `${randomBytes(6).toString('hex')}`;

// Expected horse-XP by numeric-string placement (the executor stores placement
// as a numeric string — "1"/"2"/"3"/"4"). Derived from the PRD table.
const HORSE_XP_BY_PLACEMENT = { 1: 30, 2: 27, 3: 25, 4: 20 };
const USER_XP_BY_PLACEMENT = { 1: 20, 2: 15, 3: 10, 4: 0 };

const cleanup = createCleanupTracker();

// Register scoped, dependency-ordered cleanup for a fixture set. Audit rows
// (XpEvent/HorseXpEvent) cascade on user/horse delete, but competitionResult /
// showEntry / riderAssignment must go before their parents.
function registerCleanup({ showIds = [], horseIds = [], userIds = [], riderIds = [] }) {
  if (showIds.length) {
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
  }
  if (horseIds.length) {
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds } } }), 'riderAssignment');
  }
  if (showIds.length) {
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  }
  if (riderIds.length) {
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
  }
  if (horseIds.length) {
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  }
  if (userIds.length) {
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  }
}

afterAll(() => cleanup.run(), 60000);

// Build a closeable show (closeDate in the past, status open, prizeEscrow left
// at its default 0 -> executor pays winners via the legacy direct-credit branch,
// which still runs `tx.user.money increment` INSIDE the per-entry tx, so the
// XP-with-money atomicity under test is exercised without needing to seed the
// SystemAccount escrow balance).
async function createCloseableShow({ creatorId, prize, tag }) {
  const pastClose = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.show.create({
    data: {
      name: `TestFixture-oey96.4-${tag}-${uid()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize,
      runDate: pastClose,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastClose,
      createdByUserId: creatorId,
    },
  });
}

describe('executeClosedShows progression awards (Equoria-oey96.4)', () => {
  // ── Class A — awards happen (RED on master: all deltas 0) ──────────────────
  it('A: awards horse XP (all entrants), user XP + stat roll (top-3), inside the tx; does not double-award rider XP', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `oey96.4-A-${uid()}@test.local`,
        username: `o4A${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Award',
        lastName: 'Owner',
        money: 0,
        // Start at 180 xp / level 1 so the +45 total user XP crosses the level
        // boundary (levelForXp(225) = 2) — a real level-up assertion, not a
        // stuck-at-1 no-op.
        xp: 180,
        level: 1,
      },
    });

    const horseIds = [];
    // Widely-separated base stats so ±9% luck cannot reorder placements:
    // avg 90 -> [81,99], 70 -> [61,79], 50 -> [41,59], 30 -> [21,39] (no overlap).
    const statBands = [90, 70, 50, 30];
    const horses = [];
    for (const band of statBands) {
      const h = await createTestHorse(
        prisma,
        {
          name: `TestFixture-oey96.4-A-${band}-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          healthStatus: 'healthy',
          speed: band,
          stamina: band,
          agility: band,
          balance: band,
          precision: band,
          boldness: band,
        },
        horseIds,
      );
      horses.push(h);
    }
    const topHorse = horses[0]; // stat band 90 -> deterministic 1st place

    // Elite rider on the top horse — only makes it score higher, so it stays
    // 1st (placement determinism preserved). Used for the no-double-award check.
    const rider = await prisma.rider.create({
      data: {
        firstName: 'TestFixture',
        lastName: `oey96.4-A-Rider-${uid()}`,
        personality: 'methodical',
        skillLevel: 'experienced',
        speciality: 'Dressage',
        level: 10,
        prestige: 100,
        userId: owner.id,
      },
    });
    await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: topHorse.id, userId: owner.id, isActive: true },
    });

    const show = await createCloseableShow({ creatorId: owner.id, prize: 1000, tag: 'A' });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id], riderIds: [rider.id] });

    await prisma.showEntry.createMany({
      data: horses.map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
    });

    // Baselines.
    const horseBaseline = new Map();
    for (const h of horses) {
      const row = await prisma.horse.findUnique({
        where: { id: h.id },
        select: { horseXp: true, precision: true },
      });
      horseBaseline.set(h.id, row);
    }
    const ownerBefore = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, xp: true, level: true },
    });
    const riderBefore = await prisma.rider.findUnique({
      where: { id: rider.id },
      select: { totalCompetitions: true, totalWins: true },
    });

    // Scoped execute — NEVER unscoped against the shared canonical DB.
    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    // Placement is derived from the recorded competitionResult rows (scores are
    // random) — assert against those, not an assumption.
    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true, prizeWon: true },
    });
    expect(results).toHaveLength(4);
    const placementByHorse = new Map(results.map(r => [r.horseId, Number(r.placement)]));
    // All four placements 1..4 present exactly once.
    expect([...placementByHorse.values()].sort()).toEqual([1, 2, 3, 4]);

    // (a) Horse XP: every entrant gains exactly the table value for its placement.
    for (const h of horses) {
      const placement = placementByHorse.get(h.id);
      const expectedXp = HORSE_XP_BY_PLACEMENT[placement];
      const after = await prisma.horse.findUnique({
        where: { id: h.id },
        select: { horseXp: true },
      });
      const delta = after.horseXp - horseBaseline.get(h.id).horseXp;
      expect(delta).toBe(expectedXp);

      // Matching HorseXpEvent audit row (horse is a fresh fixture, so any event
      // on it is from this run). Reason carries the ordinal.
      const events = await prisma.horseXpEvent.findMany({ where: { horseId: h.id } });
      expect(events).toHaveLength(1);
      expect(events[0].amount).toBe(expectedXp);
      expect(events[0].reason).toMatch(/place in Dressage$/);
    }

    // (b) User XP: owner gains 20+15+10+0 = 45; three XpEvent rows (top-3 only);
    //     level climbs 1 -> 2 (levelForXp(225) = 2).
    const ownerAfter = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, xp: true, level: true },
    });
    const expectedUserXp = USER_XP_BY_PLACEMENT[1] + USER_XP_BY_PLACEMENT[2] + USER_XP_BY_PLACEMENT[3];
    expect(ownerAfter.xp - ownerBefore.xp).toBe(expectedUserXp); // 45
    expect(ownerAfter.level).toBe(2);
    const ownerXpEvents = await prisma.xpEvent.findMany({ where: { userId: owner.id } });
    expect(ownerXpEvents).toHaveLength(3); // 4th place gets NO user XP -> no row
    expect(ownerXpEvents.reduce((s, e) => s + e.amount, 0)).toBe(expectedUserXp);

    // (c) Money leg still paid inside the same tx: 500 + 300 + 200 = 1000.
    expect(Number(ownerAfter.money) - Number(ownerBefore.money)).toBe(1000);

    // (d) Stat gain is a chance roll; it MUST NOT exceed +1 on a discipline stat
    //     and only the top-3 can gain (4th's chance is 0). Assert bounded, not
    //     fabricated: total precision increase across all horses is 0..3, and the
    //     4th-place horse never gains.
    let totalStatGain = 0;
    for (const h of horses) {
      const after = await prisma.horse.findUnique({ where: { id: h.id }, select: { precision: true } });
      const gain = after.precision - horseBaseline.get(h.id).precision;
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
      if (placementByHorse.get(h.id) === 4) {
        expect(gain).toBe(0);
      }
      totalStatGain += gain;
    }
    expect(totalStatGain).toBeLessThanOrEqual(3);

    // (e) Rider XP/stats not double-awarded: exactly one competition counted.
    const riderAfter = await prisma.rider.findUnique({
      where: { id: rider.id },
      select: { totalCompetitions: true, totalWins: true },
    });
    expect(riderAfter.totalCompetitions - riderBefore.totalCompetitions).toBe(1);
    expect(riderAfter.totalWins - riderBefore.totalWins).toBe(1); // top horse won
  }, 60000);

  // ── Class B — exactly-once under concurrent executors ──────────────────────
  it('B: two concurrent executeClosedShows award progression exactly once (claim is the mutex)', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `oey96.4-B-${uid()}@test.local`,
        username: `o4B${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Once',
        lastName: 'Owner',
        money: 0,
        xp: 0,
        level: 1,
      },
    });

    const horseIds = [];
    const horses = [];
    for (const band of [80, 40]) {
      const h = await createTestHorse(
        prisma,
        {
          name: `TestFixture-oey96.4-B-${band}-${uid()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: owner.id,
          healthStatus: 'healthy',
          speed: band,
          stamina: band,
          agility: band,
          balance: band,
          precision: band,
          boldness: band,
        },
        horseIds,
      );
      horses.push(h);
    }

    const show = await createCloseableShow({ creatorId: owner.id, prize: 0, tag: 'B' });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.showEntry.createMany({
      data: horses.map(h => ({ showId: show.id, horseId: h.id, userId: owner.id, feePaid: 0 })),
    });

    // Race two executor invocations scoped to the same show. The atomic
    // open->executing claim makes exactly one process it; XP inherits the mutex.
    await Promise.all([
      executeClosedShows({ body: { showIds: [show.id] } }, null),
      executeClosedShows({ body: { showIds: [show.id] } }, null),
    ]);

    // Exactly one set of result rows (the @@unique([showId,horseId]) + claim).
    const results = await prisma.competitionResult.findMany({
      where: { showId: show.id },
      select: { horseId: true, placement: true },
    });
    expect(results).toHaveLength(2);
    const placementByHorse = new Map(results.map(r => [r.horseId, Number(r.placement)]));

    // Each horse's XP delta equals its table value EXACTLY ONCE, and
    // SUM(HorseXpEvent) reconciles.
    for (const h of horses) {
      const placement = placementByHorse.get(h.id);
      const expectedXp = HORSE_XP_BY_PLACEMENT[placement];
      const after = await prisma.horse.findUnique({ where: { id: h.id }, select: { horseXp: true } });
      expect(after.horseXp).toBe(expectedXp); // fixture starts at 0
      const events = await prisma.horseXpEvent.findMany({ where: { horseId: h.id } });
      expect(events).toHaveLength(1);
      expect(events.reduce((s, e) => s + e.amount, 0)).toBe(expectedXp);
    }

    // Owner XP: 20 (1st) + 15 (2nd) = 35, exactly once; two XpEvent rows.
    const ownerAfter = await prisma.user.findUnique({ where: { id: owner.id }, select: { xp: true } });
    expect(ownerAfter.xp).toBe(35);
    const ownerXpEvents = await prisma.xpEvent.findMany({ where: { userId: owner.id } });
    expect(ownerXpEvents).toHaveLength(2);
    expect(ownerXpEvents.reduce((s, e) => s + e.amount, 0)).toBe(35);
  }, 60000);

  // ── Class C — atomicity: planted P2002 rolls back the WHOLE per-entry unit ──
  // A pre-inserted conflicting competitionResult for (showId, horseId) makes the
  // per-entry tx's competitionResult.create (the FIRST write) throw P2002, which
  // must roll back the ENTIRE unit — no partial horse XP, owner XP, stat, or money
  // award. This is the sentinel-positive for AC5 ("awards are INSIDE the tx"): if
  // the XP/stat writes were moved outside the tx (like the fail-soft rider XP),
  // the horse would still gain 30 XP despite the rollback and this test would fail.
  //
  // Single-entry show by design: multi-entry blast-radius + fee-escrow-settlement
  // reachability under a mid-Promise.all rejection is the SEPARATE Equoria-wmwbr
  // concern (the executor's `await Promise.all(resultOps)` rejects on the first
  // failing entry, and the remaining entries' txs are in-flight microtasks whose
  // completion order is nondeterministic). Asserting "others processed + escrow
  // settled" here would either flake or falsely green-light the wmwbr bug, so this
  // test is scoped strictly to the atomicity guarantee this issue owns.
  it('C: a planted P2002 on competitionResult.create rolls back XP, owner XP, stat, and money together', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `oey96.4-C-${uid()}@test.local`,
        username: `o4C${uid()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Atomic',
        lastName: 'Owner',
        money: 500,
        xp: 0,
        level: 1,
      },
    });

    const horseIds = [];
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-oey96.4-C-${uid()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: owner.id,
        healthStatus: 'healthy',
        speed: 80,
        stamina: 80,
        agility: 80,
        balance: 80,
        precision: 80,
        boldness: 80,
      },
      horseIds,
    );

    const show = await createCloseableShow({ creatorId: owner.id, prize: 1000, tag: 'C' });
    registerCleanup({ showIds: [show.id], horseIds, userIds: [owner.id] });
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: horse.id, userId: owner.id, feePaid: 0 },
    });

    // Plant the conflicting result BEFORE execution — the per-entry tx's
    // competitionResult.create will hit @@unique([showId,horseId]) -> P2002.
    await prisma.competitionResult.create({
      data: {
        score: 99,
        placement: '1',
        discipline: 'Dressage',
        runDate: new Date(),
        showName: show.name,
        prizeWon: 0,
        horseId: horse.id,
        showId: show.id,
      },
    });

    const before = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, precision: true, speed: true, stamina: true, agility: true },
    });
    const ownerBefore = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, xp: true, level: true },
    });

    // Execute — the entry tx aborts with P2002; executor swallows in its outer
    // catch (res=null). No throw escapes to the test.
    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    // Full rollback: no XP, no stat, no money — and no NEW result row.
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, precision: true, speed: true, stamina: true, agility: true },
    });
    expect(after.horseXp).toBe(before.horseXp); // no horse XP leaked
    expect(after.precision).toBe(before.precision); // no stat gain leaked
    expect(after.speed).toBe(before.speed);
    expect(after.stamina).toBe(before.stamina);
    expect(after.agility).toBe(before.agility);

    const horseEvents = await prisma.horseXpEvent.findMany({ where: { horseId: horse.id } });
    expect(horseEvents).toHaveLength(0); // no audit row
    const ownerEvents = await prisma.xpEvent.findMany({ where: { userId: owner.id } });
    expect(ownerEvents).toHaveLength(0);

    const ownerAfter = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, xp: true, level: true },
    });
    expect(Number(ownerAfter.money)).toBe(Number(ownerBefore.money)); // prize not paid
    expect(ownerAfter.xp).toBe(ownerBefore.xp); // no owner XP
    expect(ownerAfter.level).toBe(ownerBefore.level);

    // Only the planted row exists (no duplicate written).
    const results = await prisma.competitionResult.findMany({ where: { showId: show.id } });
    expect(results).toHaveLength(1);
  }, 60000);
});
