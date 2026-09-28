/**
 * 🧪 REGRESSION: PUT /api/v1/grooms/:id/bonus-traits is closed (Equoria-bvddn.3)
 *
 * Audit finding (2026-09-25): `assignBonusTraits` only checked the shape of
 * the submitted map (≤3 traits, ≤0.3 bonus each) — it never checked the
 * service's own earning conditions (bond >= 60, >= 75% assignment window
 * coverage, groomBonusTraitService.mjs:29-30/236-237). Any authenticated
 * owner of a groom could PUT arbitrary bonus traits — including three
 * ultra-rare/exotic trait names at 0.3 each — straight into
 * `Groom.bonusTraitMap` with zero play, which also made the groom
 * immediately eligible for the `any-with-3-rare-bonuses` rare-trait booster
 * perk (backend/utils/groomRareTraitPerks.mjs:173-181, evaluatePerkEligibility)
 * without ever earning it.
 *
 * No player caller exists (frontend/src only reads `groom.bonusTraitMap` to
 * render GroomBonusTraitPanel; it never PUTs this route) and no server-side
 * caller exists either — `assignBonusTraits` is invoked only from
 * `groomBonusTraitsController.updateGroomBonusTraits`, i.e. only from this
 * route. The real earned-bonus path (`checkBonusEligibility`, consumed by
 * `traitAssignmentLogic.mjs`) computes probability bonuses at trait-roll time
 * and never writes `bonusTraitMap`. Per the owner's default ruling
 * ("Were players ever meant to author a groom's bonusTraitMap? ... no —
 * close the route"), this closes PUT outright, mirroring the horse-XP
 * (Equoria-6p398.3) and user-XP (Equoria-bvddn.1) closed-route precedent.
 *
 * This suite proves, against the real database:
 * - An authenticated owner's PUT is 410 Gone and leaves `Groom.bonusTraitMap`
 *   completely unchanged (the audited exploit is dead).
 * - An anonymous caller still gets 401.
 * - GET /:id/bonus-traits (read-only, not part of the exploit) is untouched
 *   and still returns 200 with the groom's existing bonus traits.
 *
 * Before the fix, the first test in this file fails: the route answers 200
 * and persists the submitted (unearned) bonus traits, including three rare
 * trait names that would also unlock the rare-trait booster perk.
 */

import { randomBytes } from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('🔒 REGRESSION: PUT /api/v1/grooms/:id/bonus-traits is closed (Equoria-bvddn.3)', () => {
  let __csrf__;
  let testUser;
  let testGroom;
  let authToken;

  const uid = () => randomBytes(8).toString('hex');

  beforeEach(async () => {
    testUser = await prisma.user.create({
      data: {
        username: `bvddn3_${uid()}`,
        firstName: 'Test',
        lastName: 'User',
        email: `bvddn3_${uid()}@example.com`,
        password: 'hashedpassword',
        money: 10000,
        xp: 100,
        level: 2,
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: `BvddnGroom_${uid()}`,
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        sessionRate: 25.0,
        bonusTraitMap: {
          sensitive: 0.2,
          noble: 0.1,
          quick_learner: 0.15,
        },
        userId: testUser.id,
      },
    });

    const tokenPayload = { id: testUser.id, username: testUser.username, email: testUser.email };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars', {
      expiresIn: '1h',
    });
    authToken = `Bearer ${token}`;

    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  });

  afterEach(async () => {
    if (testGroom) {
      await prisma.groom.deleteMany({ where: { id: testGroom.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  it('refuses an owner PUT with 410 and leaves bonusTraitMap unchanged, even for 3 rare traits', async () => {
    // Three ultra-rare/exotic trait names at the max per-trait bonus — the
    // exact shape that used to unlock the rare-trait booster perk for free.
    const exploitBonusTraits = {
      phoenix_touch: 0.3,
      whisperer: 0.3,
      once_in_generation: 0.3,
    };

    const response = await request(app)
      .put(`/api/v1/grooms/${testGroom.id}/bonus-traits`)
      .set('Authorization', authToken)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ bonusTraits: exploitBonusTraits });

    expect(response.status).toBe(410);
    expect(response.body.success).toBe(false);

    const persisted = await prisma.groom.findUnique({
      where: { id: testGroom.id },
      select: { bonusTraitMap: true },
    });
    expect(persisted.bonusTraitMap).toEqual({
      sensitive: 0.2,
      noble: 0.1,
      quick_learner: 0.15,
    });
  });

  it('returns 401 for an anonymous PUT (no DB change)', async () => {
    const anonCsrf = await fetchCsrf(app);

    const response = await request(app)
      .put(`/api/v1/grooms/${testGroom.id}/bonus-traits`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ bonusTraits: { confident: 0.25 } });

    expect(response.status).toBe(401);

    const persisted = await prisma.groom.findUnique({
      where: { id: testGroom.id },
      select: { bonusTraitMap: true },
    });
    expect(persisted.bonusTraitMap).toEqual({
      sensitive: 0.2,
      noble: 0.1,
      quick_learner: 0.15,
    });
  });

  it('leaves GET /:id/bonus-traits (read-only, not part of the exploit) working', async () => {
    const response = await request(app)
      .get(`/api/v1/grooms/${testGroom.id}/bonus-traits`)
      .set('Authorization', authToken)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.bonusTraits).toEqual({
      sensitive: 0.2,
      noble: 0.1,
      quick_learner: 0.15,
    });
  });
});
