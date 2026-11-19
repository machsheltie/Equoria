/**
 * AuthContext dev-auth-bypass production safety (Equoria-c3n0u).
 *
 * The `VITE_DEV_BYPASS_AUTH` path in AuthContext returns a mock authenticated
 * user so a developer can skip login during local UI review. This suite drives
 * `isDevBypassActive()`, the pure mirror of the gate predicate, and asserts
 * that a production-shaped env (DEV:false / PROD:true) yields `false` EVEN
 * WHEN `VITE_DEV_BYPASS_AUTH === 'true'`: the opt-in flag is inert in
 * production.
 *
 * It FAILS if `isDevBypassActive` drops the DEV guard (e.g. becomes
 * `env.VITE_DEV_BYPASS_AUTH === 'true'`): the production-env case
 * (`{ DEV: false, VITE_DEV_BYPASS_AUTH: 'true' }`) then returns `true`.
 */

import { describe, it, expect } from 'vitest';
import { isDevBypassActive } from '../AuthContext';

describe('AuthContext dev-bypass production-safety sentinel (Equoria-c3n0u)', () => {
  describe('Layer 1 — behavioral: isDevBypassActive() gate predicate', () => {
    it('is INERT in a production build even when the flag is set to "true"', () => {
      // Production build: Vite sets DEV=false / PROD=true. The opt-in flag
      // accidentally present in a prod .env MUST NOT reactivate the bypass.
      expect(isDevBypassActive({ DEV: false, VITE_DEV_BYPASS_AUTH: 'true' })).toBe(false);
    });

    it('is active ONLY in development mode with the flag explicitly "true"', () => {
      expect(isDevBypassActive({ DEV: true, VITE_DEV_BYPASS_AUTH: 'true' })).toBe(true);
    });

    it('is inert in development when the flag is absent or not exactly "true"', () => {
      expect(isDevBypassActive({ DEV: true })).toBe(false);
      expect(isDevBypassActive({ DEV: true, VITE_DEV_BYPASS_AUTH: 'false' })).toBe(false);
      expect(isDevBypassActive({ DEV: true, VITE_DEV_BYPASS_AUTH: '1' })).toBe(false);
      expect(isDevBypassActive({ DEV: true, VITE_DEV_BYPASS_AUTH: 'TRUE' })).toBe(false);
    });

    it('is inert in production regardless of the flag value', () => {
      expect(isDevBypassActive({ DEV: false, VITE_DEV_BYPASS_AUTH: 'true' })).toBe(false);
      expect(isDevBypassActive({ DEV: false })).toBe(false);
      expect(isDevBypassActive({ DEV: false, VITE_DEV_BYPASS_AUTH: '1' })).toBe(false);
    });
  });
});
