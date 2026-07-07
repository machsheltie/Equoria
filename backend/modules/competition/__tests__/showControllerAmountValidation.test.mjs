/**
 * showController createShow — non-integer amount validation (Equoria-3k96w).
 *
 * Sentinel-positive suite (EDGE_CASE_FIX_DISCIPLINE §1/§2). Lives in a dedicated
 * file rather than being appended to the already-baselined showController.test.mjs
 * (922 lines, at its file-size-doctrine cap) — this module already keeps several
 * focused showController* siblings (Concurrent, Koodu, RiderFlag, RiderModifier),
 * and adding here keeps the bounded fix from growing the god file past its ratchet.
 *
 * The defect: createShow validated entryFee/prize with typeof+isFinite+range but
 * never Number.isInteger. NOTE: the issue predicted a fractional amount surfaces as
 * a 500 via a Prisma Int mismatch — but empirically (verified against the canonical
 * DB, 2026-07-06) Prisma does NOT throw on a fractional value against an Int column:
 * it silently TRUNCATES (money decrement 100.5 -> 100; prize 100.5 stored as 100).
 * So the real pre-fix behavior is a silent 201-accept with the amount mangled, not
 * a 500. Both Int sides (User.money debit and SystemAccount.balance credit) truncate
 * identically, so money conservation is preserved — the defect is input hygiene: the
 * creator's intended amount is silently altered where a clean, actionable 400
 * belongs. Invariant (from the issue): amount inputs are validated as non-negative
 * INTEGERS at the boundary; validation failures are 400s.
 *
 * These tests FAIL on the pre-fix code (201) and PASS once Number.isInteger guards
 * the two existing 400 branches. A dedicated fresh user fixture keeps the
 * wallet-unchanged assertion deterministic (independent of any shared suite state).
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

describe('POST /api/v1/shows/create — non-integer amounts rejected at the 400 boundary (Equoria-3k96w)', () => {
  let user;
  let token;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `showint-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `showint${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'ShowInt',
        lastName: 'Tester',
        money: 50000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // Scoped, fail-loud cleanup (Equoria-1ohys). Sweep any show this user managed
    // to create BEFORE deleting the user (createdByUserId FK). If the guard works
    // there will be none — but scope defensively so a regression that lets a
    // fractional-amount show through cannot silently leak a row.
    cleanup.add(async () => {
      await prisma.show.deleteMany({ where: { createdByUserId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }, 'showIntUser');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('returns 400 (not 201) for a fractional prize, and the wallet is unchanged', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      // entryFee defaults to 0, so prize 100.5 clears the >=10x rule; the ONLY
      // reason for rejection is the fractional prize hitting the Int column.
      .send({ name: `TestFixture-FracPrize-${Date.now()}`, discipline: 'Dressage', prize: 100.5 });

    // The core sentinel: 400 (actionable validation). Fails on pre-fix code, which
    // returns 201 — it silently truncates the fractional prize and creates the show.
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/prize/i);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(before.money);
  });

  it('returns 400 (not 201) for a fractional entryFee, and the wallet is unchanged', async () => {
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      // prize 200 (integer) satisfies the >=10x rule (10 * 10.5 = 105); the ONLY
      // reason for rejection is the fractional entryFee hitting the Int column.
      .send({ name: `TestFixture-FracFee-${Date.now()}`, discipline: 'Dressage', entryFee: 10.5, prize: 200 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/entry fee/i);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(after.money).toBe(before.money);
  });

  // NOTE: the over-rejection guard (a valid INTEGER amount must still yield 201) is
  // intentionally NOT re-tested here. showController.test.mjs already covers it via
  // the "returns 201 when creating a valid show" test with entryFee:0 — and that
  // path, unlike a nonzero prize, credits NO money to SystemAccount[show_escrow], so
  // it leaves no orphaned escrow credit when its show fixture is deleted. A
  // nonzero-prize happy-path here WOULD orphan escrow (createShow credits show_escrow
  // at creation; a raw show-row delete never unwinds it), adding to the shared
  // singleton's pre-existing drift. isInteger(0)===isInteger(10)===true, so the
  // existing integer-create coverage already proves the guard does not over-reject.
});
