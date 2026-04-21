/**
 * preferencesRoutes.integration.test.mjs
 *
 * ATDD RED PHASE — Story 21S-5: PATCH /api/auth/profile/preferences
 *
 * Closes the missing persistence layer for the /settings page. Preferences
 * are persisted inside the existing User.settings JSONB under
 * `settings.preferences`. GET /api/auth/profile flattens the object to
 * `user.preferences` in the response.
 *
 * Real-DB integration test — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

describe('INTEGRATION: PATCH /api/auth/profile/preferences (21S-5)', () => {
  let user;
  let token;

  beforeAll(async () => {
    const ts = Date.now();
    const created = await createTestUser({
      username: `prefs_${ts}`,
      email: `prefs_${ts}@test.com`,
    });
    user = created.user;
    token = created.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).patch('/api/auth/profile/preferences').send({ emailCompetition: false });
      expect(res.status).toBe(401);
    });
  });

  describe('Valid updates', () => {
    it('persists notification + display preferences and returns the merged object', async () => {
      const res = await request(app)
        .patch('/api/auth/profile/preferences')
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
      // Prior test left the user with a non-default preferences object.
      // A partial update should preserve the prior keys and only change what was sent.
      const res = await request(app)
        .patch('/api/auth/profile/preferences')
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
        .patch('/api/auth/profile/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ notARealPreference: true });

      expect(res.status).toBe(400);
    });

    it('rejects a non-boolean value for a known key with 400', async () => {
      const res = await request(app)
        .patch('/api/auth/profile/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ reducedMotion: 'nope' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/profile includes preferences', () => {
    it('returns the persisted preferences in the profile response', async () => {
      const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toHaveProperty('preferences');
      expect(res.body.data.user.preferences).toMatchObject({
        emailCompetition: false,
        highContrast: true,
      });
    });
  });
});
