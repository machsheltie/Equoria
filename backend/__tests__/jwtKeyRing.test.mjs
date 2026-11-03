/**
 * jwtKeyRing — unit tests (Equoria-gjdj)
 *
 * JWT signing-key rotation: tokens are signed with the CURRENT secret;
 * verification accepts the current OR an optional PREVIOUS secret during a
 * rotation overlap window. Unknown secrets are rejected.
 *
 * Pure functions over env vars + jsonwebtoken. No DB.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { getSigningSecret, verifyWithKeyRing, hasPreviousSecret } from '../utils/jwtKeyRing.mjs';

const currentAccess = 'current-access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const previousAccess = 'previous-access-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const currentRefresh = 'current-refresh-secret-cccccccccccccccccccccccccccc';
const previousRefresh = 'previous-refresh-secret-dddddddddddddddddddddddddddd';
const UNKNOWN = 'totally-unrelated-secret-eeeeeeeeeeeeeeeeeeeeeeeeeeee';

const snapshot = {};
const envKeys = ['JWT_SECRET', 'JWT_SECRET_PREVIOUS', 'JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET_PREVIOUS'];

beforeEach(() => {
  for (const k of envKeys) {
    snapshot[k] = process.env[k];
  }
  process.env.JWT_SECRET = currentAccess;
  process.env.JWT_REFRESH_SECRET = currentRefresh;
  delete process.env.JWT_SECRET_PREVIOUS;
  delete process.env.JWT_REFRESH_SECRET_PREVIOUS;
});

afterEach(() => {
  for (const k of envKeys) {
    if (snapshot[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = snapshot[k];
    }
  }
});

describe('getSigningSecret', () => {
  it('returns the current access secret for kind=access', () => {
    expect(getSigningSecret('access')).toBe(currentAccess);
  });

  it('returns the current refresh secret for kind=refresh', () => {
    expect(getSigningSecret('refresh')).toBe(currentRefresh);
  });

  it('NEVER returns the previous secret for signing (sign with current only)', () => {
    process.env.JWT_SECRET_PREVIOUS = previousAccess;
    expect(getSigningSecret('access')).toBe(currentAccess);
  });

  it('throws if the current secret is unset', () => {
    delete process.env.JWT_SECRET;
    expect(() => getSigningSecret('access')).toThrow();
  });

  it('throws on an unknown kind', () => {
    expect(() => getSigningSecret('bogus')).toThrow();
  });
});

describe('hasPreviousSecret', () => {
  it('false when no previous secret configured', () => {
    expect(hasPreviousSecret('access')).toBe(false);
  });

  it('true when previous secret configured', () => {
    process.env.JWT_SECRET_PREVIOUS = previousAccess;
    expect(hasPreviousSecret('access')).toBe(true);
  });
});

describe('verifyWithKeyRing', () => {
  it('verifies a token signed with the CURRENT secret', () => {
    const tok = jwt.sign({ userId: 'u1' }, currentAccess, { algorithm: 'HS256' });
    const decoded = verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] });
    expect(decoded.userId).toBe('u1');
  });

  it('verifies a token signed with the PREVIOUS secret during the overlap window', () => {
    process.env.JWT_SECRET_PREVIOUS = previousAccess;
    const tok = jwt.sign({ userId: 'u2' }, previousAccess, { algorithm: 'HS256' });
    const decoded = verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] });
    expect(decoded.userId).toBe('u2');
  });

  it('REJECTS a token signed with the previous secret AFTER the window closes (previous unset)', () => {
    // No JWT_SECRET_PREVIOUS configured = window closed.
    const tok = jwt.sign({ userId: 'u3' }, previousAccess, { algorithm: 'HS256' });
    expect(() => verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] })).toThrow();
  });

  it('REJECTS a token signed with an unknown secret even when previous is configured', () => {
    process.env.JWT_SECRET_PREVIOUS = previousAccess;
    const tok = jwt.sign({ userId: 'u4' }, UNKNOWN, { algorithm: 'HS256' });
    expect(() => verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] })).toThrow();
  });

  it('refresh kind: verifies current AND previous refresh secrets', () => {
    process.env.JWT_REFRESH_SECRET_PREVIOUS = previousRefresh;
    const cur = jwt.sign({ userId: 'r1', type: 'refresh' }, currentRefresh, { algorithm: 'HS256' });
    const prev = jwt.sign({ userId: 'r2', type: 'refresh' }, previousRefresh, { algorithm: 'HS256' });
    expect(verifyWithKeyRing(cur, 'refresh').userId).toBe('r1');
    expect(verifyWithKeyRing(prev, 'refresh').userId).toBe('r2');
  });

  it('propagates expiration as a TokenExpiredError (does NOT fall through to previous)', () => {
    process.env.JWT_SECRET_PREVIOUS = previousAccess;
    // Expired token validly signed with CURRENT secret. Must surface as
    // expired, not get retried against the previous key and masked.
    const tok = jwt.sign({ userId: 'u5' }, currentAccess, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    let caught;
    try {
      verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.name).toBe('TokenExpiredError');
  });

  it('enforces the algorithm allow-list (rejects alg confusion)', () => {
    const tok = jwt.sign({ userId: 'u6' }, currentAccess, { algorithm: 'HS512' });
    expect(() => verifyWithKeyRing(tok, 'access', { algorithms: ['HS256'] })).toThrow();
  });
});
