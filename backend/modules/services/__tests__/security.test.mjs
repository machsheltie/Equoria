/**
 * Unit tests for backend/middleware/security.mjs
 *
 * Exercises both exports:
 *   - helmetConfig: directive presence + ZAP-remediation invariants
 *   - addSecurityHeaders: each defense-in-depth header is set per request
 *
 * NO MOCKS. The middleware is a pure function with no DB/IO; we exercise it
 * directly with a stub req/res/next.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { helmetConfig, addSecurityHeaders } from '../../../middleware/security.mjs';

describe('middleware/security — helmetConfig', () => {
  it('exposes a contentSecurityPolicy with no `https:` wildcard in img-src (ZAP 10055)', () => {
    const imgSrc = helmetConfig.contentSecurityPolicy.directives.imgSrc ?? [];
    expect(imgSrc).not.toContain('https:');
  });

  it('declares baseUri / formAction / frameAncestors explicitly (defense in depth)', () => {
    const d = helmetConfig.contentSecurityPolicy.directives;
    expect(d.baseUri).toEqual(["'self'"]);
    expect(d.formAction).toEqual(["'self'"]);
    expect(d.frameAncestors).toEqual(["'none'"]);
  });

  it('uses crossOriginEmbedderPolicy=credentialless (ZAP 90004 + cross-origin imgs)', () => {
    expect(helmetConfig.crossOriginEmbedderPolicy).toEqual({ policy: 'credentialless' });
  });

  it('configures HSTS with preload (1y, includeSubDomains, preload)', () => {
    expect(helmetConfig.hsts).toEqual({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    });
  });

  // -------------------------------------------------------------------------
  // CSP shape sentinels — ADR-008 (Equoria-e3k9)
  // style-src 'unsafe-inline' is an ACCEPTED, documented residual (Radix
  // runtime style injection via react-style-singleton; static-SPA serving
  // model has no per-request nonce path). These sentinels do NOT assert the
  // residual is gone — they lock the shape so the accepted-risk decision
  // cannot silently rot into something WORSE (script-src unsafe-inline,
  // a wildcard creeping into style-src/script-src, etc.).
  // -------------------------------------------------------------------------
  describe('CSP shape sentinels (ADR-008)', () => {
    const directives = () => helmetConfig.contentSecurityPolicy.directives;

    it('script-src never contains unsafe-inline or unsafe-eval (high-sev XSS path stays blocked)', () => {
      const scriptSrc = directives().scriptSrc ?? [];
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(scriptSrc).toEqual(["'self'"]);
    });

    it('style-src has the documented accepted-risk shape (self + unsafe-inline, NO wildcard)', () => {
      const styleSrc = directives().styleSrc ?? [];
      // ADR-008 accepted residual: 'unsafe-inline' is present BY DECISION.
      expect(styleSrc).toContain("'self'");
      expect(styleSrc).toContain("'unsafe-inline'");
      // Anti-broadening: no scheme wildcard may creep into style-src.
      expect(styleSrc).not.toContain('https:');
      expect(styleSrc).not.toContain('http:');
      expect(styleSrc).not.toContain('*');
      expect(styleSrc).not.toContain('data:');
    });

    it('object-src / frame-src / frame-ancestors remain locked to none', () => {
      const d = directives();
      expect(d.objectSrc).toEqual(["'none'"]);
      expect(d.frameSrc).toEqual(["'none'"]);
      expect(d.frameAncestors).toEqual(["'none'"]);
    });

    it('no directive uses a bare * wildcard (broadening guard across all directives)', () => {
      for (const [name, value] of Object.entries(directives())) {
        expect(Array.isArray(value)).toBe(true);
        // name is interpolated into the directive list so a failure points at
        // the offending directive even without expect()'s message arg.
        expect({ directive: name, values: value }).not.toMatchObject({
          values: expect.arrayContaining(['*']),
        });
      }
    });
  });
});

describe('middleware/security — addSecurityHeaders', () => {
  let res;
  let next;
  const setHeaders = () => {
    const headers = {};
    res = {
      setHeader: (k, v) => {
        headers[k] = v;
      },
      _headers: headers,
    };
    next = () => {
      next.called = true;
    };
    next.called = false;
  };

  beforeEach(setHeaders);

  it('sets X-Frame-Options=DENY', () => {
    addSecurityHeaders({}, res, next);
    expect(res._headers['X-Frame-Options']).toBe('DENY');
  });

  it('sets X-Content-Type-Options=nosniff', () => {
    addSecurityHeaders({}, res, next);
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets X-XSS-Protection=1; mode=block', () => {
    addSecurityHeaders({}, res, next);
    expect(res._headers['X-XSS-Protection']).toBe('1; mode=block');
  });

  it('sets Referrer-Policy=strict-origin-when-cross-origin', () => {
    addSecurityHeaders({}, res, next);
    expect(res._headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy locking down camera/microphone/geolocation', () => {
    addSecurityHeaders({}, res, next);
    expect(res._headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('sets HSTS only in production', () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      addSecurityHeaders({}, res, next);
      expect(res._headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('does NOT set HSTS in non-production environments', () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      addSecurityHeaders({}, res, next);
      expect(res._headers['Strict-Transport-Security']).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('always calls next() to continue the middleware chain', () => {
    addSecurityHeaders({}, res, next);
    expect(next.called).toBe(true);
  });
});
