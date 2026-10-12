/**
 * Conformation show entry is server-authoritative — Equoria-mwjst (Codex scan
 * 2026-10-02, Finding 2, entry half).
 *
 * The defect: `POST /api/v1/competition/conformation/enter` created the
 * ShowEntry with `feePaid: 0` and never looked at the show's configured
 * `entryFee`, its open/close window, or its XP-level bracket. A player entered
 * any conformation show free, after it closed, before it opened, and at any
 * level. Every other show entry runs the canonical entry transaction
 * (`enterShowDeferredTx`, the one behind the live `POST /competition/enter`).
 *
 * Owner ruling 2026-10-05: conformation entry behaves like a regular show
 * entry — the configured fee is debited into show escrow, and the closing date
 * and XP-level bracket are enforced — with conformation's own rules (assigned
 * groom, weanlings allowed) kept on top.
 *
 * The invariant this file locks: a conformation ShowEntry exists only if, in
 * ONE transaction, the entrant was debited exactly the show's entryFee, the
 * same amount was credited to show escrow (Show.feeEscrow + an escrow ledger
 * row) and recorded on the entrant's ledger, `feePaid` equals that fee, the
 * show was open and inside its window, and the horse's XP level was in the
 * bracket. Any refusal leaves wallet, escrow, ledger and entries untouched;
 * duplicate and concurrent attempts charge at most once.
 *
 * Why these assertions detect the old defect: the pre-fix controller returned
 * 201 for the closed, not-yet-open, closed-status and out-of-bracket shows and
 * for a player who could not afford the fee, and on every success left money,
 * Show.feeEscrow and the ledger unchanged with `feePaid: 0`.
 *
 * Escrow is asserted through per-show and per-entrant state (Show.feeEscrow,
 * the entrant's own ledger rows), never the shared SystemAccount balance,
 * which concurrent suites also move.
 *
 * Real app, real JWT, real CSRF, real database. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-mwjst-confentry';
const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_FEE = 120;

const tag = randomBytes(4).toString('hex');
let csrf;
let creator;
const groomIds = [];
const assignmentIds = [];

/** An entrant with a token, money, an entry-ready horse and an assigned groom. */
async function makeEntrant(label, { money = 1000, horseXp = 0 } = {}) {
  const { user, token } = await createTestUser({
    username: `${FIXTURE_PREFIX}-${label}-${tag}`,
    email: `${FIXTURE_PREFIX}-${label}-${tag}@example.com`,
    money,
  });
  const now = new Date();
  const horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-${label}-horse-${tag}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
    horseXp,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-groom-${tag}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
    },
  });
  groomIds.push(groom.id);
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      // validateConformationEntry requires an assignment at least 2 days old.
      createdAt: new Date(Date.now() - 5 * DAY_MS),
    },
  });
  assignmentIds.push(assignment.id);
  return { user, token, horse, groom };
}

/** A conformation show created the way the game creates shows: open now, closing in 7 days. */
async function makeShow(overrides = {}) {
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * DAY_MS);
  return createTestShow({
    name: `${FIXTURE_PREFIX}-show`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee: ENTRY_FEE,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    createdByUserId: creator.id,
    ...overrides,
  });
}

function enter(entrant, show) {
  return request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${entrant.token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: entrant.horse.id, groomId: entrant.groom.id, showId: show.id, className: 'Mares' });
}

/** Every economic trace of this entrant against this show. */
async function snapshot(entrant, show) {
  const [user, showRow, entries, ledger] = await Promise.all([
    prisma.user.findUnique({ where: { id: entrant.user.id }, select: { money: true } }),
    prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } }),
    prisma.showEntry.findMany({ where: { showId: show.id } }),
    prisma.userTransaction.findMany({ where: { userId: entrant.user.id } }),
  ]);
  const showLedger = ledger.filter(row => Number(row.metadata?.showId) === show.id);
  return {
    money: Number(user.money),
    feeEscrow: Number(showRow.feeEscrow),
    entries,
    escrowCredits: showLedger.filter(row => row.category === 'show_entry_fee_escrow'),
    entrantDebits: showLedger.filter(row => row.category === 'competition_entry'),
  };
}

function expectUnchanged(after, before) {
  expect(after.money).toBe(before.money);
  expect(after.feeEscrow).toBe(before.feeEscrow);
  expect(after.entries).toHaveLength(before.entries.length);
  expect(after.escrowCredits).toHaveLength(before.escrowCredits.length);
  expect(after.entrantDebits).toHaveLength(before.entrantDebits.length);
}

beforeAll(async () => {
  ({ user: creator } = await createTestUser({
    username: `${FIXTURE_PREFIX}-creator-${tag}`,
    email: `${FIXTURE_PREFIX}-creator-${tag}@example.com`,
  }));
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  // Assignments and grooms first (they reference the horses), then the
  // tracked shows (entries cascade), horses and users (ledger rows cascade).
  await prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await cleanupTestData();
});

describe('conformation entry is server-authoritative (Equoria-mwjst Finding 2)', () => {
  it('a legal entry debits exactly the configured fee once and funds this show’s escrow with it', async () => {
    const entrant = await makeEntrant('legal');
    const show = await makeShow();
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(201);
    const after = await snapshot(entrant, show);
    expect(after.money).toBe(before.money - ENTRY_FEE);
    expect(after.feeEscrow).toBe(ENTRY_FEE);
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0].feePaid).toBe(ENTRY_FEE);
    expect(after.entries[0].userId).toBe(entrant.user.id);
    expect(after.escrowCredits.map(row => Number(row.amount))).toEqual([ENTRY_FEE]);
    expect(after.entrantDebits.map(row => Number(row.amount))).toEqual([ENTRY_FEE]);
    // The creator is paid at settlement, never at entry.
    const creatorNow = await prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } });
    expect(Number(creatorNow.money)).toBe(Number(creator.money));
  });

  it('a free conformation show with no closing date still accepts entries and charges nothing', async () => {
    const entrant = await makeEntrant('free');
    const show = await makeShow({ entryFee: 0, openDate: null, closeDate: null });
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(201);
    const after = await snapshot(entrant, show);
    expect(after.money).toBe(before.money);
    expect(after.feeEscrow).toBe(0);
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0].feePaid).toBe(0);
  });

  it('refuses a player who cannot afford the fee (402) with no entry, debit, escrow or ledger drift', async () => {
    const entrant = await makeEntrant('broke', { money: ENTRY_FEE - 1 });
    const show = await makeShow();
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(402);
    expectUnchanged(await snapshot(entrant, show), before);
  });

  it('refuses a show whose closing date has passed (409) with no side effects', async () => {
    const entrant = await makeEntrant('late');
    const closeDate = new Date(Date.now() - 60 * 60 * 1000);
    const show = await makeShow({ openDate: new Date(closeDate.getTime() - 7 * DAY_MS), closeDate });
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(409);
    expectUnchanged(await snapshot(entrant, show), before);
  });

  it('refuses a show that has not opened for entries yet (409) with no side effects', async () => {
    const entrant = await makeEntrant('early');
    const openDate = new Date(Date.now() + DAY_MS);
    const show = await makeShow({ openDate, closeDate: new Date(openDate.getTime() + 7 * DAY_MS) });
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(409);
    expectUnchanged(await snapshot(entrant, show), before);
  });

  it('refuses a show that is no longer open (status closed, 409) with no side effects', async () => {
    const entrant = await makeEntrant('closed');
    const show = await makeShow({ status: 'closed' });
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(409);
    expectUnchanged(await snapshot(entrant, show), before);
  });

  it('refuses a horse outside the show’s XP-level bracket (400) with no side effects', async () => {
    // horseXp 0 → level 1; the show only takes levels 5–10.
    const entrant = await makeEntrant('bracket', { horseXp: 0 });
    const show = await makeShow({ levelMin: 5, levelMax: 10 });
    const before = await snapshot(entrant, show);

    const res = await enter(entrant, show);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/level/i);
    expectUnchanged(await snapshot(entrant, show), before);
  });

  it('a repeated entry of the same horse is refused (409) and charges only once', async () => {
    const entrant = await makeEntrant('repeat');
    const show = await makeShow();
    const before = await snapshot(entrant, show);

    expect((await enter(entrant, show)).status).toBe(201);
    expect((await enter(entrant, show)).status).toBe(409);

    const after = await snapshot(entrant, show);
    expect(after.money).toBe(before.money - ENTRY_FEE);
    expect(after.feeEscrow).toBe(ENTRY_FEE);
    expect(after.entries).toHaveLength(1);
    expect(after.escrowCredits).toHaveLength(1);
    expect(after.entrantDebits).toHaveLength(1);
  });

  it('three concurrent entries of the same horse create one entry and charge once', async () => {
    const entrant = await makeEntrant('race');
    const show = await makeShow();
    const before = await snapshot(entrant, show);

    const responses = await Promise.all([enter(entrant, show), enter(entrant, show), enter(entrant, show)]);

    const statuses = responses.map(r => r.status);
    expect(statuses.filter(s => s === 201)).toHaveLength(1);
    expect(statuses.filter(s => s !== 201).every(s => s === 409)).toBe(true);
    const after = await snapshot(entrant, show);
    expect(after.money).toBe(before.money - ENTRY_FEE);
    expect(after.feeEscrow).toBe(ENTRY_FEE);
    expect(after.entries).toHaveLength(1);
    expect(after.escrowCredits).toHaveLength(1);
    expect(after.entrantDebits).toHaveLength(1);
  });
});
