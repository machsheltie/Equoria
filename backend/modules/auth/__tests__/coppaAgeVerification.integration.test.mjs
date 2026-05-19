/**
 * coppaAgeVerification.integration.test.mjs
 *
 * Equoria-iqzn — COPPA age verification at registration.
 *
 * COPPA (Children's Online Privacy Protection Act) prohibits collecting
 * personal data from children under 13 without verifiable parental consent.
 * This codebase has no parental-consent flow, so the compliant MVP is a
 * hard age gate: a user who states a DOB making them under 13 is rejected
 * BEFORE any user row (PII) is created, with a non-leaky message.
 *
 * AC coverage:
 *   1. Under-13 DOB → rejected, NO user row created.
 *   2. Exactly 13 today → allowed (boundary).
 *   3. Over-13 → allowed.
 *   4. Missing DOB → rejected (server-side enforced, fail-closed).
 *   5. DOB is NOT persisted in the audit log metadata (privacy).
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow, real DB.
 */

import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

/** ISO yyyy-mm-dd for `now` shifted back by `years` (and optional `days`). */
function dobYearsAgo(years, days = 0) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  if (days) {
    d.setUTCDate(d.getUTCDate() + days);
  }
  return d.toISOString().slice(0, 10);
}

describe('INTEGRATION: COPPA age verification at registration (Equoria-iqzn)', () => {
  const createdUserIds = [];
  let suiteStart;

  beforeAll(() => {
    suiteStart = new Date();
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.refreshToken
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.emailVerificationToken
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.auditLog
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    // Sweep audit rows for the rejected (no-userId) attempts created by this
    // suite — scoped to register path + this run's window + our tagged usernames.
    await prisma.auditLog
      .deleteMany({
        where: {
          path: { contains: '/auth/register' },
          createdAt: { gte: suiteStart },
          metadata: { path: ['username'], string_contains: 'coppa' },
        },
      })
      .catch(() => {});
  }, 60000);

  async function attemptRegister(dateOfBirth) {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('coppa');
    const email = `${username}@test.com`;
    const body = {
      username,
      email,
      password: 'StrongP@ssw0rd!23',
      firstName: 'Coppa',
      lastName: 'Tester',
    };
    if (dateOfBirth !== undefined) {
      body.dateOfBirth = dateOfBirth;
    }
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken)
      .send(body);
    if (res.body?.data?.user?.id) {
      createdUserIds.push(res.body.data.user.id);
    }
    return { res, username, email };
  }

  it('AC1: under-13 DOB is rejected AND no user row is created', async () => {
    const { res, email, username } = await attemptRegister(dobYearsAgo(10));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    // Non-leaky message — must not reveal exact computed age or DOB echo.
    expect(JSON.stringify(res.body)).toMatch(/13 or older/i);
    expect(JSON.stringify(res.body)).not.toMatch(/2[0-9]{3}-[0-9]{2}-[0-9]{2}/);
    // PII must NOT have been persisted.
    const u = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    expect(u).toBeNull();
  }, 60000);

  it('AC2: exactly 13 today is allowed (boundary)', async () => {
    // DOB exactly 13 years ago today → age === 13 → allowed.
    const { res } = await attemptRegister(dobYearsAgo(13));
    expect(res.status).toBe(201);
  }, 60000);

  it('AC2b: one day short of 13 is rejected (boundary, fail-closed)', async () => {
    // DOB 13y ago + 1 day → 13th birthday is tomorrow → still 12 → rejected.
    const { res, email, username } = await attemptRegister(dobYearsAgo(13, 1));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const u = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    expect(u).toBeNull();
  }, 60000);

  it('AC3: over-13 (adult) is allowed', async () => {
    const { res } = await attemptRegister(dobYearsAgo(30));
    expect(res.status).toBe(201);
  }, 60000);

  it('AC4: missing DOB is rejected (server authoritative, fail-closed)', async () => {
    const { res, email, username } = await attemptRegister(undefined);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const u = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    expect(u).toBeNull();
  }, 60000);

  it('AC4b: invalid/garbage DOB is rejected', async () => {
    const { res } = await attemptRegister('not-a-date');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  }, 60000);

  it('AC5: DOB is NOT persisted in audit log metadata (privacy)', async () => {
    const before = new Date();
    const dob = dobYearsAgo(25);
    const { res, username } = await attemptRegister(dob);
    expect(res.status).toBe(201);

    // The globalAuditTrail persists the register request body in metadata
    // via a fail-soft async write — give it a tick to land (same pattern as
    // the jw10w audit persistence suite).
    await new Promise(r => setTimeout(r, 300));

    const rows = await prisma.auditLog.findMany({
      where: {
        path: '/api/v1/auth/register',
        method: 'POST',
        createdAt: { gte: before },
        metadata: { path: ['username'], equals: username },
      },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      const blob = JSON.stringify(row.metadata ?? {});
      // The raw DOB value must never appear in the persisted audit metadata.
      expect(blob).not.toContain(dob);
      // The dateOfBirth key in the redacted requestBody must be [REDACTED].
      const body = row.metadata?.body;
      if (body && typeof body === 'object' && 'dateOfBirth' in body) {
        expect(body.dateOfBirth).toBe('[REDACTED]');
      }
    }
  }, 60000);
});
