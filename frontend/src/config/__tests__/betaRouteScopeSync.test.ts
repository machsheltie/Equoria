/**
 * betaRouteScope — the known minimum set of routes is beta-live
 * (Story 21R-2 Task 15).
 */

import { describe, it, expect } from 'vitest';
import { betaScope } from '../betaRouteScope';

describe('betaRouteScope — minimum beta-live set', () => {
  it('known minimum set (/login /register /onboarding / /stable) are all beta-live', () => {
    const minimumSet = ['/login', '/register', '/onboarding', '/', '/stable'];
    for (const route of minimumSet) {
      expect(betaScope[route]).toBe('beta-live');
    }
  });
});
