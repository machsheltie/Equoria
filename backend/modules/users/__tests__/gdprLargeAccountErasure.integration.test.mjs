/**
 * gdprLargeAccountErasure.integration.test.mjs — Equoria-49bc2, Equoria-hr0jw
 *
 * GDPR Article 17 right-to-erasure must work for the accounts that actually
 * have data in them. Two independent lock-outs kept that from being true; this
 * file covers both, because they share a fixture vocabulary (a breeder whose
 * horses other players have bred from).
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * `eraseUserAccount()` ran its whole settlement inside
 * `prisma.$transaction(fn)` with NO options object, so Prisma's DEFAULT 5000 ms
 * interactive-transaction budget applied. The body issued O(N) round trips:
 *   • the lineage fixpoint walk did one `findMany` PER PEDIGREE GENERATION, and
 *   • the ancestor anonymization did one `horse.update` PER PRESERVED HORSE.
 * A long-running breeder blew the 5 s budget, Prisma raised P2028, and
 * `withRetryableTxMapping` mapped it to a 503 "busy, retry in a moment".
 * Retrying never helped — the account was the same size next time — so erasure
 * was PERMANENTLY impossible for exactly those players. Measured against the
 * ORIGINAL unbatched body with the fixture below: killed at 5004 ms, surfaced
 * as `RetryableTransactionError`. That measurement cannot be reproduced by
 * toggling the budget alone — see the note on the wall-time assertion.
 *
 * ── The fix under test ───────────────────────────────────────────────────────
 *   1. ONE transaction still (see the ERASURE_TX_OPTIONS doc comment for why a
 *      chunked erasure was rejected: this body moves money and rewrites other
 *      players' pedigrees, so a half-erased account is worse than a failed
 *      one), with an EXPLICIT elevated budget.
 *   2. The two O(N) loops are batched away, so the elevated budget is a ceiling
 *      for a pathological account rather than the expected cost.
 *
 * ── What this file proves, and what it cannot ────────────────────────────────
 * `describe('deterministic')` is machine-independent: it pins the elevated
 * budget and pins that the call site actually passes it, so a revert to the 5 s
 * default fails the suite on any hardware.
 *
 * The large-account case is a REAL erasure against the REAL database. Its wall
 * time is inherently machine-dependent: this fixture is sized to exceed 5 s on
 * a localhost Postgres, where a round trip costs ~1.5 ms. In production, where
 * a round trip crosses a network, far fewer horses reach the same wall clock —
 * so the fixture size here is NOT a claim about how large an account has to be
 * before a player is locked out. This test also cannot observe production pool
 * contention, a replica lag spike, or a cold cache; `maxWait` covers the first
 * and nothing here exercises the others.
 *
 * The Equoria-hr0jw block is the SECOND lock-out: a `ShowEntry` on a horse the
 * lineage rule preserves, which `show_entries_userId_fkey` (RESTRICT) then used
 * to make un-erasable. That one is fully deterministic — no wall clock in it —
 * and it fails on the pre-fix service with SQLSTATE 23001.
 *
 * Real DB, no mocks, strictly id-scoped cleanup (shared dev database).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { eraseUserAccount, ERASURE_TX_OPTIONS } from '../services/gdprAccountService.mjs';
import { enterShow, settleShowFeeEscrow } from '../../competition/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_PATH = resolve(__dirname, '..', 'services', 'gdprAccountService.mjs');

// Unique per run: the dev database is shared with other agents/suites, so every
// row this file creates carries this prefix and is removed by collected id.
const PREFIX = `TestFixture-49bc2-${randomBytes(5).toString('hex')}`;

// 150 lineages x 30 generations = 4500 owned horses, each lineage's youngest
// owned horse carrying ONE foal owned by a surviving player. That shape forces
// BOTH pathological loops at once on the pre-fix code: 30 walk round trips plus
// 4500 per-row anonymization round trips. Measured pre-fix at 120x30 (3600
// horses): killed at the 5000 ms default. This size keeps ~2x margin over that.
const LINEAGES = 150;
const GENERATIONS = 30;

/** Every id this file creates, for narrowly scoped cleanup. */
const created = {
  userIds: [],
  horseIds: [],
  showIds: [],
  clubIds: [],
  threadIds: [],
};

let passwordHash;

function horseData(name, ownerId, extra = {}) {
  return {
    ...fixtureColor(),
    name,
    sex: 'Mare',
    dateOfBirth: new Date('2018-06-15'),
    age: 7,
    userId: ownerId,
    healthStatus: 'Good',
    speed: 60,
    stamina: 60,
    agility: 60,
    balance: 60,
    precision: 60,
    boldness: 60,
    ...extra,
  };
}

async function makeUser(suffix, extra = {}) {
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${suffix}`,
      email: `${PREFIX}-${suffix}@example.com`,
      password: passwordHash,
      firstName: 'Erasure',
      lastName: 'Fixture',
      ...extra,
    },
  });
  created.userIds.push(user.id);
  return user;
}

/** Minimal Express `res` shim so a controller can be driven directly. */
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

/** Wallet balance for one suite-owned user (never an aggregate over the table). */
async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return row ? Number(row.money) : null;
}

async function makeHorse(ownerId, suffix, extra = {}) {
  const horse = await prisma.horse.create({
    data: horseData(`${PREFIX}-${suffix}`, ownerId, extra),
  });
  created.horseIds.push(horse.id);
  return horse;
}

/**
 * Seed a large, realistically-shaped account: a deep multi-lineage pedigree
 * whose youngest owned horses have foals owned by a SURVIVING player (so the
 * whole ancestry must be preserved + anonymized rather than deleted), plus the
 * ordinary account furniture the erasure walks.
 *
 * Returns { owner, survivor, ancestorIds, foalIds, childlessId, showIds }.
 */
async function seedLargeAccount() {
  const owner = await makeUser('bigowner');
  const survivor = await makeUser('survivor');

  // Pedigree, one generation per createMany batch (keeps SEEDING cheap; the
  // erasure under test is what we are measuring, not the fixture builder).
  const ancestorIds = [];
  let previousGeneration = null;
  for (let g = 0; g < GENERATIONS; g++) {
    const rows = [];
    for (let l = 0; l < LINEAGES; l++) {
      rows.push(
        horseData(`${PREFIX}-l${l}g${g}`, owner.id, previousGeneration ? { damId: previousGeneration[l] } : {}),
      );
    }
    await prisma.horse.createMany({ data: rows });
    const madeRows = await prisma.horse.findMany({
      where: { name: { in: rows.map(r => r.name) } },
      select: { id: true, name: true },
    });
    const idByName = new Map(madeRows.map(m => [m.name, m.id]));
    previousGeneration = Array.from({ length: LINEAGES }, (_, l) => idByName.get(`${PREFIX}-l${l}g${g}`));
    ancestorIds.push(...previousGeneration);
    created.horseIds.push(...previousGeneration);
  }

  // One foal per lineage, owned by the SURVIVING player.
  const foalRows = Array.from({ length: LINEAGES }, (_, l) =>
    horseData(`${PREFIX}-foal${l}`, survivor.id, { damId: previousGeneration[l] }),
  );
  await prisma.horse.createMany({ data: foalRows });
  const foals = await prisma.horse.findMany({
    where: { name: { in: foalRows.map(r => r.name) } },
    select: { id: true },
  });
  const foalIds = foals.map(f => f.id);
  created.horseIds.push(...foalIds);

  // A horse with no external descendant — must be HARD-deleted, proving the
  // partition still runs per-horse at this scale.
  const childless = await makeHorse(owner.id, 'childless');

  // Shows the owner created, with entries — exercises the batched cancel pass.
  const showIds = [];
  for (let s = 0; s < 3; s++) {
    const show = await prisma.show.create({
      data: {
        name: `${PREFIX}-show${s}`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        // Zero fees/escrow on purpose: the money paths are covered by
        // gdprAccountServiceShowCancel.integration.test.mjs, and this suite
        // must not perturb the shared SystemAccount balances that the
        // money-conservation sentinel reconciles.
        entryFee: 0,
        prize: 0,
        prizeEscrow: 0,
        feeEscrow: 0,
        runDate: new Date(Date.now() + 86_400_000),
        status: 'open',
        createdByUserId: owner.id,
        hostUserId: owner.id,
      },
    });
    showIds.push(show.id);
    created.showIds.push(show.id);
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: childless.id, userId: owner.id, feePaid: 0 },
    });
  }

  // Ordinary account furniture: forum content, messages both directions, club
  // membership, notifications, transactions, xp events.
  const thread = await prisma.forumThread.create({
    data: { section: 'general', title: `${PREFIX}-thread`, authorId: owner.id, tags: [] },
  });
  created.threadIds.push(thread.id);
  await prisma.forumPost.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      threadId: thread.id,
      authorId: owner.id,
      content: `${PREFIX}-post-${i}`,
    })),
  });
  await prisma.directMessage.createMany({
    data: [
      ...Array.from({ length: 15 }, (_, i) => ({
        senderId: owner.id,
        recipientId: survivor.id,
        subject: `${PREFIX}-sent-${i}`,
        content: 'x',
      })),
      ...Array.from({ length: 15 }, (_, i) => ({
        senderId: survivor.id,
        recipientId: owner.id,
        subject: `${PREFIX}-recv-${i}`,
        content: 'x',
      })),
    ],
  });
  const club = await prisma.club.create({
    data: {
      name: `${PREFIX}-club`,
      type: 'discipline',
      category: 'Dressage',
      description: 'fixture',
      leaderId: survivor.id,
    },
  });
  created.clubIds.push(club.id);
  await prisma.clubMembership.create({ data: { clubId: club.id, userId: owner.id } });
  await prisma.notification.createMany({
    data: Array.from({ length: 40 }, () => ({
      userId: owner.id,
      type: 'system',
      payload: { fixture: PREFIX },
    })),
  });
  await prisma.userTransaction.createMany({
    data: Array.from({ length: 40 }, (_, i) => ({
      userId: owner.id,
      type: 'credit',
      amount: 1,
      category: 'fixture',
      description: `${PREFIX}-tx-${i}`,
      balanceAfter: 0,
    })),
  });

  return { owner, survivor, ancestorIds, foalIds, childlessId: childless.id, showIds };
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash('TestPassword123!', 1);
}, 120_000);

afterAll(async () => {
  // Strictly scoped teardown: only ids this file collected. Order matters —
  // lineage edges are RESTRICT, so break them among OUR horses first.
  const warn = err => console.warn(`[49bc2 cleanup] ${err.message}`);
  if (created.showIds.length) {
    await prisma.showEntry.deleteMany({ where: { showId: { in: created.showIds } } }).catch(warn);
  }
  if (created.userIds.length) {
    await prisma.showEntry.deleteMany({ where: { userId: { in: created.userIds } } }).catch(warn);
    await prisma.forumPost.deleteMany({ where: { authorId: { in: created.userIds } } }).catch(warn);
    await prisma.forumThread.deleteMany({ where: { authorId: { in: created.userIds } } }).catch(warn);
    await prisma.directMessage.deleteMany({ where: { senderId: { in: created.userIds } } }).catch(warn);
    await prisma.directMessage.deleteMany({ where: { recipientId: { in: created.userIds } } }).catch(warn);
    await prisma.clubMembership.deleteMany({ where: { userId: { in: created.userIds } } }).catch(warn);
    await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } }).catch(warn);
    await prisma.userTransaction.deleteMany({ where: { userId: { in: created.userIds } } }).catch(warn);
  }
  if (created.clubIds.length) {
    await prisma.clubMembership.deleteMany({ where: { clubId: { in: created.clubIds } } }).catch(warn);
    await prisma.club.deleteMany({ where: { id: { in: created.clubIds } } }).catch(warn);
  }
  if (created.showIds.length) {
    // Drain any escrow a fixture show is still holding BEFORE deleting the row.
    // Deleting a show with feeEscrow > 0 would strand that money in the shared
    // SystemAccount[show_escrow] with no show to account for it, breaking the
    // si69u reconciliation for every suite that runs after this one. The happy
    // path settles inside the test; this is the failed-test path.
    const stillEscrowed = await prisma.show
      .findMany({
        where: { id: { in: created.showIds }, feeEscrow: { gt: 0 } },
        select: { id: true },
      })
      .catch(err => {
        warn(err);
        return [];
      });
    for (const { id } of stillEscrowed) {
      await settleShowFeeEscrow(id).catch(warn);
    }
    await prisma.show.deleteMany({ where: { id: { in: created.showIds } } }).catch(warn);
  }
  if (created.horseIds.length) {
    await prisma.horse
      .updateMany({ where: { id: { in: created.horseIds } }, data: { sireId: null, damId: null } })
      .catch(warn);
    await prisma.horse.deleteMany({ where: { id: { in: created.horseIds } } }).catch(warn);
  }
  if (created.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(warn);
  }
  await prisma.$disconnect().catch(warn);
}, 300_000);

describe('Equoria-49bc2 — erasure transaction budget (deterministic)', () => {
  it('declares an ELEVATED interactive-transaction budget, not the Prisma 5s default', () => {
    // The regression this pins: dropping the options object silently reinstates
    // Prisma's 5000 ms default and locks large accounts out of erasure again.
    expect(ERASURE_TX_OPTIONS.timeout).toBeGreaterThanOrEqual(60_000);
    expect(ERASURE_TX_OPTIONS.timeout).toBeGreaterThan(5_000);
    expect(ERASURE_TX_OPTIONS.maxWait).toBeGreaterThanOrEqual(5_000);
    // Frozen so no caller can mutate the shared budget at runtime.
    expect(Object.isFrozen(ERASURE_TX_OPTIONS)).toBe(true);
  });

  it('passes those options AT the $transaction call site (source sentinel)', () => {
    const src = readFileSync(SERVICE_PATH, 'utf8');
    // The erasure's sole interactive transaction must close with the options
    // object. A bare `})` close is the pre-fix shape and the regression.
    expect(src).toMatch(/\}, ERASURE_TX_OPTIONS\)/);
    expect((src.match(/prisma\.\$transaction\s*\(/g) || []).length).toBe(1);
    // ...and it is still wrapped for the retryable-503 mapping (the sentinel in
    // backend/__tests__/retryableTransactionWrapping.sentinel.test.mjs pins the
    // counts; this asserts the two facts hold TOGETHER at this call site).
    expect(src).toMatch(/withRetryableTxMapping\(\s*prisma\.\$transaction\(/);
  });

  it('detector FIRES on the pre-fix shape (sentinel-positive)', () => {
    const preFix = `
      await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          await tx.user.delete({ where: { id: userId } });
        }),
        { message: 'busy' },
      );
    `;
    expect(preFix).not.toMatch(/\}, ERASURE_TX_OPTIONS\)/);
  });
});

describe('INTEGRATION: GDPR erasure of a LARGE account (Equoria-49bc2)', () => {
  let fixture;
  let elapsedMs;

  it(`erases an account with ${LINEAGES * GENERATIONS} owned horses across ${GENERATIONS} generations`, async () => {
    fixture = await seedLargeAccount();

    const startedAt = Date.now();
    const result = await eraseUserAccount(fixture.owner.id);
    elapsedMs = Date.now() - startedAt;

    expect(result).toEqual({ deleted: true });
    expect(await prisma.user.findUnique({ where: { id: fixture.owner.id } })).toBeNull();

    // Comfortably inside the configured budget. Deliberately a loose bound:
    // the point is "finishes with room to spare", not a latency benchmark.
    //
    // MEASURED LIMIT OF THIS ASSERTION (2026-09-21, re-verified on the merged
    // fix): with the O(N) loops batched away, this fixture now erases in well
    // under a second, so removing `ERASURE_TX_OPTIONS` from the call site does
    // NOT turn this `it` red on a localhost Postgres — it still passes inside
    // the 5000 ms default. The elevated budget's regression guard is therefore
    // the deterministic describe above (which fails on any hardware), and this
    // case's job is to prove the batched body produces the RIGHT state at
    // scale. The combination is what makes a power user erasable; neither half
    // alone reproduces the original P2028 without also reverting the other.
    expect(elapsedMs).toBeLessThan(ERASURE_TX_OPTIONS.timeout / 2);
  }, 300_000);

  it('leaves NOTHING of the erased user behind', async () => {
    const userId = fixture.owner.id;
    const [horses, notifications, transactions, posts, threads, sent, received, memberships] = await Promise.all([
      prisma.horse.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.userTransaction.count({ where: { userId } }),
      prisma.forumPost.count({ where: { authorId: userId } }),
      prisma.forumThread.count({ where: { authorId: userId } }),
      prisma.directMessage.count({ where: { senderId: userId } }),
      prisma.directMessage.count({ where: { recipientId: userId } }),
      prisma.clubMembership.count({ where: { userId } }),
    ]);
    expect({
      horses,
      notifications,
      transactions,
      posts,
      threads,
      sent,
      received,
      memberships,
    }).toEqual({
      horses: 0,
      notifications: 0,
      transactions: 0,
      posts: 0,
      threads: 0,
      sent: 0,
      received: 0,
      memberships: 0,
    });

    // The childless horse had no external descendant — hard-deleted.
    expect(await prisma.horse.findUnique({ where: { id: fixture.childlessId } })).toBeNull();
  }, 120_000);

  it('preserves and anonymizes the whole ancestry the surviving player descends from', async () => {
    // Every ancestor survives, detached and PII-scrubbed — the batched raw
    // scrub must produce exactly what the old per-row update produced.
    const ancestors = await prisma.horse.findMany({
      where: { id: { in: fixture.ancestorIds } },
      select: {
        id: true,
        userId: true,
        name: true,
        forSale: true,
        salePrice: true,
        studStatus: true,
        studFee: true,
        damId: true,
      },
    });
    expect(ancestors).toHaveLength(fixture.ancestorIds.length);
    for (const a of ancestors) {
      expect(a.userId).toBeNull();
      expect(a.name).toBe(`Anonymized Horse #${a.id}`);
      expect(a.forSale).toBe(false);
      expect(a.salePrice).toBe(0);
      expect(a.studStatus).toBe('Not at Stud');
      expect(a.studFee).toBe(0);
    }

    // The deeper pedigree edges survive: every non-founder ancestor still
    // points at its dam. This is the assertion the in-memory fixpoint walk has
    // to reproduce — if the walk under-collected, those parents would have been
    // hard-deleted and these edges would be NULL.
    const withDam = ancestors.filter(a => a.damId !== null);
    expect(withDam).toHaveLength(fixture.ancestorIds.length - LINEAGES);

    // The surviving player's foals keep their lineage pointers.
    const foals = await prisma.horse.findMany({
      where: { id: { in: fixture.foalIds } },
      select: { userId: true, damId: true },
    });
    expect(foals).toHaveLength(LINEAGES);
    for (const f of foals) {
      expect(f.userId).toBe(fixture.survivor.id);
      expect(f.damId).not.toBeNull();
    }

    // The surviving player themselves is untouched.
    expect(await prisma.user.findUnique({ where: { id: fixture.survivor.id } })).not.toBeNull();
  }, 120_000);

  it('terminates the erased user shows in the batched cancel pass', async () => {
    const shows = await prisma.show.findMany({
      where: { id: { in: fixture.showIds } },
      select: { id: true, status: true, executedAt: true, createdByUserId: true, hostUserId: true },
    });
    expect(shows).toHaveLength(3);
    for (const show of shows) {
      expect(show.status).toBe('completed');
      expect(show.executedAt).not.toBeNull();
      expect(show.createdByUserId).toBeNull();
      expect(show.hostUserId).toBeNull();
    }
    expect(await prisma.showEntry.count({ where: { showId: { in: fixture.showIds } } })).toBe(0);
  }, 120_000);

  it('is idempotent: re-erasing the same account reports not-found, never a 503', async () => {
    await expect(eraseUserAccount(fixture.owner.id)).resolves.toEqual({ deleted: false });
  }, 120_000);
});

describe('INTEGRATION: erasure survives a PRESERVED horse that carries an entry (Equoria-hr0jw)', () => {
  // ── The defect this reproduces ────────────────────────────────────────────
  // `eraseUserAccount()` never deleted the erased user's OWN ShowEntry rows on
  // shows OTHER players created. That was invisible for years because
  // `ShowEntry.horse` is `onDelete: Cascade`: the entry went away with the
  // horse. It stops being invisible the moment the entered horse is PRESERVED
  // instead of deleted — the Equoria-cugl9 lineage rule keeps (anonymizes) any
  // of the user's horses a SURVIVING player's horse descends from. The horse
  // row survives, so the entry survives, `ShowEntry.userId` is a required
  // relation carrying the default RESTRICT, and the terminal `tx.user.delete`
  // fails with
  //     23001 ... violates RESTRICT ... "show_entries_userId_fkey"
  // rolling the WHOLE erasure back. The shape is stable, so retrying can never
  // clear it: the account could never be erased at all.
  //
  // Nothing exotic is required — a breeder who sold a foal on and entered the
  // parent in someone else's show is an ordinary account.
  //
  // RED-BEFORE PROOF: on the code without the
  // `tx.showEntry.deleteMany({ where: { userId } })` statement, the first `it`
  // below fails at `expect(result).toEqual({ deleted: true })` with that 23001,
  // and every later assertion in the block fails with it too (the user, the
  // horse, the forum thread and the club membership are all still there). This
  // fixture is exactly the shape recorded on Equoria-hr0jw from the real DB.
  //
  // This block replaces the partial-failure/rollback case the Equoria-49bc2
  // draft parked here: that case FORCED its late failure with this very bug,
  // and the bug is now fixed, so the failure it depended on no longer exists.
  let owner;
  let other;
  let ancestor;
  let foal;
  let show;
  let otherMoneyAfterEntries;
  let thread;

  it('erases the account instead of dying on show_entries_userId_fkey', async () => {
    owner = await makeUser('hr0jw-owner', { money: 1000 });
    other = await makeUser('hr0jw-other', { money: 1000 });

    // The stallion the surviving player's foal descends from — so the lineage
    // rule PRESERVES it rather than deleting it, and its entry cannot cascade.
    ancestor = await makeHorse(owner.id, 'hr0jw-ancestor', { sex: 'Stallion' });
    foal = await makeHorse(other.id, 'hr0jw-foal', { sireId: ancestor.id });

    // A show the OTHER player hosts. Created directly (not via createShow) so
    // it starts with zero escrow: every coin this fixture puts into
    // SystemAccount[show_escrow] then arrives through the REAL entry path
    // below and leaves through the REAL settlement path at the end, which
    // keeps the si69u invariant (escrow.balance == SUM(prizeEscrow +
    // feeEscrow)) true at every point a concurrent sibling suite could look.
    show = await prisma.show.create({
      data: {
        name: `${PREFIX}-hr0jw-show`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 50,
        prize: 0,
        prizeEscrow: 0,
        feeEscrow: 0,
        runDate: new Date(Date.now() + 7 * 86_400_000),
        openDate: new Date(),
        closeDate: new Date(Date.now() + 6 * 86_400_000),
        status: 'open',
        createdByUserId: other.id,
        hostUserId: other.id,
      },
    });
    created.showIds.push(show.id);

    // Both players enter through the production controller, so the fee legs
    // are real: wallet -> SystemAccount[show_escrow], show.feeEscrow += fee,
    // ShowEntry created.
    for (const [entrant, horse] of [
      [owner, ancestor],
      [other, foal],
    ]) {
      const res = fakeRes();
      await enterShow({ user: { id: entrant.id }, params: { id: String(show.id) }, body: { horseId: horse.id } }, res);
      expect(res.statusCode).toBe(201);
    }

    const midShow = await prisma.show.findUnique({ where: { id: show.id } });
    expect(midShow.feeEscrow).toBe(100);
    expect(await moneyOf(owner.id)).toBe(950);
    otherMoneyAfterEntries = await moneyOf(other.id);
    expect(otherMoneyAfterEntries).toBe(950);

    // The rest of the account, so the assertion below that it is GONE is
    // evidence the whole erasure committed rather than partially ran.
    thread = await prisma.forumThread.create({
      data: { section: 'general', title: `${PREFIX}-hr0jw-thread`, authorId: owner.id, tags: [] },
    });
    created.threadIds.push(thread.id);
    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-hr0jw-club`,
        type: 'discipline',
        category: 'Dressage',
        description: 'fixture',
        leaderId: other.id,
      },
    });
    created.clubIds.push(club.id);
    await prisma.clubMembership.create({ data: { clubId: club.id, userId: owner.id } });

    // ACT. Pre-fix this throws 23001 and nothing at all is erased.
    const result = await eraseUserAccount(owner.id);
    expect(result).toEqual({ deleted: true });

    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toBeNull();
    expect(await prisma.clubMembership.count({ where: { userId: owner.id } })).toBe(0);
  }, 120_000);

  it('keeps the preserved ancestor and the descendant lineage it exists for', async () => {
    const ancestorAfter = await prisma.horse.findUnique({ where: { id: ancestor.id } });
    expect(ancestorAfter).not.toBeNull();
    expect(ancestorAfter.userId).toBeNull();
    expect(ancestorAfter.name).toBe(`Anonymized Horse #${ancestor.id}`);

    const foalAfter = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(foalAfter.userId).toBe(other.id);
    expect(foalAfter.sireId).toBe(ancestor.id);
  }, 120_000);

  it('scratches ONLY the erased player entry from the other player show', async () => {
    const entries = await prisma.showEntry.findMany({
      where: { showId: show.id },
      select: { horseId: true, userId: true, feePaid: true },
    });
    // Exactly one entry left: the host's own. The erased player's entry on the
    // preserved horse is gone — and it is gone by OWNER, not by show: the
    // erasure must never reach into a show someone else created and clear
    // rows that are not the erased user's.
    expect(entries).toEqual([{ horseId: foal.id, userId: other.id, feePaid: 50 }]);

    // The host's show itself is untouched: still open, still theirs.
    const showAfter = await prisma.show.findUnique({ where: { id: show.id } });
    expect(showAfter.status).toBe('open');
    expect(showAfter.createdByUserId).toBe(other.id);
    expect(showAfter.hostUserId).toBe(other.id);
    expect(showAfter.executedAt).toBeNull();
  }, 120_000);

  it('conserves money: the scratched fee stays escrowed and still settles to the host', async () => {
    // The retention ruling under test. Equoria has no withdraw-from-show path,
    // so an entry fee is the HOST's from the moment it lands in escrow. The
    // erasure therefore moves no money at all: it does not refund the erased
    // player (their wallet is being deleted), and it does not burn the fee
    // (which would quietly shrink ANOTHER player's settlement because a
    // stranger exercised Article 17).
    const showAfter = await prisma.show.findUnique({ where: { id: show.id } });
    expect(showAfter.feeEscrow).toBe(100); // BOTH fees, erased player's included
    expect(showAfter.prizeEscrow).toBe(0);
    expect(await moneyOf(other.id)).toBe(otherMoneyAfterEntries); // host untouched

    // And the host really does collect it: drive the production settlement and
    // watch all 100 land in their wallet. This is a per-user delta on a
    // suite-owned wallet plus this show's own escrow columns — never a shared
    // SystemAccount balance, which sibling suites write concurrently.
    await settleShowFeeEscrow(show.id);
    expect(await moneyOf(other.id)).toBe(otherMoneyAfterEntries + 100);
    const settled = await prisma.show.findUnique({ where: { id: show.id } });
    expect(settled.feeEscrow).toBe(0);
  }, 120_000);
});
