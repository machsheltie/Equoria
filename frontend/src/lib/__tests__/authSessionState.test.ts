/**
 * Unit Tests: AuthSessionState lifecycle transitions
 *
 * Verifies that the CSRF / access-token session state module behaves correctly
 * across all lifecycle events: initial state, invalidate(), clear(), and
 * direct field mutation (used by getCsrfToken() in api-client).
 *
 * 21R-AUTH-5 (Equoria-wv0)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import authSessionState from '../authSessionState';

describe('AuthSessionState', () => {
  beforeEach(() => {
    // Reset to clean state before each test — the module is a singleton
    authSessionState.clear();
  });

  describe('initial state', () => {
    it('starts with all fields null', () => {
      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.csrfFetching).toBeNull();
      expect(authSessionState.accessTokenExpiry).toBeNull();
    });
  });

  describe('invalidate()', () => {
    it('clears csrfToken', () => {
      authSessionState.csrfToken = 'abc123';
      authSessionState.invalidate();
      expect(authSessionState.csrfToken).toBeNull();
    });

    it('clears csrfFetching', () => {
      authSessionState.csrfFetching = Promise.resolve('in-flight');
      authSessionState.invalidate();
      expect(authSessionState.csrfFetching).toBeNull();
    });

    it('preserves accessTokenExpiry — token was refreshed, not expired', () => {
      authSessionState.accessTokenExpiry = Date.now() + 900_000;
      authSessionState.csrfToken = 'tok';
      authSessionState.invalidate();
      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.accessTokenExpiry).not.toBeNull();
    });

    it('is idempotent — calling twice leaves state null', () => {
      authSessionState.csrfToken = 'tok';
      authSessionState.invalidate();
      authSessionState.invalidate();
      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.csrfFetching).toBeNull();
    });
  });

  describe('clear()', () => {
    it('wipes csrfToken', () => {
      authSessionState.csrfToken = 'session-token';
      authSessionState.clear();
      expect(authSessionState.csrfToken).toBeNull();
    });

    it('wipes csrfFetching', () => {
      authSessionState.csrfFetching = Promise.resolve('fetch');
      authSessionState.clear();
      expect(authSessionState.csrfFetching).toBeNull();
    });

    it('wipes accessTokenExpiry', () => {
      authSessionState.accessTokenExpiry = 9_999_999_999;
      authSessionState.clear();
      expect(authSessionState.accessTokenExpiry).toBeNull();
    });

    it('resets all fields at once', () => {
      authSessionState.csrfToken = 'tok';
      authSessionState.csrfFetching = Promise.resolve('fetch');
      authSessionState.accessTokenExpiry = 12345;
      authSessionState.clear();
      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.csrfFetching).toBeNull();
      expect(authSessionState.accessTokenExpiry).toBeNull();
    });

    it('is idempotent — calling on already-null state is safe', () => {
      expect(() => authSessionState.clear()).not.toThrow();
      expect(authSessionState.csrfToken).toBeNull();
    });
  });

  describe('direct mutation (getCsrfToken() integration contract)', () => {
    it('allows csrfToken to be set directly', () => {
      authSessionState.csrfToken = 'fresh-token';
      expect(authSessionState.csrfToken).toBe('fresh-token');
    });

    it('allows csrfFetching to be set and cleared directly', () => {
      const promise = Promise.resolve('fetching');
      authSessionState.csrfFetching = promise;
      expect(authSessionState.csrfFetching).toBe(promise);
      authSessionState.csrfFetching = null;
      expect(authSessionState.csrfFetching).toBeNull();
    });

    it('allows accessTokenExpiry to be set', () => {
      const expiry = Date.now() + 15 * 60 * 1000;
      authSessionState.accessTokenExpiry = expiry;
      expect(authSessionState.accessTokenExpiry).toBe(expiry);
    });
  });

  describe('invalidate vs clear distinction', () => {
    it('invalidate() is lighter — only CSRF cleared, expiry intact', () => {
      const expiry = Date.now() + 900_000;
      authSessionState.csrfToken = 'tok';
      authSessionState.accessTokenExpiry = expiry;

      authSessionState.invalidate();

      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.accessTokenExpiry).toBe(expiry);
    });

    it('clear() is heavier — all state wiped including expiry', () => {
      const expiry = Date.now() + 900_000;
      authSessionState.csrfToken = 'tok';
      authSessionState.accessTokenExpiry = expiry;

      authSessionState.clear();

      expect(authSessionState.csrfToken).toBeNull();
      expect(authSessionState.accessTokenExpiry).toBeNull();
    });
  });
});
