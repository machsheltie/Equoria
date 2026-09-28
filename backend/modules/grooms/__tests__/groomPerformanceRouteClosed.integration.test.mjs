/**
 * 🧪 REGRESSION: POST /api/v1/groom-performance/record is closed (Equoria-bvddn.6)
 *
 * Audit finding (2026-09-25): recordPerformance trusted client-supplied
 * bondGain, taskSuccess, wellbeingImpact and playerRating (validated only for
 * shape/range: express-validator bounds in groomPerformanceRoutes.mjs:32-62),
 * then wrote them straight into GroomPerformanceRecord via
 * recordGroomPerformance (groomPerformanceService.mjs:60-94) with zero
 * connection to a real groom/horse interaction. Those records feed
 * GET /api/v1/groom-performance/top (getTopPerformingGrooms ->
 * reputationScore, groomPerformanceService.mjs:396-424), so any authenticated
 * player could author fabricated bondGain/taskSuccess/playerRating rows to
 * inflate their own groom's reputationScore and rank at the top.
 *
 * No legitimate caller exists to preserve: the frontend never calls this
 * route (grep of frontend/src for "groom-performance" / "groomPerformance"
 * is empty), and the real interaction flow already writes performance
 * records server-side with server-derived values —
 * processInteractionWithPerformance (enhancedGroomInteractions.mjs:415-448)
 * computes bondGain/taskSuccess/wellbeingImpact from the actual interaction
 * effects and calls recordGroomPerformance() directly (the service function,
 * not the HTTP route) fire-and-forget. The POST route was a second,
 * player-authorable door onto the same table that the real path never uses.
 *
 * Per the Equoria-6p398.3 / Equoria-bvddn.1 / Equoria-bvddn.3 closed-route
 * precedent, this closes the route outright: POST answers 410 Gone for every
 * authenticated caller, before body validation runs. GET routes on this
 * router (config, top, groom/:id, analytics/:id) are read-only and were
 * never part of the exploit, so they are untouched.
 *
 * This suite proves, against the real database:
 * - An authenticated caller's POST is 410 Gone and creates NO
 *   GroomPerformanceRecord row (the audited exploit is dead).
 * - An anonymous caller still gets 401 (authenticateToken runs first).
 * - GET /top (read-only, not part of the exploit) still works.
 *
 * Before the fix, the first test in this file fails: the route answers 201
 * and persists the submitted (fabricated) performance values verbatim.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

describe('🔒 REGRESSION: POST /api/v1/groom-performance/record is closed (Equoria-bvddn.6)', () => {
  let user;
  let token;
  let groom;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `bvddn6-${randomBytes(4).toString('hex')}@test.com`,
        username: `bvddn6_${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Bvddn6',
        lastName: 'Tester',
        money: 1000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    groom = await prisma.groom.create({
      data: {
        name: `Bvddn6Groom-${Date.now()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: user.id,
      },
    });

    // Groom before user (Groom.userId is Restrict); GroomPerformanceRecord
    // cascades from groom deletion.
    cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('refuses an authenticated POST with 410 and creates no GroomPerformanceRecord row', async () => {
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        interactionType: 'grooming',
        bondGain: 10, // max allowed by the old shape-only validator
        taskSuccess: true,
        playerRating: 5, // max allowed by the old shape-only validator
      });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);

    const records = await prisma.groomPerformanceRecord.findMany({
      where: { groomId: groom.id },
    });
    expect(records).toHaveLength(0);
  });

  it('returns 401 for an anonymous POST (authenticateToken still runs first, no DB write)', async () => {
    const anonCsrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ groomId: groom.id, interactionType: 'grooming' });

    expect(res.status).toBe(401);

    const records = await prisma.groomPerformanceRecord.findMany({
      where: { groomId: groom.id },
    });
    expect(records).toHaveLength(0);
  });

  it('leaves GET /top (read-only, not part of the exploit) working', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/top')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.grooms)).toBe(true);
  });
});
