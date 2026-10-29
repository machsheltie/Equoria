/**
 * A horse's first-ever win, marked on the player's results (Equoria-oey96.41).
 *
 * Owner ruling 2026-10-23: the backend marks a horse's first win; the results
 * screen celebrates it once with the CinematicMoment, and repeat wins show the
 * normal result. The mark is derived from the horse's settled results — its
 * earliest 1st place — so no new column is needed and a horse can only ever
 * have one first win. Each row also says whether the player has opened it yet
 * (the viewedAt latch), which is what lets the screen celebrate only once.
 *
 * Real Express app, real JWT, real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const SUITE = 'TestFixture-firstWin';

let token;
let horseA;
let horseB;
let showOld;
let showMid;
let showNew;

let ownerId;

const seed = (horseId, show, placement, runDate, viewedAt = null) =>
  prisma.competitionResult.create({
    data: {
      horseId,
      showId: show.id,
      score: 80,
      placement,
      discipline: show.discipline,
      runDate,
      showName: show.name,
      prizeWon: 100,
      horsePointsAwarded: placement === 1 ? 10 : 5,
      viewedAt,
      // Equoria-r9q06 (owner ruling q256): settlement records the entrant; here the owner entered.
      entrantUserId: ownerId,
    },
  });

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const created = await createTestUser({
    username: `${SUITE}-u-${tag}`,
    email: `${SUITE}-u-${tag}@example.com`,
  });
  token = created.token;
  ownerId = created.user.id;
  horseA = await createTestHorse({ name: `${SUITE}-A-${tag}`, userId: created.user.id });
  horseB = await createTestHorse({ name: `${SUITE}-B-${tag}`, userId: created.user.id });
  showOld = await createTestShow({ name: `${SUITE}-Old-${tag}`, discipline: 'Dressage' });
  showMid = await createTestShow({ name: `${SUITE}-Mid-${tag}`, discipline: 'Dressage' });
  showNew = await createTestShow({ name: `${SUITE}-New-${tag}`, discipline: 'Dressage' });

  // Horse A won its first show long ago (already opened) and has won again since.
  await seed(horseA.id, showOld, 1, new Date('2026-05-01T10:00:00Z'), new Date('2026-05-02T10:00:00Z'));
  await seed(horseA.id, showMid, 1, new Date('2026-06-01T10:00:00Z'));
  // Horse B was second in that show, then won for the first time (not yet opened).
  await seed(horseB.id, showMid, 2, new Date('2026-06-01T10:00:00Z'));
  await seed(horseB.id, showNew, 1, new Date('2026-07-01T10:00:00Z'));
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

async function myRows() {
  const res = await request(app)
    .get('/api/v1/competition/user-results')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', 'http://localhost:3000');
  expect(res.status).toBe(200);
  const rows = new Map();
  for (const summary of res.body.results) {
    for (const row of summary.userResults) {
      rows.set(`${summary.competitionId}:${row.horseId}`, row);
    }
  }
  return rows;
}

describe('first-ever win on GET /api/v1/competition/user-results (Equoria-oey96.41)', () => {
  it("marks each horse's earliest 1st place, and only that one, as its first win", async () => {
    const rows = await myRows();

    expect(rows.get(`${showOld.id}:${horseA.id}`)).toMatchObject({ rank: 1, isFirstWin: true });
    expect(rows.get(`${showMid.id}:${horseA.id}`)).toMatchObject({ rank: 1, isFirstWin: false });
    expect(rows.get(`${showMid.id}:${horseB.id}`)).toMatchObject({ rank: 2, isFirstWin: false });
    expect(rows.get(`${showNew.id}:${horseB.id}`)).toMatchObject({ rank: 1, isFirstWin: true });
  });

  it('says whether the player has opened each result yet', async () => {
    const rows = await myRows();

    expect(rows.get(`${showOld.id}:${horseA.id}`).viewed).toBe(true);
    expect(rows.get(`${showNew.id}:${horseB.id}`).viewed).toBe(false);
  });

  it('keeps the first win on the earliest result after later wins are opened', async () => {
    await prisma.competitionResult.updateMany({
      where: { showId: { in: [showMid.id, showNew.id] }, horseId: { in: [horseA.id, horseB.id] } },
      data: { viewedAt: new Date() },
    });
    const rows = await myRows();

    expect(rows.get(`${showNew.id}:${horseB.id}`)).toMatchObject({ isFirstWin: true, viewed: true });
    expect(rows.get(`${showMid.id}:${horseA.id}`)).toMatchObject({ isFirstWin: false, viewed: true });
  });
});
