/**
 * Conformation settlement takes its locks in the entry's order: the player's
 * User row before the Groom row (Equoria-mwjst.1, Codex re-review 2026-11-19
 * finding #2).
 *
 * The defect: the entry transaction locks the entrant's User row, then the
 * presenting Groom row. The settlement locked every participating Groom, then
 * credited the creator's User row with the fees. A creator whose groom
 * presents a horse in their own due show, while they enter that groom into
 * another conformation show, ran the two locks in opposite orders: Postgres
 * broke the deadlock by aborting one of them, and the player got a 503.
 *
 * The interleaving is forced, not timed: a second client holds the groom's
 * growth-profile row (which the settlement updates right after locking the
 * groom), so the settlement is held with the groom in hand; the entry is then
 * started and observed queued behind it through pg_blocking_pids of the holder
 * only (rowLockBarrier). Releasing lets both finish, or deadlock.
 *
 * Real app, real JWT, real CSRF, real entry route, real settlement, real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';
import { ensureGrowthProfileTx } from '../../../services/staffGrowthService.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const fixturePrefix = 'TestFixture-mwjst1-lockorder';
const ORIGIN = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
const entryFee = 120;

const tag = randomBytes(4).toString('hex');
let csrf;
let barrierClient;
let seq = 0;
const groomIds = [];
const assignmentIds = [];

async function makePlayer(label) {
  seq += 1;
  return createTestUser({
    username: `${fixturePrefix}-${label}-${seq}-${tag}`,
    email: `${fixturePrefix}-${label}-${seq}-${tag}@example.com`,
    money: 1000,
  });
}

async function makeHorse(user, label) {
  seq += 1;
  const now = new Date();
  return createTestHorse({
    name: `${fixturePrefix}-${label}-${seq}-${tag}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
  });
}

/** Assign `groom` to `horse`, five days ago (long enough to present it). */
async function assign(user, groom, horse) {
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * dayMs),
    },
  });
  assignmentIds.push(assignment.id);
}

async function makeShow(createdByUserId) {
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * dayMs);
  return createTestShow({
    name: `${fixturePrefix}-show`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    createdByUserId,
  });
}

function enterHttp(token, horse, groom, show) {
  return request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

beforeAll(async () => {
  barrierClient = createBarrierClient();
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await barrierClient.$disconnect();
  await prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await cleanupTestData();
}, 60000);

describe('conformation settlement lock order (Equoria-mwjst.1, Codex #2)', () => {
  it('a creator entering their groom while it presents in their own settling show: both finish', async () => {
    const { user: creator, token } = await makePlayer('creator');
    const { user: host } = await makePlayer('host');
    const groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${tag}`,
        speciality: 'showHandling',
        personality: 'gentle',
        skillLevel: 'expert',
        user: { connect: { id: creator.id } },
      },
    });
    groomIds.push(groom.id);
    await prisma.$transaction(tx => ensureGrowthProfileTx(tx, 'groom', groom.id));
    const shownHorse = await makeHorse(creator, 'shown');
    const nextHorse = await makeHorse(creator, 'next');
    await assign(creator, groom, shownHorse);
    await assign(creator, groom, nextHorse);

    // The creator's own show, entered with the groom, now due.
    const ownShow = await makeShow(creator.id);
    const entered = await enterHttp(token, shownHorse, groom, ownShow);
    expect(entered.status).toBe(201);
    await prisma.show.update({
      where: { id: ownShow.id },
      data: { closeDate: new Date(Date.now() - 60 * 1000), runDate: new Date(Date.now() - 60 * 1000) },
    });
    // Another player's show, still open.
    const otherShow = await makeShow(host.id);
    const before = await money(creator.id);

    // Hold the settlement with the groom row in hand, then start the entry
    // that needs the same groom and the same player.
    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "groomId" FROM "groom_growth_profiles" WHERE "groomId" = ${groom.id} FOR UPDATE`,
    );
    let settling;
    let entering;
    try {
      settling = executeConformationShow(ownShow.id).then(
        results => ({ results }),
        error => ({ error }),
      );
      await barrier.waitForQueued(1);
      entering = Promise.resolve(enterHttp(token, nextHorse, groom, otherShow));
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [settled, entry] = await Promise.all([settling, entering]);

    // Neither is aborted: the settlement scored the show and paid its fees,
    // and the entry was taken.
    expect(settled.error).toBeUndefined();
    expect(settled.results).toHaveLength(1);
    expect(entry.status).toBe(201);
    const own = await prisma.show.findUnique({ where: { id: ownShow.id } });
    expect(own.status).toBe('completed');
    expect(own.feeEscrow).toBe(0);
    expect(await prisma.showEntry.count({ where: { showId: otherShow.id, horseId: nextHorse.id } })).toBe(1);
    // The fee it paid into the other show is the fee it was paid back as creator.
    expect(await money(creator.id)).toBe(before);
  }, 90000);
});
