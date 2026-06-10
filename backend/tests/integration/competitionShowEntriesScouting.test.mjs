/**
 * GET /api/v1/competition/show/:showId/entries — Scouting endpoint integration
 * (Equoria-lfkw1, UX-spec 11.3.5 / Journey 4).
 *
 * Real app, real DB, real ShowEntry rows. NO mocks. Proves the scouting
 * endpoint returns the REAL entered field (breed/level/top-3-stats/owner +
 * count + days remaining), and handles empty / not-found / invalid correctly.
 *
 * The whole /api/v1/competition router is mounted under the app's authRouter
 * (authenticateToken), so requests carry a real Bearer token.
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../helpers/testAuth.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

describe('INTEGRATION: GET /api/v1/competition/show/:showId/entries (Equoria-lfkw1)', () => {
  let user;
  let authToken;
  let horseA;
  let horseB;
  let show;
  const createdEntryIds = [];

  const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${authToken}`);

  beforeAll(async () => {
    const u = await createTestUser({
      username: `scouting_${randomBytes(4).toString('hex')}`,
      email: `scouting_${randomBytes(6).toString('hex')}@example.com`,
      money: 5000,
      level: 5,
    });
    user = u.user;
    authToken = u.token;

    horseA = await createTestHorse({
      userId: user.id,
      name: `ScoutHorseA_${randomBytes(3).toString('hex')}`,
      age: 5,
      speed: 88,
      stamina: 70,
      focus: 64,
      agility: 40,
    });
    horseB = await createTestHorse({
      userId: user.id,
      name: `ScoutHorseB_${randomBytes(3).toString('hex')}`,
      age: 5,
      speed: 50,
      stamina: 90,
      balance: 80,
    });

    show = await createTestShow({
      name: 'ScoutingShow',
      discipline: 'Racing',
      entryFee: 100,
      prize: 1000,
      hostUserId: user.id,
      status: 'open',
      closeDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days out
      maxEntries: 10,
    });

    for (const h of [horseA, horseB]) {
      const e = await prisma.showEntry.create({
        data: { showId: show.id, horseId: h.id, userId: user.id, feePaid: 100 },
      });
      createdEntryIds.push(e.id);
    }
  });

  afterAll(async () => {
    // FK-ordered, scoped, fail-loud teardown (Equoria-d3ena).
    //
    // Order: show entries → (horses, shows, users via cleanupTestData).
    //   - ShowEntry rows are deleted FIRST, scoped to the ids this suite
    //     created. (They also cascade-delete from Horse/Show, so this is
    //     belt-and-suspenders, but keeping it explicit + scoped is harmless
    //     and documents intent.)
    //   - cleanupTestData() then deletes the tracked horses → shows → users in
    //     FK-safe order (Horse.userId is onDelete: Restrict, so horses go
    //     before users). These fixtures come from createTestUser/createTestHorse
    //     (direct creates), so there is NO register-flow starter horse to leak.
    //
    // No silent no-op catch arm on the show-entry delete: createCleanupTracker
    // surfaces a failed delete as a loud aggregated error rather than swallowing
    // a leak into the canonical DB (CLAUDE.md §2).
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { id: { in: createdEntryIds } } }), 'show entries');
    cleanup.add(() => cleanupTestData(), 'tracked horses/shows/users');
    await cleanup.run();
  });

  it('returns the real entered field with breed/level/top-3-stats/owner + header', async () => {
    const res = await get(`/api/v1/competition/show/${show.id}/entries`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entryCount).toBe(2);
    expect(res.body.maxEntries).toBe(10);
    expect(res.body.daysRemaining).toBeGreaterThan(0);
    expect(res.body.daysRemaining).toBeLessThanOrEqual(3);
    expect(res.body.show.discipline).toBe('Racing');

    expect(res.body.entries).toHaveLength(2);
    const a = res.body.entries.find(e => e.horseId === horseA.id);
    expect(a).toBeTruthy();
    expect(a.ownerName).toBe(user.username);
    expect(a.level).not.toBeNull();
    expect(a.topStats).toHaveLength(3);
    // Top stat for horseA must be speed (88) — proves REAL stats, not stubbed.
    expect(a.topStats[0].name).toBe('speed');
    expect(a.topStats[0].value).toBe(88);
    // topStats are sorted descending.
    expect(a.topStats[0].value).toBeGreaterThanOrEqual(a.topStats[1].value);
    expect(a.topStats[1].value).toBeGreaterThanOrEqual(a.topStats[2].value);
  });

  it('returns an empty field (count 0) for a show with no entries', async () => {
    const emptyShow = await createTestShow({
      name: 'EmptyScoutingShow',
      discipline: 'Dressage',
      status: 'open',
      hostUserId: user.id,
    });
    const res = await get(`/api/v1/competition/show/${emptyShow.id}/entries`);
    expect(res.status).toBe(200);
    expect(res.body.entryCount).toBe(0);
    expect(res.body.entries).toEqual([]);
  });

  it('404s for a non-existent show', async () => {
    const res = await get('/api/v1/competition/show/999999999/entries');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('400s for an invalid show id', async () => {
    const res = await get('/api/v1/competition/show/not-a-number/entries');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
