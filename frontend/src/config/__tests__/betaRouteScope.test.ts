/**
 * betaRouteScope Tests
 *
 * Verifies the beta route classification helpers behave correctly.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { describe, it, expect } from 'vitest';
import { getBetaScope, isBetaLive, BETA_SCOPE } from '../betaRouteScope';

describe('betaRouteScope', () => {
  describe('getBetaScope', () => {
    it('returns beta-live for live routes', () => {
      expect(getBetaScope('/')).toBe('beta-live');
      expect(getBetaScope('/stable')).toBe('beta-live');
      expect(getBetaScope('/login')).toBe('beta-live');
      expect(getBetaScope('/register')).toBe('beta-live');
      expect(getBetaScope('/onboarding')).toBe('beta-live');
    });

    it('returns beta-live for active beta feature routes', () => {
      expect(getBetaScope('/training')).toBe('beta-live');
      expect(getBetaScope('/breeding')).toBe('beta-live');
      expect(getBetaScope('/competitions')).toBe('beta-live');
      expect(getBetaScope('/bank')).toBe('beta-live');
      expect(getBetaScope('/community')).toBe('beta-live');
      expect(getBetaScope('/crafting')).toBe('beta-live');
    });

    it('returns beta-live as default for unknown routes', () => {
      expect(getBetaScope('/unknown-route')).toBe('beta-live');
      expect(getBetaScope('/some/nested/path')).toBe('beta-live');
    });

    it('resolves dynamic /horses/:id paths to beta-live', () => {
      expect(getBetaScope('/horses/123')).toBe('beta-live');
      expect(getBetaScope('/horses/456')).toBe('beta-live');
    });

    it('resolves dynamic /message-board/:threadId paths to beta-live', () => {
      expect(getBetaScope('/message-board/abc')).toBe('beta-live');
      expect(getBetaScope('/message-board/1')).toBe('beta-live');
    });

    it('strips trailing slashes before lookup', () => {
      expect(getBetaScope('/training/')).toBe('beta-live');
      expect(getBetaScope('/community/')).toBe('beta-live');
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

    it('returns true for all active beta routes', () => {
      expect(isBetaLive('/training')).toBe(true);
      expect(isBetaLive('/community')).toBe(true);
    });
  });

  describe('BETA_SCOPE map', () => {
    it('classifies every configured route as beta-live', () => {
      const liveRoutes = Object.entries(BETA_SCOPE)
        .filter(([, scope]) => scope === 'beta-live')
        .map(([route]) => route);
      expect(liveRoutes).toHaveLength(Object.keys(BETA_SCOPE).length);
      expect(BETA_SCOPE['/community']).toBe('beta-live');
      expect(BETA_SCOPE['/crafting']).toBe('beta-live');
      expect(BETA_SCOPE['/my-stable']).toBe('beta-live');
    });
  });
});
