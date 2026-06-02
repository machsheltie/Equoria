/**
 * 🔒 Admin MFA enforcement — real-DB integration (Equoria-te21j, OWASP A07)
 *
 * Equoria-2vwwh deferred AC item (5): optionally REQUIRE MFA for role=admin
 * accounts. This suite proves the policy layer:
 *
 *   - Flag OFF (default): admin without MFA reaches admin routes (no
 *     behavioral change vs. before — does not lock out existing admins).
 *   - Flag ON: admin WITHOUT mfaEnabled is blocked on admin routes with a
 *     clear 403 "admin MFA required" reason.
 *   - Flag ON: admin WITH mfaEnabled passes.
 *   - Flag ON: non-admin (role=user) is unaffected by the admin gate (they
 *     get the normal requireRole 403, not the MFA-specific message, and the
 *     gate must not crash on a non-admin).
 *
 * No mocks. Real Express app, real DB, real JWT. The env flag is toggled
 * per-test and restored.
 */

import request from 'supertest';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ADMIN_STATUS_ROUTE = '/api/v1/admin/cron/status';
const FLAG = 'ADMIN_MFA_REQUIRED';

describe('Admin MFA enforcement (Equoria-te21j)', () => {
  let adminNoMfa;
  let adminWithMfa;
  let normalUser;
  let adminNoMfaToken;
  let adminWithMfaToken;
  let normalUserToken;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const originalFlag = process.env[FLAG];
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-jgnqr): deletes only the three users
  // this suite created (read at run() time). A failed delete fails the suite
  // instead of leaking fixtures into the canonical DB. The env-flag restore
  // below is not a DB op and stays inline in afterAll.
  cleanup.add(
    () =>
      prisma.user.deleteMany({
        where: { id: { in: [adminNoMfa?.id, adminWithMfa?.id, normalUser?.id].filter(Boolean) } },
      }),
    'user',
  );

  beforeAll(async () => {
    const pw = await bcrypt.hash('AdminPassword123!', 1);

    adminNoMfa = await prisma.user.create({
      data: {
        username: `te21j_admin_nomfa_${ts}`,
        email: `te21j_admin_nomfa_${ts}@example.com`,
        password: pw,
        firstName: 'Te21j',
        lastName: 'Tester',
        role: 'admin',
        mfaEnabled: false,
      },
    });
    adminWithMfa = await prisma.user.create({
      data: {
        username: `te21j_admin_mfa_${ts}`,
        email: `te21j_admin_mfa_${ts}@example.com`,
        password: pw,
        firstName: 'Te21j',
        lastName: 'Tester',
        role: 'admin',
        mfaEnabled: true,
      },
    });
    normalUser = await prisma.user.create({
      data: {
        username: `te21j_user_${ts}`,
        email: `te21j_user_${ts}@example.com`,
        password: pw,
        firstName: 'Te21j',
        lastName: 'Tester',
        role: 'user',
        mfaEnabled: false,
      },
    });

    adminNoMfaToken = generateTestToken({ id: adminNoMfa.id, role: 'admin' });
    adminWithMfaToken = generateTestToken({ id: adminWithMfa.id, role: 'admin' });
    normalUserToken = generateTestToken({ id: normalUser.id, role: 'user' });
  }, 120000);

  afterAll(async () => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
    await cleanup.run();
  }, 120000);

  it('flag OFF (default): admin without MFA reaches the admin route', async () => {
    delete process.env[FLAG];
    const res = await request(app)
      .get(ADMIN_STATUS_ROUTE)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${adminNoMfaToken}`);
    expect(res.status).toBe(200);
  });

  it('flag ON: admin WITHOUT mfaEnabled is blocked with a clear 403', async () => {
    process.env[FLAG] = 'true';
    const res = await request(app)
      .get(ADMIN_STATUS_ROUTE)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${adminNoMfaToken}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/admin.*MFA.*required/i);
  });

  it('flag ON: admin WITH mfaEnabled passes', async () => {
    process.env[FLAG] = 'true';
    const res = await request(app)
      .get(ADMIN_STATUS_ROUTE)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${adminWithMfaToken}`);
    expect(res.status).toBe(200);
  });

  it('flag ON: non-admin user is unaffected (normal 403, not the MFA message, no crash)', async () => {
    process.env[FLAG] = 'true';
    const res = await request(app)
      .get(ADMIN_STATUS_ROUTE)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${normalUserToken}`);
    // requireRole('admin') rejects a 'user' before the MFA gate ever runs.
    expect(res.status).toBe(403);
    expect(String(res.body.message)).not.toMatch(/admin.*MFA.*required/i);
  });
});
