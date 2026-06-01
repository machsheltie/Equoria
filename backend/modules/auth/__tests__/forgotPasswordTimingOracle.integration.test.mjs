/**
 * forgotPassword timing-oracle sentinel (Equoria-dv1lv).
 *
 * Before fix: the user branch did
 *   crypto.randomBytes + hashPasswordResetToken
 *   await prisma.$transaction(UPDATE + INSERT)
 *   await emailService.sendPasswordResetEmail   ← tens to hundreds of ms
 * while the no-user branch returned immediately. Response duration was a
 * usable timing oracle for registered-email enumeration.
 *
 * Fix:
 *   1) Email send is fire-and-forget AFTER the controller has already
 *      responded (the dominant timing variance is now off the request
 *      critical path).
 *   2) The no-user branch carries equivalent sync DB work (randomBytes +
 *      hash + 2-statement read-only $transaction) to mirror the
 *      user-branch latency before responding.
 *
 * Sentinel: time N requests for known-good vs known-bad emails. We do NOT
 * run a full Mann-Whitney U inside a jest sentinel (too flaky on CI noise);
 * we use a strict-but-pragmatic median-ratio bound. Pre-fix the medians
 * would differ by 10-100x because the email send dominates; post-fix the
 * medians should be within a small multiplicative factor.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-dv1lv';
const N_SAMPLES = 8; // small N to keep CI runtime sane; medians are robust at this size

let user;
let csrf;
const createdUserIds = [];

beforeAll(async () => {
  csrf = await fetchCsrf(app);
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Timing',
      lastName: 'Oracle',
      money: 0,
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.$executeRawUnsafe(
      'DELETE FROM password_reset_tokens WHERE "userId" = ANY($1::text[])',
      createdUserIds,
    );
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}, 30000);

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function timedForgotPassword(email) {
  // Use a fresh CSRF token per request to avoid the rate-limit on
  // /forgot-password masking timing differences. CSRF fetch happens OUTSIDE
  // the timed block.
  const fresh = await fetchCsrf(app);
  const start = process.hrtime.bigint();
  await request(app)
    .post('/api/v1/auth/forgot-password')
    .set('Origin', 'http://localhost:3000')
    .set('Cookie', fresh.cookieHeader)
    .set('X-CSRF-Token', fresh.csrfToken)
    .send({ email });
  const end = process.hrtime.bigint();
  return Number(end - start) / 1e6; // ms
}

describe('forgotPassword timing oracle (Equoria-dv1lv, Equoria-3cuv9)', () => {
  it('SENTINEL: median response time for known-good vs unknown email is within 3x', async () => {
    const goodSamples = [];
    const badSamples = [];
    for (let i = 0; i < N_SAMPLES; i++) {
      // Interleave so any system-wide warm-up affects both samples equally.
      goodSamples.push(await timedForgotPassword(user.email));
      badSamples.push(await timedForgotPassword(`unknown-${randomBytes(4).toString('hex')}@example.com`));
    }
    const goodMedian = median(goodSamples);
    const badMedian = median(badSamples);

    // Pre-fix shape: goodMedian was 5-50x badMedian because the email
    // send (10s-100s of ms) was on the user branch only. Post-fix:
    // email send is fire-and-forget, no-user branch has dummy work,
    // so both branches should be in the same order of magnitude.
    // The 3x bound is intentionally GENEROUS to avoid CI flakes from
    // GC pauses or network blips while still firing if either fix
    // regressed.
    const hi = Math.max(goodMedian, badMedian);
    const lo = Math.min(goodMedian, badMedian);
    logger.info(
      `[dv1lv timing sentinel] goodMedian=${goodMedian.toFixed(2)}ms badMedian=${badMedian.toFixed(2)}ms ratio=${(hi / lo).toFixed(2)}`,
    );
    expect(hi / lo).toBeLessThan(3);
  }, 120000);

  it('SENTINEL (Equoria-3cuv9): median delta known-vs-unknown < 20ms (mirrors loginTimingOracle pattern)', async () => {
    // Adjacent sibling of Equoria-gm4fg (login timing oracle). The login
    // sentinel asserts a 40ms delta because bcrypt-compare jitter dominates
    // the central tendency there. The forgotPassword branch does NOT run
    // bcrypt-compare; both branches do randomBytes + hashPasswordResetToken
    // + a 2-statement $transaction, so the residual delta is just the gap
    // between the read-only pg_sleep(0) statements and the real UPDATE +
    // INSERT in the user branch. Empirically that gap is ~1-3ms; we assert
    // a strict 20ms bound, which fires loudly if either:
    //   - the email send regresses back ONTO the request critical path
    //     (would dominate by 100ms+), or
    //   - the no-user branch ever short-circuits before the dummy work
    //     (would make the known branch ~3-5ms slower in steady state).
    // The 20ms bound matches the AC literal for Equoria-3cuv9.
    const goodSamples = [];
    const badSamples = [];
    // Warm-up to defeat JIT / pool-connection cold start dominating sample 0.
    await timedForgotPassword(user.email);
    await timedForgotPassword(`warmup-${randomBytes(4).toString('hex')}@example.com`);
    for (let i = 0; i < N_SAMPLES; i++) {
      goodSamples.push(await timedForgotPassword(user.email));
      badSamples.push(await timedForgotPassword(`unknown-${randomBytes(4).toString('hex')}@example.com`));
    }
    const goodMedian = median(goodSamples);
    const badMedian = median(badSamples);
    const delta = Math.abs(goodMedian - badMedian);
    if (delta >= 20) {
      console.error('[Equoria-3cuv9 sentinel] TIMING ORACLE DETECTED', {
        goodTimesMs: goodSamples.map(t => Math.round(t * 100) / 100),
        badTimesMs: badSamples.map(t => Math.round(t * 100) / 100),
        goodMedianMs: goodMedian,
        badMedianMs: badMedian,
        deltaMs: delta,
      });
    }
    logger.info(
      `[3cuv9 timing sentinel] goodMedian=${goodMedian.toFixed(2)}ms badMedian=${badMedian.toFixed(2)}ms delta=${delta.toFixed(2)}ms`,
    );
    expect(delta).toBeLessThan(20);
  }, 180000);
});
