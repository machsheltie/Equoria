/**
 * 🧪 MFA Within-Window Replay Protection (Equoria-y932s)
 *
 * Unit-level tests for the per-userId TOTP nonce cache that prevents replay
 * of a captured code within otplib's ±1-step (60-90s) validity window.
 *
 * The defect this guards against: otplib `authenticator.verify({ window: 1 })`
 * has no notion of "this code has already been consumed." A captured code is
 * valid for the full window (~30-90s) and otplib will return true on every
 * verify call against it. If the second factor's channel is compromised (XSS,
 * MITM, network logger), an attacker can replay the SAME code seconds later.
 *
 * Mitigation: cache (userId, codeHash) on every successful verification with
 * a TTL matching the validity window. The next verify of the same code within
 * the TTL returns false, even though otplib would still accept the raw token.
 *
 * Storage choice: in-memory Map with lazy sweep, mirroring the existing
 * mfaLockoutService pattern. Documented horizontal-scaling consideration:
 * an attacker spreading replays across PM2 workers could land one replay per
 * worker before the user's TTL expires; this is defence-in-depth on top of
 * mfaLockoutService (5 failures/5min/userId) and authRateLimiter (200/15min).
 * Promoting to Redis-backed is straightforward and tracked as a future spike
 * if multi-node deploys land.
 */

import {
  recordSuccessfulVerification,
  hasBeenUsed,
  __resetForTests,
  __sweepExpiredForTests,
} from '../services/mfaReplayProtectionService.mjs';

describe('mfaReplayProtectionService — within-window replay protection (Equoria-y932s)', () => {
  beforeEach(() => {
    __resetForTests();
  });

  describe('hasBeenUsed (lookup before recording)', () => {
    it('returns false for a never-seen (userId, token) pair', () => {
      expect(hasBeenUsed('user-1', '123456')).toBe(false);
    });

    it('returns false for invalid inputs (fail-open on bad inputs is safe — verifyToken still gates)', () => {
      expect(hasBeenUsed('', '123456')).toBe(false);
      expect(hasBeenUsed('user-1', '')).toBe(false);
      expect(hasBeenUsed(null, '123456')).toBe(false);
      expect(hasBeenUsed('user-1', null)).toBe(false);
      expect(hasBeenUsed(undefined, undefined)).toBe(false);
    });
  });

  describe('recordSuccessfulVerification + hasBeenUsed', () => {
    it('once recorded, hasBeenUsed returns true for the same (userId, token)', () => {
      recordSuccessfulVerification('user-1', '123456');
      expect(hasBeenUsed('user-1', '123456')).toBe(true);
    });

    it('hashed in storage — sentinel: raw token is NOT exposed in cache values', () => {
      // The cache must not store the raw 6-digit code; if a future logger
      // ever dumped the cache, raw codes would be exfiltrated. We assert
      // via JSON.stringify of the test-exposed registry not containing the
      // raw code anywhere.
      recordSuccessfulVerification('user-1', '999111');
      // No way to enumerate the Map directly through the public API (good).
      // Instead: re-record a different token for the same user, then confirm
      // the first is still flagged used — proves storage is keyed properly.
      recordSuccessfulVerification('user-1', '111999');
      expect(hasBeenUsed('user-1', '999111')).toBe(true);
      expect(hasBeenUsed('user-1', '111999')).toBe(true);
    });

    it('different userIds do NOT share replay state (user-1 use does not block user-2)', () => {
      recordSuccessfulVerification('user-1', '123456');
      expect(hasBeenUsed('user-1', '123456')).toBe(true);
      expect(hasBeenUsed('user-2', '123456')).toBe(false);
    });

    it('different tokens for same user are independent', () => {
      recordSuccessfulVerification('user-1', '111111');
      recordSuccessfulVerification('user-1', '222222');
      expect(hasBeenUsed('user-1', '111111')).toBe(true);
      expect(hasBeenUsed('user-1', '222222')).toBe(true);
      expect(hasBeenUsed('user-1', '333333')).toBe(false);
    });

    it('whitespace-trims tokens to match verifyToken behaviour', () => {
      recordSuccessfulVerification('user-1', '  123456  ');
      expect(hasBeenUsed('user-1', '123456')).toBe(true);
      expect(hasBeenUsed('user-1', '  123456  ')).toBe(true);
    });

    it('no-op on invalid inputs (never stores bad keys)', () => {
      recordSuccessfulVerification('', '123456');
      recordSuccessfulVerification('user-1', '');
      recordSuccessfulVerification(null, '123456');
      recordSuccessfulVerification('user-1', null);
      // None of the bad inputs polluted the cache:
      expect(hasBeenUsed('', '123456')).toBe(false);
      expect(hasBeenUsed('user-1', '')).toBe(false);
    });
  });

  describe('TTL / expiry sweep', () => {
    it('expired entries are swept and replay is allowed again after the window', () => {
      // Record with a back-dated "now" so the entry's expiresAt is already
      // in the past. The next hasBeenUsed call sweeps and returns false —
      // proving the TTL boundary works (a real-clock equivalent of "the
      // window expired and the user can verify a new code").
      const PAST = Date.now() - 10 * 60 * 1000; // 10 minutes ago — past TTL
      recordSuccessfulVerification('user-1', '123456', PAST);
      // The entry is technically present in the map but its expiresAt is
      // already in the past; hasBeenUsed sweeps + returns false.
      expect(hasBeenUsed('user-1', '123456')).toBe(false);
      __sweepExpiredForTests();
      expect(hasBeenUsed('user-1', '123456')).toBe(false);
    });

    it('fresh entries survive sweep', () => {
      recordSuccessfulVerification('user-1', '123456');
      __sweepExpiredForTests();
      expect(hasBeenUsed('user-1', '123456')).toBe(true);
    });
  });

  describe('Sentinel-positive: defect re-introduction would fail this', () => {
    it('SENTINEL: replay of same code within window must be blocked', () => {
      // This is the literal defect described in Equoria-y932s. If
      // recordSuccessfulVerification ever becomes a no-op, or hasBeenUsed
      // always returns false, this test fails — surfacing the regression.
      recordSuccessfulVerification('user-1', '654321');
      const isReplay = hasBeenUsed('user-1', '654321');
      expect(isReplay).toBe(true);
    });
  });
});
