/**
 * preferencesRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-5: PATCH /api/v1/auth/profile/preferences
 *
 * Closes the missing persistence layer for the /settings page. Preferences
 * are persisted inside the existing User.settings JSONB under
 * `settings.preferences`. GET /api/v1/auth/profile flattens the object to
 * `user.preferences` in the response.
 *
 * Real-DB integration test — no mocks.
 *
 * Equoria-462kg (sibling of Equoria-hrzwh): this suite formerly created ONE
 * user in beforeAll and read/mutated it across SIX `it` blocks. Worse, the
 * "merges partial updates" and "GET includes preferences" tests were
 * implicitly ORDER-DEPENDENT — they asserted that keys persisted by an
 * EARLIER `it` survived. That coupling is both the fragility class this
 * issue targets (a concurrent broad delete could strand the shared user
 * mid-suite, every reserved test email being in the blast radius) AND a
 * test-isolation smell. The robust fix is structural: each test creates and
 * owns its OWN user via a beforeEach helper, tracked for id-scoped cleanup in
 * afterEach. The two formerly-chained tests now establish their own
 * prerequisite state on their own fresh user (the prior PATCH is performed
 * in-test), so every original assertion is preserved verbatim without
 * depending on a sibling `it` having run first.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
describe('INTEGRATION: PATCH /api/v1/auth/profile/preferences (21S-5)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  }, 120000);

  // Equoria-462kg: per-test user, tracked for id-scoped cleanup in afterEach.
  let user;
  let token;
  let createdUserIds;

  beforeEach(async () => {
    createdUserIds = [];
    const ts = `${Date.now()}_${process.pid}`;
    const created = await createTestUser({
      username: `prefs_${ts}`,
      email: `prefs_${ts}@test.com`,
    });
    user = created.user;
    token = created.token;
    createdUserIds.push(user.id);
  }, 120000);

  afterEach(async () => {
    // id-scoped cleanup of exactly the user this test created.
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('Auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .send({ emailCompetition: false });
      expect(res.status).toBe(401);
    });
  });

  describe('Valid updates', () => {
    it('persists notification + display preferences and returns the merged object', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({
          emailCompetition: false,
          emailBreeding: true,
          inAppTraining: false,
          reducedMotion: true,
          compactCards: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data?.preferences).toMatchObject({
        emailCompetition: false,
        emailBreeding: true,
        inAppTraining: false,
        reducedMotion: true,
        compactCards: true,
      });

      // Reload — row persisted in DB
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
      expect(fresh.settings.preferences).toMatchObject({
        emailCompetition: false,
        emailBreeding: true,
        inAppTraining: false,
        reducedMotion: true,
        compactCards: true,
      });
    });

    it('merges partial updates without clobbering previously-saved keys', async () => {
      // Establish the prior state on THIS test's own user (formerly relied on a
      // sibling `it` having run first). A non-default preferences object must
      // already exist so the partial update can be shown to preserve it.
      await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({
          emailCompetition: false,
          emailBreeding: true,
          inAppTraining: false,
          reducedMotion: true,
          compactCards: true,
        });

      // A partial update should preserve the prior keys and only change what was sent.
      const res = await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({ highContrast: true });

      expect(res.status).toBe(200);
      expect(res.body.data.preferences).toMatchObject({
        emailCompetition: false, // prior value preserved
        highContrast: true, // new value applied
      });
    });
  });

  describe('Validation', () => {
    it('rejects an unknown preference key with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({ notARealPreference: true });

      expect(res.status).toBe(400);
    });

    it('rejects a non-boolean value for a known key with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({ reducedMotion: 'nope' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/profile includes preferences', () => {
    it('returns the persisted preferences in the profile response', async () => {
      // Establish the persisted state on THIS test's own user (formerly relied
      // on earlier `it` blocks having mutated the shared user). Apply the same
      // two updates the chained tests above produced cumulatively.
      await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({
          emailCompetition: false,
          emailBreeding: true,
          inAppTraining: false,
          reducedMotion: true,
          compactCards: true,
        });
      await request(app)
        .patch('/api/v1/auth/profile/preferences')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`)
        .send({ highContrast: true });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toHaveProperty('preferences');
      expect(res.body.data.user.preferences).toMatchObject({
        emailCompetition: false,
        highContrast: true,
      });
    });
  });
});
