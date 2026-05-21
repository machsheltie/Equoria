/**
 * Sentinel-positive integration test for settings shape-validation on
 * PUT /api/v1/users/:id (Equoria-bddjw, CWE-915 nested-write hardening).
 *
 * Background: the top-level `settings` key is allow-listed by the prior
 * C1 / Equoria-qia4j fix, but its CONTENTS were written verbatim — letting a
 * client inject arbitrary nested keys / oversized blobs and clobber
 * server-owned state. This suite proves the contents are now constrained to
 * the same known-key surface the sibling /auth/profile +
 * /auth/profile/preferences paths enforce (shared ALLOWED_PREFERENCE_KEYS).
 *
 * FAILING TEST FIRST (EDGE_CASE_FIX_DISCIPLINE §1 / OPTIMAL_FIX_DISCIPLINE §2):
 *   - The "MUST reject unknown settings key" + "MUST reject unknown preference
 *     key" + "MUST reject oversized blob" tests FAIL against the un-patched
 *     controller (which persisted them verbatim with HTTP 200).
 *   - They are sentinel-positive: deleting validateSettingsPayload from the
 *     controller makes them fail again.
 *
 * No bypass headers. Real auth token. Real CSRF. Real DB writes + re-reads.
 * Scoped fixture cleanup. Co-located per module-test convention.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

/** Unique hex suffix so parallel test runs never collide on username/email. */
const uid = () => randomBytes(4).toString('hex');

let user;
let token;

beforeAll(async () => {
  const suffix = `${uid()}${uid()}`;
  user = await prisma.user.create({
    data: {
      email: `testfixture-settingsshape-${suffix}@test.com`,
      username: `TestFixture-settingsshape-${suffix}`,
      password: '$2b$12$originalHashThatShouldNeverChange.XXXXXXXXXXXXXXXXXXXXX',
      firstName: 'Legit',
      lastName: 'User',
      money: 500,
      role: 'user',
      // Seed server-owned settings state we expect to survive a settings update.
      settings: {
        completedOnboarding: true,
        onboardingStep: 3,
        milestones: { firstHorse: true },
        inventory: { hay: 42 },
        preferences: { emailSystem: true },
      },
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30_000);

afterAll(async () => {
  // Scoped cleanup — only the row this suite created.
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30_000);

/**
 * Send PUT /api/v1/users/:id with full auth (JWT + CSRF) and return the
 * response plus a fresh DB read of the user row.
 */
async function doPut(body) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN });
  const res = await request(app)
    .put(`/api/v1/users/${user.id}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  return { res, fresh };
}

describe('PUT /api/v1/users/:id — settings shape validation (Equoria-bddjw)', () => {
  // ─── Sentinel-positive: arbitrary nested keys MUST be rejected ──────────────

  it('MUST reject an unknown top-level settings key', async () => {
    const { res, fresh } = await doPut({ settings: { isAdmin: true, evil: 'payload' } });

    expect(res.status).toBe(400);
    // Nothing arbitrary persisted.
    expect(fresh.settings.isAdmin).toBeUndefined();
    expect(fresh.settings.evil).toBeUndefined();
  });

  it('MUST reject an unknown preference key inside settings.preferences', async () => {
    const { res, fresh } = await doPut({ settings: { preferences: { hackedPref: true } } });

    expect(res.status).toBe(400);
    expect(fresh.settings.preferences.hackedPref).toBeUndefined();
  });

  it('MUST reject a non-primitive (nested-object) preference value', async () => {
    const { res } = await doPut({
      settings: { preferences: { emailSystem: { nested: 'object' } } },
    });
    expect(res.status).toBe(400);
  });

  it('MUST reject a non-object settings value', async () => {
    const { res } = await doPut({ settings: 'not-an-object' });
    expect(res.status).toBe(400);
  });

  it('MUST reject an oversized settings blob (unbounded-blob guard)', async () => {
    // ~5 KB string under a (would-be) display key — well over the 4 KB cap.
    const huge = 'x'.repeat(5000);
    const { res, fresh } = await doPut({ settings: { display: { highContrast: huge } } });

    expect(res.status).toBe(400);
    // The huge value must not have been written.
    const stored = fresh.settings.display?.highContrast;
    expect(stored).not.toBe(huge);
  });

  // ─── Positive-path: known-key contents MUST be accepted + merged ────────────

  it('MUST accept known notifications/display/preferences keys', async () => {
    const { res, fresh } = await doPut({
      settings: {
        preferences: { inAppTraining: false },
        display: { reducedMotion: true },
        notifications: { something: true },
      },
    });

    expect(res.status).toBe(200);
    expect(fresh.settings.preferences.inAppTraining).toBe(false);
    expect(fresh.settings.display.reducedMotion).toBe(true);
    expect(fresh.settings.notifications.something).toBe(true);
  });

  it('MUST preserve server-owned settings keys (no clobber) and merge preferences', async () => {
    const { res, fresh } = await doPut({
      settings: { preferences: { inAppNews: true } },
    });

    expect(res.status).toBe(200);
    // Server-owned keys survive the update.
    expect(fresh.settings.completedOnboarding).toBe(true);
    expect(fresh.settings.onboardingStep).toBe(3);
    expect(fresh.settings.milestones).toMatchObject({ firstHorse: true });
    expect(fresh.settings.inventory).toMatchObject({ hay: 42 });
    // New preference merged in WITHOUT clobbering the pre-seeded one.
    expect(fresh.settings.preferences.inAppNews).toBe(true);
    expect(fresh.settings.preferences.emailSystem).toBe(true);
  });
});
