/**
 * betaRouteScope Tests
 *
 * Verifies the beta route classification helpers behave correctly.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect } from 'vitest';
import {
  getBetaScope,
  isBetaLive,
  isBetaReadonly,
  isBetaHidden,
  BETA_SCOPE,
} from '../betaRouteScope';

describe('betaRouteScope', () => {
  describe('getBetaScope', () => {
    it('returns beta-live for live routes', () => {
      expect(getBetaScope('/')).toBe('beta-live');
      expect(getBetaScope('/stable')).toBe('beta-live');
      expect(getBetaScope('/login')).toBe('beta-live');
      expect(getBetaScope('/register')).toBe('beta-live');
    });

    it('returns beta-readonly for readonly routes', () => {
      expect(getBetaScope('/training')).toBe('beta-readonly');
      expect(getBetaScope('/breeding')).toBe('beta-readonly');
      expect(getBetaScope('/competitions')).toBe('beta-readonly');
      expect(getBetaScope('/bank')).toBe('beta-readonly');
    });

    it('returns beta-hidden for hidden routes', () => {
      expect(getBetaScope('/community')).toBe('beta-hidden');
      expect(getBetaScope('/my-stable')).toBe('beta-hidden');
      expect(getBetaScope('/crafting')).toBe('beta-hidden');
      expect(getBetaScope('/forgot-password')).toBe('beta-hidden');
    });

    it('returns beta-readonly as safe default for unknown routes', () => {
      expect(getBetaScope('/unknown-route')).toBe('beta-readonly');
      expect(getBetaScope('/some/nested/path')).toBe('beta-readonly');
    });

    it('resolves dynamic /horses/:id paths to beta-readonly', () => {
      expect(getBetaScope('/horses/123')).toBe('beta-readonly');
      expect(getBetaScope('/horses/456')).toBe('beta-readonly');
    });

    it('resolves dynamic /message-board/:threadId paths to beta-readonly', () => {
      expect(getBetaScope('/message-board/abc')).toBe('beta-readonly');
      expect(getBetaScope('/message-board/1')).toBe('beta-readonly');
    });

    it('strips trailing slashes before lookup', () => {
      expect(getBetaScope('/training/')).toBe('beta-readonly');
      expect(getBetaScope('/community/')).toBe('beta-hidden');
    });

    it('preserves the root slash correctly', () => {
      expect(getBetaScope('/')).toBe('beta-live');
    });
  });

  describe('isBetaLive', () => {
    it('returns true for beta-live routes', () => {
      expect(isBetaLive('/')).toBe(true);
      expect(isBetaLive('/stable')).toBe(true);
    });

    it('returns false for non-live routes', () => {
      expect(isBetaLive('/training')).toBe(false);
      expect(isBetaLive('/community')).toBe(false);
    });
  });

  describe('isBetaReadonly', () => {
    it('returns true for readonly routes', () => {
      expect(isBetaReadonly('/training')).toBe(true);
      expect(isBetaReadonly('/bank')).toBe(true);
    });

    it('returns false for non-readonly routes', () => {
      expect(isBetaReadonly('/')).toBe(false);
      expect(isBetaReadonly('/community')).toBe(false);
    });
  });

  describe('isBetaHidden', () => {
    it('returns true for hidden routes', () => {
      expect(isBetaHidden('/community')).toBe(true);
      expect(isBetaHidden('/my-stable')).toBe(true);
      expect(isBetaHidden('/crafting')).toBe(true);
    });

    it('returns false for visible routes', () => {
      expect(isBetaHidden('/')).toBe(false);
      expect(isBetaHidden('/training')).toBe(false);
    });
  });

  describe('BETA_SCOPE map', () => {
    it('contains all four beta-live routes', () => {
      const liveRoutes = Object.entries(BETA_SCOPE)
        .filter(([, scope]) => scope === 'beta-live')
        .map(([route]) => route);
      expect(liveRoutes).toContain('/');
      expect(liveRoutes).toContain('/stable');
      expect(liveRoutes).toContain('/login');
      expect(liveRoutes).toContain('/register');
    });

    it('classifies /community as beta-hidden', () => {
      expect(BETA_SCOPE['/community']).toBe('beta-hidden');
    });

    it('classifies /crafting as beta-hidden', () => {
      expect(BETA_SCOPE['/crafting']).toBe('beta-hidden');
    });

    it('classifies /my-stable as beta-hidden', () => {
      expect(BETA_SCOPE['/my-stable']).toBe('beta-hidden');
    });
  });
});
