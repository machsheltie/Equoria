/**
 * Equoria-ypb7d.2 / .3 — hiring is an ENGAGEMENT, and a weekly fee sustains it.
 *
 * OWNER RULING (2026-09-09, verbatim, Equoria-m0w8n):
 *   "players never own grooms. If anyone owns them, Equoria does. They are free
 *    agents. They are HIRED by players and charged a weekly fee. Each groom can
 *    groom up to 10 horses per week. A groom is working for a player and so long as
 *    they pay their weekly fee, they keep the groom on their staff. If they fail to
 *    pay for a groom for a week, the groom goes back to the Grooms for hire section
 *    of the marketplace and can be hired by other players. So for clarity, a player
 *    gets one weeks grace period. The groom can't groom horse until paid for that
 *    week but they don't officially lose the groom once until they fail to pay for a
 *    whole week."
 *
 * THE DEFECT THIS REPLACES (Equoria-0aybn). `terminateGroomsForNonPayment` had
 * NEVER worked: it wrote `terminationReason` to `GroomAssignment`, a column that
 * does not exist, so Prisma rejected its first statement and the function's own
 * catch swallowed the throw. After the seven-day grace period expired, nothing was
 * deactivated, the grace period was never cleared, and no `terminated_non_payment`
 * row was written. A player who could not pay kept every groom, silently, forever.
 *
 * WHAT THIS FILE ASSERTS, AND WHY EACH FAILS ON THE PRE-FIX CODE. Renumbered in fix
 * round 3: the list still described the whole pre-split suite, including six cases that
 * moved to the sibling and a "one 201, one 409" that is no longer what the race case
 * asserts.
 *   1. Hiring opens a `GroomEngagement`               -> the table did not exist
 *   2. The database refuses two open engagements for one groom (partial unique index),
 *      while accepting a CLOSED one alongside the open one — history must stay free
 *   3. Two players cannot both hire one free agent: exactly ONE 201, the loser refused
 *      with 404 or 409 (which one is an interleaving detail, not a contract — see the
 *      case), exactly one open engagement, and no ledger row for the loser. The
 *      controller's `count !== 1` -> 409 refusal itself is asserted deterministically in
 *      groomFreeAgentEndpoint.integration, not here
 *   4. Retirement closes the engagement but KEEPS `userId`, so the player can still
 *      read their retired grooms, and a retired groom is not in the hire pool
 *
 * The fee basis, the week of grace, the second failure inside it, the release, the
 * re-hire by another player, and what paying clears all live in
 * `groomFeeArrears.integration.test.mjs`.
 *
 *
 * SPLIT (fix round 2). This file and `groomFeeArrears.integration.test.mjs` were one
 * suite until the residual-B case pushed it past the 800-line test cap. The boundary is
 * the service boundary, not an arbitrary cut: this file covers what
 * `groomEngagementService` owns — an engagement opened, two players unable to both win
 * one, an engagement closed by retirement — and the sibling covers what
 * `groomFeeArrearsService` owns: the fee basis, the week of grace, the release, and what
 * paying clears. Raising the size baseline was not an option (it may only shrink) and
 * would have been the wrong answer anyway.
 *
 * Real DB, no mocks. This file does not call `processWeeklySalaries` at all any more —
 * the split moved every fee call to the sibling, which carries the scoping note and is
 * the file `groomSalaryPassScoped.sentinel` guards. (Round 3: that sentence was left
 * here describing a call this file no longer makes.)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { prismaRejectionOf } from '../../../__tests__/helpers/expectPrismaRejection.mjs';
import { ENGAGEMENT_END_REASONS, FREE_AGENT_WHERE } from '../services/groomEngagementService.mjs';
import { processRetirement } from '../services/groomRetirementService.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';
import { hireGroom } from '../controllers/groomRosterController.mjs';
import { listFreeAgentGrooms, hireFreeAgent } from '../controllers/groomFreeAgentController.mjs';

const FIXTURE_PREFIX = 'TestFixture-ypb7d-eng';
const tag = () => randomBytes(6).toString('hex');

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function makeUser(label, money) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Ypb7d',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId,
      ...extra,
    },
  });
  // Every groom on staff has an open engagement; the fixtures write it the way the
  // hire paths do rather than relying on the fee pass's backstop.
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId } });
  return groom;
}

/** Delete one fixture user and everything hanging off them, in FK order. */
function registerUserCleanup(cleanup, getUser, label) {
  cleanup.add(async () => {
    const user = getUser();
    if (!user?.id) {
      throw new Error(`[cleanup] ${label} user id missing — refusing an unscoped delete`);
    }
    const groomIds = (await prisma.groom.findMany({ where: { userId: user.id }, select: { id: true } })).map(g => g.id);
    const horseIds = (await prisma.horse.findMany({ where: { userId: user.id }, select: { id: true } })).map(h => h.id);
    if (groomIds.length) {
      await prisma.groomInteraction.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
      await prisma.groomHorseSynergy.deleteMany({ where: { groomId: { in: groomIds } } });
    }
    if (horseIds.length) {
      await prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } });
      await prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { horseId: { in: horseIds } } });
      await prisma.foalActivity.deleteMany({ where: { foalId: { in: horseIds } } });
    }
    await prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.userTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } });
    // A groom this user RELEASED is no longer theirs, so `userId` no longer finds
    // it. Fix round 1 (F11): the prefix sweep this comment described was NOT
    // actually here — cleanup worked only because the "ANOTHER player can hire
    // them" case's `finally` reassigns the groom back. If that case ever fails or
    // is skipped, a released fixture groom leaks permanently into the shared
    // database AND into the free-agent pool. Now the sweep exists. Its engagement
    // rows go first (FK), and it is narrowly scoped to this file's own prefix.
    const strays = await prisma.groom.findMany({
      where: { name: { startsWith: FIXTURE_PREFIX } },
      select: { id: true },
    });
    if (strays.length) {
      const strayIds = strays.map(g => g.id);
      // Fix round 2: `groomInteraction` and `groomSalaryPayment` were missing. Neither
      // was live — zero stray rows have ever been observed, and the tracker is
      // fail-loud so an FK refusal would surface rather than pass — but a sweep that
      // covers only some child tables of `Groom` is a sweep that will one day fail
      // loudly for a reason nobody expects. Dependency order: rows that reference a
      // groom before the groom itself.
      await prisma.groomInteraction.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomEngagement.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomAssignment.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomAssignmentLog.deleteMany({ where: { groomId: { in: strayIds } } });
      await prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: strayIds } } });
    }
    await prisma.groom.deleteMany({ where: { userId: user.id } });
    await prisma.groom.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX } } });
    if (horseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }, `${label} user and dependents`);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.2 — hiring opens an engagement, never an ownership', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('open', 20000);
    registerUserCleanup(cleanup, () => user, 'open');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('direct hire writes exactly one OPEN engagement, in the hire transaction', async () => {
    const res = fakeRes();
    await hireGroom(
      {
        user: { id: user.id },
        body: {
          name: `${FIXTURE_PREFIX}-open-hired-${tag()}`,
          speciality: 'foal_care',
          skill_level: 'novice',
          personality: 'gentle',
        },
      },
      res,
    );
    expect(res.statusCode).toBe(201);

    const engagements = await prisma.groomEngagement.findMany({
      where: { groomId: res.body.data.id },
    });
    expect(engagements).toHaveLength(1);
    expect(engagements[0].userId).toBe(user.id);
    expect(engagements[0].endedAt).toBeNull();
    expect(engagements[0].endReason).toBeNull();
  });

  it('the database refuses a SECOND open engagement for the same groom', async () => {
    // The partial unique index `groom_engagements_active_groomId_key ... WHERE
    // "endedAt" IS NULL` from migration 20260909120000. It is the schema's
    // statement that a groom works for at most one player at a time.
    //
    // FIX ROUND 4 — WHY THIS IS NOT `.rejects.toThrow()` ANY MORE. Two reasons, and
    // they are worth separating because only one of them was reproducible here.
    //
    // 1. THE REALM DEFECT (Equoria-wl6ln), measured by the round-3 reviewer, NOT by
    //    me. On their machine this case was red 4 runs in 4 under `--runInBand` and
    //    green 3 in 3 under `--maxWorkers=2`, with byte-identical test text, because
    //    jest's `.rejects.toThrow()` decides "is this an error" with
    //    `instanceof Error` — constructor identity — and Prisma's
    //    `PrismaClientKnownRequestError` came from a different module realm, so the
    //    check was false and jest reported "did not throw" for a promise that really
    //    did reject with P2002. Same root cause as the `toBeInstanceOf(Date)`
    //    failure `expectRealDate.mjs` exists for.
    //
    //    IT DOES NOT REPRODUCE ON MY MACHINE. An in-suite probe under BOTH
    //    invocations printed `instanceof Error = true`, `code = P2002`,
    //    `target = ["groomId"]`, and the old assertion passed both ways. So I did
    //    not fix a failure I had seen; I removed an identity dependence that is
    //    environment-sensitive, which is the right response either way — a case
    //    that means one thing on one machine and another on the next is not
    //    evidence about the index on either.
    //
    // 2. THE DEFECT THAT IS PRESENT EVERYWHERE, INCLUDING HERE, and the one this
    //    change was actually proven against: `.rejects.toThrow()` passes on ANY
    //    rejection. A foreign key, a missing column, a renamed model would all have
    //    satisfied it. This case's subject is ONE constraint, so it asserts that
    //    constraint's own signature — the P2002 code and the `groomId` target, both
    //    plain properties of the value, nothing asked about where it came from.
    //    Proven by plant: pointing the create at a non-existent groomId makes the
    //    write fail on the FOREIGN KEY instead, and this assertion fails in both
    //    invocations (`Expected "P2002 on groomId", Received "P2003"`) where
    //    `.rejects.toThrow()` would have passed.
    const groom = await makeGroom(user.id, 'open-unique');
    const other = await makeUser('open-unique-other', 5000);
    try {
      expect(
        await prismaRejectionOf(prisma.groomEngagement.create({ data: { groomId: groom.id, userId: other.id } })),
      ).toBe('P2002 on groomId');

      // A CLOSED engagement alongside the open one is fine — history must be free
      // to hold many rows for the same groom. That is why the index is partial.
      const closed = await prisma.groomEngagement.create({
        data: {
          groomId: groom.id,
          userId: other.id,
          endedAt: new Date(),
          endReason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
        },
      });
      expect(closed.id).toBeGreaterThan(0);
    } finally {
      await prisma.groomEngagement.deleteMany({ where: { userId: other.id } });
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.2 — two players cannot hire the same free agent', () => {
  let owner;
  let bidderA;
  let bidderB;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    owner = await makeUser('race-owner', 1000);
    bidderA = await makeUser('race-a', 20000);
    bidderB = await makeUser('race-b', 20000);
    // A groom already released: free agent with a closed engagement, which is what
    // puts them in the pool.
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-race-groom-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: 21,
        userId: null,
      },
    });
    await prisma.groomEngagement.create({
      data: {
        groomId: groom.id,
        userId: owner.id,
        endedAt: new Date('2026-03-09T09:00:00.000Z'),
        endReason: ENGAGEMENT_END_REASONS.FEE_UNPAID,
      },
    });

    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: groom.id } }), 'engagements');
    cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
    for (const [label, getUser] of [
      ['race-owner', () => owner],
      ['race-a', () => bidderA],
      ['race-b', () => bidderB],
    ]) {
      registerUserCleanup(cleanup, getUser, label);
    }
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('exactly one wins, the loser is refused, and one engagement is open', async () => {
    const resA = fakeRes();
    const resB = fakeRes();
    await Promise.all([
      hireFreeAgent({ user: { id: bidderA.id }, body: { groomId: groom.id } }, resA),
      hireFreeAgent({ user: { id: bidderB.id }, body: { groomId: groom.id } }, resB),
    ]);

    const codes = [resA.statusCode, resB.statusCode].sort();
    // EXACTLY ONE winner. That half is the invariant and is asserted exactly.
    expect(codes.filter(c => c === 201)).toHaveLength(1);

    // The LOSER's status is 409 or 404, and which one is a timing detail rather than a
    // contract. Both are honest refusals of the same fact:
    //   409 — the loser reached the transaction and its GUARDED CLAIM found no row;
    //   404 — the loser's pre-read ran after the winner's commit, so by then the groom
    //         genuinely was not in the pool.
    // Asserting 409 specifically was asserting an interleaving: a flat `toBe(409)` here
    // failed three whole-file runs in three when the re-review tried it.
    //
    // ROUND 3 CORRECTS THE REASON THIS COMMENT USED TO GIVE. It said fix round 2 loosened
    // the pair "after the F1 fix made it observably both". That was false and the reviewer
    // disproved it: at bf63e3d10, BEFORE F1, the pre-read was already
    // `{ id, userId: null, retired: false, isActive: true }`, and `userId: null` alone is
    // falsified by the winner's commit — so the 404 branch was exactly as reachable then as
    // now. F1's added relation clause is monotone and changed nothing here. The flake is
    // real; the cause was ordinary interleaving, not this task's change.
    //
    // Loosening it did cost coverage, though, and that cost is now paid elsewhere rather
    // than argued away: the `count !== 1` -> 409 mapping is asserted DETERMINISTICALLY in
    // groomFreeAgentEndpoint.integration, which imposes the ordering with the
    // `groomHireRaceBarrier` seam instead of racing for it. Deleting the controller's
    // guard fails that case on every run; it passed four runs in six against this one.
    const loserCode = codes.find(c => c !== 201);
    expect([404, 409]).toContain(loserCode);

    const open = await prisma.groomEngagement.findMany({
      where: { groomId: groom.id, endedAt: null },
    });
    expect(open).toHaveLength(1);

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true },
    });
    expect(row.userId).toBe(open[0].userId);
    expect([bidderA.id, bidderB.id]).toContain(row.userId);

    // The loser was not charged.
    const loserId = row.userId === bidderA.id ? bidderB.id : bidderA.id;
    const loserLedger = await prisma.userTransaction.count({
      where: { userId: loserId, category: 'groom_hire' },
    });
    expect(loserLedger).toBe(0);

    // THE MECHANISM, pinned deterministically rather than left to the interleaving
    // above: the guarded claim is a conditional `updateMany` on the pool predicate, and
    // against a groom that is now claimed it must affect ZERO rows. That is precisely
    // what makes `claimed.count !== 1` reachable and the second hire impossible. Real
    // DB, no mocks — the same statement the controller runs, with the same predicate
    // object, against the state the race just produced.
    const secondClaim = await prisma.groom.updateMany({
      where: { id: groom.id, ...FREE_AGENT_WHERE },
      data: { userId: loserId },
    });
    expect(secondClaim.count).toBe(0);

    // And the winner still holds them, so the probe above changed nothing.
    expect((await prisma.groom.findUnique({ where: { id: groom.id }, select: { userId: true } })).userId).toBe(
      row.userId,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Equoria-ypb7d.2 — retirement closes the engagement but keeps the history readable', () => {
  let user;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('retire-eng', 20000);
    groom = await makeGroom(user.id, 'retire-eng-groom', { startAge: 20 });
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - 20 },
    });
    registerUserCleanup(cleanup, () => user, 'retire-eng');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('closes the engagement with reason retirement and leaves Groom.userId set', async () => {
    const result = await processRetirement(groom.id);
    expect(result.groom.retired).toBe(true);
    expect(result.closedEngagementCount).toBe(1);

    const engagements = await prisma.groomEngagement.findMany({ where: { groomId: groom.id } });
    expect(engagements).toHaveLength(1);
    expect(engagements[0].endReason).toBe(ENGAGEMENT_END_REASONS.RETIREMENT);
    expect(engagements[0].endedAt).not.toBeNull();

    const row = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { userId: true, retired: true },
    });
    // DELIBERATELY still set, unlike a non-payment release: `retired` already bars
    // the groom from work and from the hire pool, and keeping the pointer is what
    // lets the player still read their retired grooms.
    expect(row.userId).toBe(user.id);
    expect(row.retired).toBe(true);

    // And a retired groom is NOT in the hire pool.
    const res = fakeRes();
    await listFreeAgentGrooms({ user: { id: user.id }, query: { limit: 100 } }, res);
    expect(res.body.data.grooms.map(g => g.id)).not.toContain(groom.id);
  });
});
