/**
 * gdprLargeAccountErasure.integration.test.mjs — Equoria-49bc2
 *
 * GDPR Article 17 right-to-erasure must work for the accounts that actually
 * have data in them.
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
 * was PERMANENTLY impossible for exactly those players. Measured on the
 * original code with the fixture below: the transaction was killed at 5004 ms
 * and surfaced as `RetryableTransactionError`.
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

async function makeUser(suffix) {
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${suffix}`,
      email: `${PREFIX}-${suffix}@example.com`,
      password: passwordHash,
      firstName: 'Erasure',
      lastName: 'Fixture',
    },
  });
  created.userIds.push(user.id);
  return user;
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

    // Comfortably inside the configured budget (the pre-fix code was KILLED at
    // the 5000 ms default on this same fixture). Deliberately a loose bound:
    // the point is "finishes with room to spare", not a latency benchmark.
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

describe('INTEGRATION: GDPR erasure is ALL-OR-NOTHING under partial failure (Equoria-49bc2)', () => {
  it('rolls the entire erasure back when a late statement fails, leaving no half-erased account', async () => {
    // A REAL failure mode, not a contrivance: the erased user entered ANOTHER
    // player's show with a horse that the lineage rules PRESERVE. The horse
    // survives, so the ShowEntry does not cascade, and `show_entries_userId_fkey`
    // (RESTRICT) blocks the final `user.delete` — after the club, forum, message
    // and pedigree writes have already been issued inside the transaction.
    //
    // This is exactly the case the single-transaction boundary exists for: a
    // chunked erasure would have committed the earlier chunks and left the
    // player with their horses anonymized, their forum history gone, and their
    // account still logged-in-able. The underlying erasure gap (such a user can
    // never complete erasure at all) is filed as Equoria-hr0jw; WHEN THAT IS
    // FIXED THIS TEST MUST BE RE-POINTED at another forced failure — it will go
    // red, and that is the intended signal, not a break.
    const owner = await makeUser('rollback-owner');
    const other = await makeUser('rollback-other');

    const ancestor = await makeHorse(owner.id, 'rollback-ancestor', { sex: 'Stallion' });
    await makeHorse(other.id, 'rollback-foal', { sireId: ancestor.id });

    const show = await prisma.show.create({
      data: {
        name: `${PREFIX}-rollback-show`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(Date.now() + 86_400_000),
        status: 'open',
        createdByUserId: other.id,
      },
    });
    created.showIds.push(show.id);
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: ancestor.id, userId: owner.id, feePaid: 0 },
    });

    const thread = await prisma.forumThread.create({
      data: { section: 'general', title: `${PREFIX}-rollback-thread`, authorId: owner.id, tags: [] },
    });
    created.threadIds.push(thread.id);
    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-rollback-club`,
        type: 'discipline',
        category: 'Dressage',
        description: 'fixture',
        leaderId: other.id,
      },
    });
    created.clubIds.push(club.id);
    await prisma.clubMembership.create({ data: { clubId: club.id, userId: owner.id } });

    // Explicit try/catch rather than `.rejects.toThrow`: the Prisma error class
    // crosses Jest's VM-module realm boundary, so the matcher's Error-shape
    // check does not recognise it and reports a genuine rejection as "did not
    // throw". Capturing the value directly asserts the real behaviour.
    let thrown = null;
    try {
      await eraseUserAccount(owner.id);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(String(thrown.message)).toMatch(/show_entries_userId_fkey/);
    // ...and the genuine fault is NOT masked behind the retryable 503 that the
    // timeout used to produce. Misclassifying it would tell the player to
    // "retry in a moment" for a condition retrying can never clear.
    expect(thrown.status).toBeUndefined();

    // NOTHING committed. Every write the transaction had already issued before
    // the failure is gone, and the account is exactly as it was.
    const userAfter = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(userAfter).not.toBeNull();

    const ancestorAfter = await prisma.horse.findUnique({ where: { id: ancestor.id } });
    expect(ancestorAfter).not.toBeNull();
    expect(ancestorAfter.userId).toBe(owner.id); // NOT anonymized
    expect(ancestorAfter.name).toBe(`${PREFIX}-rollback-ancestor`);

    expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).not.toBeNull();
    expect(await prisma.clubMembership.count({ where: { userId: owner.id } })).toBe(1);

    // The other player's show is untouched — still open, entry intact.
    const showAfter = await prisma.show.findUnique({ where: { id: show.id } });
    expect(showAfter.status).toBe('open');
    expect(await prisma.showEntry.count({ where: { showId: show.id } })).toBe(1);
  }, 120_000);
});
