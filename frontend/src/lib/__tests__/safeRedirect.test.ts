/**
 * safeRedirect utility — unit tests (CWE-601 open-redirect prevention)
 *
 * These tests exist to prove the validator FIRES on real attack payloads
 * before the implementation exists (failing-first per EDGE_CASE_FIX_DISCIPLINE §1)
 * and that it accepts legitimate relative paths after implementation.
 *
 * Equoria-rxkna
 */

import { describe, it, expect } from 'vitest';
import { isSafeRedirectPath, safeRedirectTarget } from '../safeRedirect';

// ── isSafeRedirectPath ───────────────────────────────────────────────────────

describe('isSafeRedirectPath', () => {
  // ── Attack vectors — must return false ────────────────────────────────────

  describe('rejects open-redirect attack vectors', () => {
    it('rejects protocol-relative URL //evil.com', () => {
      expect(isSafeRedirectPath('//evil.com')).toBe(false);
    });

    it('rejects protocol-relative URL //evil.com/path', () => {
      expect(isSafeRedirectPath('//evil.com/path')).toBe(false);
    });

    it('rejects absolute https URL', () => {
      expect(isSafeRedirectPath('https://evil.com')).toBe(false);
    });

    it('rejects absolute http URL', () => {
      expect(isSafeRedirectPath('http://evil.com')).toBe(false);
    });

    it('rejects javascript: scheme', () => {
      expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false);
    });

    it('rejects javascript: scheme with uppercase', () => {
      expect(isSafeRedirectPath('JAVASCRIPT:alert(1)')).toBe(false);
    });

    it('rejects javascript: scheme with mixed case', () => {
      expect(isSafeRedirectPath('JavaScript:void(0)')).toBe(false);
    });

    it('rejects data: scheme', () => {
      expect(isSafeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects data: scheme with uppercase', () => {
      expect(isSafeRedirectPath('DATA:text/html,evil')).toBe(false);
    });

    it('rejects vbscript: scheme', () => {
      expect(isSafeRedirectPath('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects backslash protocol-relative /\\evil.com', () => {
      expect(isSafeRedirectPath('/\\evil.com')).toBe(false);
    });

    it('rejects backslash protocol-relative /\\\\evil.com', () => {
      expect(isSafeRedirectPath('/\\\\evil.com')).toBe(false);
    });

    it('rejects percent-encoded double-slash %2f%2fevil.com', () => {
      expect(isSafeRedirectPath('%2f%2fevil.com')).toBe(false);
    });

    it('rejects percent-encoded double-slash uppercase %2F%2Fevil.com', () => {
      expect(isSafeRedirectPath('%2F%2Fevil.com')).toBe(false);
    });

    it('rejects mixed-encode //%2fevil.com', () => {
      expect(isSafeRedirectPath('//%2fevil.com')).toBe(false);
    });

    it('rejects percent-encoded backslash /%5cevil.com', () => {
      expect(isSafeRedirectPath('/%5cevil.com')).toBe(false);
    });

    it('rejects percent-encoded backslash uppercase /%5Cevil.com', () => {
      expect(isSafeRedirectPath('/%5Cevil.com')).toBe(false);
    });

    it('rejects http:\\\\server (backslash absolute)', () => {
      expect(isSafeRedirectPath('http:\\\\evil.com')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isSafeRedirectPath('')).toBe(false);
    });

    it('rejects null-ish via undefined-equivalent empty', () => {
      // TypeScript types guard null/undefined; test the string edge case
      expect(isSafeRedirectPath('  ')).toBe(false);
    });

    it('rejects a plain hostname without leading slash', () => {
      expect(isSafeRedirectPath('evil.com')).toBe(false);
    });

    it('rejects a bare hostname with path', () => {
      expect(isSafeRedirectPath('evil.com/steal')).toBe(false);
    });
  });

  // ── Legitimate paths — must return true ───────────────────────────────────

  describe('accepts safe relative paths', () => {
    it('accepts root /', () => {
      expect(isSafeRedirectPath('/')).toBe(true);
    });

    it('accepts /dashboard', () => {
      expect(isSafeRedirectPath('/dashboard')).toBe(true);
    });

    it('accepts /horses/123', () => {
      expect(isSafeRedirectPath('/horses/123')).toBe(true);
    });

    it('accepts /horses/123?tab=stats', () => {
      expect(isSafeRedirectPath('/horses/123?tab=stats')).toBe(true);
    });

    it('accepts path with hash /stable#overview', () => {
      expect(isSafeRedirectPath('/stable#overview')).toBe(true);
    });

    it('accepts /my-stable', () => {
      expect(isSafeRedirectPath('/my-stable')).toBe(true);
    });

    it('accepts deeply nested path /a/b/c/d', () => {
      expect(isSafeRedirectPath('/a/b/c/d')).toBe(true);
    });

    it('accepts path with query and hash /horses?breed=Andalusian#top', () => {
      expect(isSafeRedirectPath('/horses?breed=Andalusian#top')).toBe(true);
    });
  });

  // ── Scheme-substring false-positive regression (anchored startsWith fix) ──
  //
  // Prior to the fix the deny-list used `.includes(scheme)` which would reject
  // any path whose query/hash/path portion CONTAINED a scheme-like token even
  // though that token poses zero risk (navigate() is same-origin; only the
  // start of the string matters). These tests lock in the corrected behaviour.

  describe('accepts legitimate same-origin paths that contain scheme-like substrings', () => {
    it('accepts /help?topic=data:uri-explainer (scheme in query value)', () => {
      // Previously rejected because "data:" appeared via .includes()
      expect(isSafeRedirectPath('/help?topic=data:uri-explainer')).toBe(true);
    });

    it('accepts /article/about-javascript:basics (scheme-like token in path segment)', () => {
      // Previously rejected because "javascript:" appeared via .includes()
      expect(isSafeRedirectPath('/article/about-javascript:basics')).toBe(true);
    });

    it('accepts /page#section-http:foo (scheme-like token in hash)', () => {
      // Previously rejected because "http:" appeared via .includes() after decode
      expect(isSafeRedirectPath('/page#section-http:foo')).toBe(true);
    });

    it('accepts /docs?ref=blob:storage-explainer (blob: in query)', () => {
      expect(isSafeRedirectPath('/docs?ref=blob:storage-explainer')).toBe(true);
    });
  });

  // ── Dangerous scheme-PREFIXED inputs are still rejected (anchoring sanity) ─
  //
  // These are already rejected by the primary leading-"/" gate, but we assert
  // them explicitly here to prove the startsWith anchoring did not open a hole.

  describe('still rejects scheme-prefixed attack vectors after anchoring fix', () => {
    it('still rejects javascript:alert(1) — rejected by primary gate (no leading /)', () => {
      expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false);
    });

    it('still rejects data:text/html,<script>evil</script> — rejected by primary gate', () => {
      expect(isSafeRedirectPath('data:text/html,<script>evil</script>')).toBe(false);
    });

    it('still rejects vbscript:msgbox(1) — rejected by primary gate', () => {
      expect(isSafeRedirectPath('vbscript:msgbox(1)')).toBe(false);
    });

    it('still rejects blob:https://evil.com/token — rejected by primary gate', () => {
      expect(isSafeRedirectPath('blob:https://evil.com/token')).toBe(false);
    });
  });
});

// ── safeRedirectTarget ───────────────────────────────────────────────────────

describe('safeRedirectTarget', () => {
  const FALLBACK = '/';

  it('returns safe path unchanged', () => {
    expect(safeRedirectTarget('/dashboard', FALLBACK)).toBe('/dashboard');
  });

  it('returns fallback for //evil.com', () => {
    expect(safeRedirectTarget('//evil.com', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for https://evil.com', () => {
    expect(safeRedirectTarget('https://evil.com', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for javascript: attack', () => {
    expect(safeRedirectTarget('javascript:alert(1)', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for empty string', () => {
    expect(safeRedirectTarget('', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for undefined from', () => {
    expect(safeRedirectTarget(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for null from cast to unknown', () => {
    // Defensive: callers may pass null if state is poorly typed
    expect(safeRedirectTarget(null as unknown as string | undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('returns custom fallback when path is unsafe', () => {
    expect(safeRedirectTarget('//evil.com', '/home')).toBe('/home');
  });

  it('accepts /horses/42?tab=training with custom fallback', () => {
    expect(safeRedirectTarget('/horses/42?tab=training', '/home')).toBe(
      '/horses/42?tab=training'
    );
  });

  it('returns fallback for %2f%2fevil.com', () => {
    expect(safeRedirectTarget('%2f%2fevil.com', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for /\\evil.com backslash bypass', () => {
    expect(safeRedirectTarget('/\\evil.com', FALLBACK)).toBe(FALLBACK);
  });
});
