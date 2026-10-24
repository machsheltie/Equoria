/**
 * A show's Horse Points reach the XP pages at once (Equoria-7vhgr).
 *
 * The horse XP routes (GET /api/v1/horses/:id/xp and /:id/xp-history) cache
 * their answer for 60 seconds. The nightly executor awards Horse Points inside
 * each entry's settlement transaction but never dropped those caches, so an
 * owner who looked at the horse before the show saw the pre-show XP for up to
 * a minute after it settled. Settlement now invalidates both caches after the
 * transaction commits.
 *
 * Real DB, real routes (supertest, real JWT), real cache helper, scoped
 * fixtures.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';

const origin = 'http://localhost:3000';
const fx = createFundedShowFixtures('TestFixture-7vhgr');

afterAll(() => fx.cleanup(), 60000);

describe('XP caches after a show settles (Equoria-7vhgr)', () => {
  it("the horse's XP status and history show the new Horse Points straight away", async () => {
    const show = await fx.buildClosedShow({ prize: 1000, entryFee: 100, entrantCount: 1 });
    const [{ owner, horse }] = show.entrants;
    const token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    const get = path =>
      request(app)
        .get(`/api/v1/horses/${horse.id}${path}`)
        .set('Origin', origin)
        .set('Authorization', `Bearer ${token}`);

    // The owner looks before the show runs: both answers are now cached.
    const statusBefore = await get('/xp');
    expect(statusBefore.status).toBe(200);
    expect(statusBefore.body.data.currentXP).toBe(0);
    const historyBefore = await get('/xp-history');
    expect(historyBefore.status).toBe(200);
    expect(historyBefore.body.data.events).toHaveLength(0);

    await executeClosedShows({ body: { showIds: [show.showId] } }, null);

    // The only entrant won: 10 Horse Points, one XP event.
    const statusAfter = await get('/xp');
    expect(statusAfter.body.data.currentXP).toBe(10);
    const historyAfter = await get('/xp-history');
    expect(historyAfter.body.data.events).toHaveLength(1);
    expect(historyAfter.body.data.events[0].amount).toBe(10);
  }, 60000);
});
