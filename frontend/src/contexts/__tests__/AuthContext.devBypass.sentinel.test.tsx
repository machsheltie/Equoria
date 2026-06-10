/**
 * AuthContext dev-auth-bypass production-safety sentinel (Equoria-c3n0u).
 *
 * The `VITE_DEV_BYPASS_AUTH` path in AuthContext returns a mock authenticated
 * user so a developer can skip login during local UI review. This sentinel
 * proves — at two layers — that the bypass is structurally impossible in a
 * production build, and FAILS if a future edit could let it leak into prod.
 *
 * Layer 1 (behavioral): `isDevBypassActive()` is the pure mirror of the gate
 *   predicate. We assert that a production-shaped env (DEV:false / PROD:true)
 *   yields `false` EVEN WHEN `VITE_DEV_BYPASS_AUTH === 'true'`. This is the
 *   core property: the opt-in flag is inert in production.
 *
 * Layer 2 (structural): we read the AuthContext source and assert the inline
 *   `DEV_BYPASS` call-site keeps `import.meta.env.DEV === true` as the LEADING
 *   conjunct. That literal is what Vite statically replaces with `false` in a
 *   production build, short-circuiting the `&&` to the literal `false` so the
 *   `if (DEV_BYPASS)` branch is removed by dead-code elimination. If someone
 *   drops/reorders that guard (e.g. keys the bypass off only the env flag),
 *   the production bundle could ship an active bypass — and this layer fails.
 *
 * Sentinel-positive proof (by construction — the lead runs this suite):
 *   - Layer 1 FAILS if `isDevBypassActive` drops the DEV guard (e.g. becomes
 *     `env.VITE_DEV_BYPASS_AUTH === 'true'`): the production-env case
 *     (`{ DEV: false, VITE_DEV_BYPASS_AUTH: 'true' }`) then returns `true`,
 *     and `expect(...).toBe(false)` trips. With the guard present it returns
 *     `false`, so the suite is green only while production is unbypassable.
 *   - Layer 2 FAILS if the source `DEV_BYPASS` assignment is rewritten to omit
 *     `import.meta.env.DEV === true`: the leading-conjunct regex then finds no
 *     match and `expect(source).toMatch(...)` trips.
 *   (Real DB N/A — this is a frontend build-time guard; no backend / Prisma
 *   surface is involved. This worktree has no node_modules; the lead executes
 *   the suite under vitest at integration.)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isDevBypassActive } from '../AuthContext';

const SOURCE_PATH = resolve(__dirname, '../AuthContext.tsx');

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

  describe('Layer 2 — structural: the call-site keeps the static tree-shake guard', () => {
    const source = readFileSync(SOURCE_PATH, 'utf-8');

    it('defines DEV_BYPASS with `import.meta.env.DEV === true` as the leading conjunct', () => {
      // This exact literal is what Vite replaces with `false` in production,
      // collapsing the `&&` to a literal `false` and eliminating the branch.
      // The regex requires DEV === true to be the FIRST conjunct AND the flag
      // check to follow via `&&` — i.e. the production guard cannot be dropped
      // or moved after the flag check without failing here.
      expect(source).toMatch(
        /const\s+DEV_BYPASS\s*=\s*import\.meta\.env\.DEV\s*===\s*true\s*&&\s*import\.meta\.env\.VITE_DEV_BYPASS_AUTH\s*===\s*'true'\s*;/
      );
    });

    it('gates the mock-user branch behind the DEV_BYPASS constant', () => {
      // The branch that returns the mock authenticated user must be guarded by
      // the DEV_BYPASS constant (not by the raw env flag directly), so the
      // single statically-eliminated constant governs reachability.
      expect(source).toMatch(/if\s*\(\s*DEV_BYPASS\s*\)\s*\{/);
    });

    it('does not gate the bypass on the env flag alone anywhere in the source', () => {
      // A direct `VITE_DEV_BYPASS_AUTH === 'true'` check that is NOT paired
      // with the leading DEV guard would be a production-reachable bypass.
      // Strip the one legitimate documented occurrence (the DEV-guarded
      // call-site assignment) and assert no other flag check remains.
      const withoutGuardedCallSite = source.replace(
        /import\.meta\.env\.DEV\s*===\s*true\s*&&\s*import\.meta\.env\.VITE_DEV_BYPASS_AUTH\s*===\s*'true'/g,
        ''
      );
      // The pure helper references the flag via the `env` parameter (not
      // `import.meta.env`), so an `import.meta.env.VITE_DEV_BYPASS_AUTH` flag
      // check should no longer appear once the guarded call-site is removed.
      expect(withoutGuardedCallSite).not.toMatch(
        /import\.meta\.env\.VITE_DEV_BYPASS_AUTH\s*===\s*'true'/
      );
    });
  });
});
