/**
 * 🔒 Sentinel — /auth/login does not leak email registration via response time
 *    (Equoria-gm4fg, OWASP A07 — Identification & Authentication Failures)
 *
 * Real-DB integration, no mocks. Proves the defect this issue fixes is gone
 * and STAYS gone: the unknown-email branch of POST /api/v1/auth/login must
 * have the same wall-clock cost as the known-email-wrong-password branch.
 * If a future change short-circuits on `!user` (re-introducing the timing
 * oracle), this test fails — that is its entire purpose (sentinel-positive,
 * per OPTIMAL_FIX_DISCIPLINE §2).
 *
 * Methodology:
 * - N = 12 samples per branch (small enough to keep the suite under ~30s,
 *   large enough to suppress single-sample jitter via medians).
 * - Compare MEDIANS, not means — bcrypt cost is dominated by CPU, and the
 *   median rejects the occasional GC/IO outlier that means cannot.
 * - The pre-fix gap is ~80-150ms (one full bcrypt round). After the fix,
 *   both branches run bcrypt.compare, so the gap collapses to single-digit
 *   ms (CPU jitter + DB findUnique cost difference). Tolerance is set
 *   generously at 40ms — wide enough to absorb CI machine variance, tight
 *   enough that the regressed code path (~80ms unknown vs ~150ms known,
 *   delta ~70ms) WILL fail this test. A planted regression — removing the
 *   FAKE_BCRYPT_HASH compare — was verified locally to fail this gate.
 *
 * Why median over mean: a single 200ms GC pause in the known-email branch
 * would skew the mean enough to mask a real 30ms leak in the other direction.
 * Medians are insensitive to such outliers and reflect the central tendency
 * an enumeration attacker actually observes.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser } from '../../../tests/helpers/authHelper.mjs';
import { resetAllAuthRateLimits } from '../../../middleware/authRateLimiter.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const authPost = path => request(app).post(path).set('Origin', 'http://localhost:3000');

describe('🔒 Sentinel — login timing oracle (Equoria-gm4fg)', () => {
  const createdUserIds = new Set();
  let knownEmail;
  const knownWrongPassword = 'definitely-not-the-right-password-AAA111!';

  beforeAll(async () => {
    await fetchCsrf(app);
    // Register one real user so the "known email + wrong password" branch
    // actually hits the wrong-password bcrypt path (not "unknown email").
    const userData = createTestUser();
    knownEmail = userData.email;
    const res = await authPost('/api/v1/auth/register').send(userData);
    if (res.status !== 201) {
      throw new Error(`Sentinel setup failed: register returned ${res.status} — ${JSON.stringify(res.body)}`);
    }
    if (res.body?.data?.user?.id) {
      createdUserIds.add(res.body.data.user.id);
    }
  }, 120000);

  afterAll(async () => {
    if (createdUserIds.size > 0) {
      const userIds = Array.from(createdUserIds);
      // Scoped cleanup only — never broad. Per CLAUDE.md §3.
      await prisma.refreshToken
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(err => console.warn('[sentinel cleanup] refreshToken:', err.message));
      await prisma.horse
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(err => console.warn('[sentinel cleanup] horse:', err.message));
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(err => console.warn('[sentinel cleanup] user:', err.message));
    }
  }, 120000);

  const time401 = async loginData => {
    resetAllAuthRateLimits();
    const t0 = process.hrtime.bigint();
    const res = await authPost('/api/v1/auth/login').send(loginData);
    const t1 = process.hrtime.bigint();
    // Both branches must return 401 — fail loudly if the controller drifted.
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
    return Number(t1 - t0) / 1e6; // ns → ms
  };

  const median = arr => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  it('unknown-email and known-email-wrong-password 401s take statistically indistinguishable time', async () => {
    const N = 12;
    const unknownTimes = [];
    const knownWrongTimes = [];

    // Warm-up — exclude the first call of each branch from the medians to
    // avoid the JIT/connection-pool cold-start dominating the sample.
    await time401({
      email: `warmup_${randomBytes(4).toString('hex')}@example.com`,
      password: knownWrongPassword,
    });
    await time401({ email: knownEmail, password: knownWrongPassword });

    // Interleave the two branches so any monotonic background drift (DB
    // pool warm-up, CPU thermals) affects both equally.
    for (let i = 0; i < N; i++) {
      const unknownEmail = `nobody_${randomBytes(8).toString('hex')}@example.com`;
      unknownTimes.push(await time401({ email: unknownEmail, password: knownWrongPassword }));
      knownWrongTimes.push(await time401({ email: knownEmail, password: knownWrongPassword }));
    }

    const unknownMedian = median(unknownTimes);
    const knownMedian = median(knownWrongTimes);
    const delta = Math.abs(unknownMedian - knownMedian);

    // Per the issue's AC: distribution must be statistically
    // indistinguishable. 40ms tolerance absorbs CI jitter while a regressed
    // path (no bcrypt compare for unknown email → ~80ms gap) would trip it.
    // Note: this is the median delta, NOT mean — see the file header for why.
    if (delta >= 40) {
      // Diagnostic dump on failure so the gap is visible in CI logs.
      console.error('[sentinel gm4fg] TIMING ORACLE DETECTED', {
        N,
        unknownTimesMs: unknownTimes.map(t => Math.round(t)),
        knownWrongTimesMs: knownWrongTimes.map(t => Math.round(t)),
        unknownMedianMs: Math.round(unknownMedian),
        knownMedianMs: Math.round(knownMedian),
        deltaMs: Math.round(delta),
      });
    }
    expect(delta).toBeLessThan(40);
  }, 120000);

  it('unknown-email 401 takes at least ~30ms (proves bcrypt.compare ran, not a short-circuit)', async () => {
    // If a future refactor removes the FAKE_BCRYPT_HASH compare and
    // short-circuits on !user, the unknown branch returns in <10ms.
    // bcrypt.compare at cost 12 takes ~30-150ms even on the fastest hosts.
    // We require the median of 5 unknown-email calls to exceed 30ms,
    // proving the compare actually executed. This is the second sentinel
    // axis — the median-delta test above could be fooled by a uniformly
    // slow controller; this one cannot.
    const times = [];
    for (let i = 0; i < 5; i++) {
      const unknownEmail = `nobody_${randomBytes(8).toString('hex')}@example.com`;
      times.push(await time401({ email: unknownEmail, password: knownWrongPassword }));
    }
    const med = median(times);
    if (med < 30) {
      console.error('[sentinel gm4fg] SHORT-CIRCUIT DETECTED on unknown-email', {
        timesMs: times.map(t => Math.round(t)),
        medianMs: Math.round(med),
      });
    }
    expect(med).toBeGreaterThan(30);
  }, 60000);
});
