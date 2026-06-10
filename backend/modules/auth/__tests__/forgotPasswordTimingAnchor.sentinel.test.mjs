/**
 * 🔒 Sentinel — forgotPassword runs a constant-time bcrypt anchor on BOTH the
 *    registered-email and unknown-email branches (Equoria-54sk7,
 *    OWASP A07 — Identification & Authentication Failures).
 *
 * Why this exists
 * ───────────────
 * The prior timing-attack mitigation in passwordController.forgotPassword's
 * unknown-email branch was a pair of `SELECT pg_sleep(0)` statements — a
 * literal no-op that did NOT mirror the registered-email branch's real
 * UPDATE+INSERT cost, so response latency still leaked registration state
 * (account enumeration). Equoria-54sk7 replaces that ineffective "delay
 * padding" with a cryptographically sound constant-time anchor: a fixed-cost
 * `bcrypt.compare(TIMING_ANCHOR_INPUT, FAKE_BCRYPT_HASH)` run UNCONDITIONALLY
 * before the branch split, so the dominant deterministic CPU cost is identical
 * whether or not the email is registered. This mirrors the login handler's
 * FAKE_BCRYPT_HASH approach (authController, Equoria-gm4fg).
 *
 * What this sentinel asserts (BEHAVIOUR / INVOCATION, not wall-clock)
 * ──────────────────────────────────────────────────────────────────
 * Per the issue guidance ("assert on behaviour/invocation, not wall-clock
 * timing"), this suite spies on the third-party crypto primitive
 * `bcrypt.compare` (NOT our DB / controller / service — those all run for
 * real against the real test DB) and proves:
 *
 *   1. The UNKNOWN-email branch invokes `bcrypt.compare` against a bcrypt
 *      placeholder hash. If a future refactor short-circuits on `!user`
 *      BEFORE the anchor (re-introducing the enumeration oracle, or reverting
 *      to a pg_sleep / no-op pad), `bcrypt.compare` is never called on this
 *      branch and this test fails — that is its entire purpose
 *      (sentinel-positive per OPTIMAL_FIX_DISCIPLINE §2).
 *
 *   2. The REGISTERED-email branch ALSO invokes `bcrypt.compare` (the anchor
 *      runs unconditionally) and still persists a real reset-token row — so
 *      the anchor did not break the happy path.
 *
 *   3. The anchor is invoked against a *bcrypt hash* string (starts with the
 *      "$2" bcrypt identifier), proving it is a real constant-time compare and
 *      not a cheap string equality dressed up to look like one.
 *
 * Real DB, scoped fixtures (email startsWith 'testfixture-54sk7'), scoped
 * cleanup by collected userId. No bypass headers. No mocks of our own code.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// The forgot-password route validator runs normalizeEmail() (all_lowercase),
// so fixture emails MUST be already-lowercase or the controller findUnique
// misses the user. Username keeps a cased prefix; cleanup is by userId.
const EMAIL_PREFIX = 'testfixture-54sk7';
const USERNAME_PREFIX = 'TestFixture-54sk7';

const forgot = email =>
  request(app)
    .post('/api/v1/auth/forgot-password')
    .set('Origin', 'http://localhost:3000')
    .send({ email });

describe('🔒 Sentinel — forgotPassword constant-time bcrypt anchor (Equoria-54sk7)', () => {
  const createdUserIds = [];
  let knownEmail;

  beforeAll(async () => {
    const tag = randomBytes(6).toString('hex');
    knownEmail = `${EMAIL_PREFIX}-${tag}@example.com`;
    const password = await bcrypt.hash('AnchorPass1!', 1);
    const user = await prisma.user.create({
      data: {
        username: `${USERNAME_PREFIX}-${tag}`,
        email: knownEmail,
        password,
        firstName: 'Anchor',
        lastName: 'Sentinel',
        money: 0,
      },
    });
    createdUserIds.push(user.id);
  }, 60000);

  afterAll(async () => {
    if (createdUserIds.length) {
      // Scoped cleanup only — never broad (CLAUDE.md §3).
      await prisma.$executeRaw`DELETE FROM password_reset_tokens WHERE "userId" = ANY(${createdUserIds}::text[])`;
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 30000);

  it('UNKNOWN-email branch invokes bcrypt.compare against a bcrypt hash (anchor ran, no short-circuit)', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    try {
      const unknownEmail = `${EMAIL_PREFIX}-nobody-${randomBytes(6).toString('hex')}@example.com`;
      const res = await forgot(unknownEmail);

      // The handler must respond with the neutral 200 envelope (no enumeration
      // via status code either).
      expect(res.status).toBe(200);

      // The anchor MUST have been invoked at least once on this branch. If a
      // refactor short-circuits on !user before the anchor (the exact defect
      // this fix removes), the spy has zero calls and this assertion fails.
      expect(spy).toHaveBeenCalled();

      // Prove it is a REAL bcrypt compare against a bcrypt placeholder hash:
      // the second argument starts with the "$2" bcrypt identifier. A cheap
      // string-equality masquerading as a timing mitigation would not.
      const comparedAgainstBcryptHash = spy.mock.calls.some(
        ([, hash]) => typeof hash === 'string' && hash.startsWith('$2'),
      );
      expect(comparedAgainstBcryptHash).toBe(true);

      // No token row should be written for an unknown email (no side effect).
      const rows = await prisma.$queryRaw`
        SELECT id FROM password_reset_tokens WHERE email = ${unknownEmail}`;
      expect(rows.length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('REGISTERED-email branch ALSO invokes bcrypt.compare AND still persists a reset-token row', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    try {
      const res = await forgot(knownEmail);
      expect(res.status).toBe(200);

      // The unconditional anchor runs on the registered branch too.
      expect(spy).toHaveBeenCalled();
      const comparedAgainstBcryptHash = spy.mock.calls.some(
        ([, hash]) => typeof hash === 'string' && hash.startsWith('$2'),
      );
      expect(comparedAgainstBcryptHash).toBe(true);

      // Happy path intact: a real reset-token row was persisted for this user.
      const userId = createdUserIds[0];
      const rows = await prisma.$queryRaw`
        SELECT id FROM password_reset_tokens
        WHERE "userId" = ${userId} AND "usedAt" IS NULL`;
      expect(rows.length).toBeGreaterThanOrEqual(1);
    } finally {
      spy.mockRestore();
    }
  }, 30000);

  it('the pg_sleep(0) "delay padding" no-op is no longer present in the controller source', async () => {
    // Document-the-removal sentinel: the ineffective mitigation must be gone,
    // not merely supplemented. Reads the real controller source (no mock).
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const controllerPath = path.resolve(
      here,
      '..',
      'controllers',
      'passwordController.mjs',
    );
    const src = readFileSync(controllerPath, 'utf-8');
    expect(src).not.toMatch(/pg_sleep/);
    // The constant-time anchor helper must exist (the replacement is present).
    expect(src).toMatch(/runTimingAnchorCompare/);
    expect(src).toMatch(/FAKE_BCRYPT_HASH/);
  });
});
