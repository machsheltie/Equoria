/**
 * betaRouteScope.ts — Beta Route Scope Configuration
 *
 * Single source of truth for beta route gating. Mirrors the policy defined in
 * docs/beta-route-truth-table.md without parsing markdown at runtime.
 *
 * Usage:
 *   import { isBetaMode, getBetaScope, BETA_SCOPE } from '@/config/betaRouteScope';
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { matchPath } from 'react-router-dom';

/** Beta mode switch — reads from VITE_BETA_MODE env var; defaults to false */
export const isBetaMode = import.meta.env.VITE_BETA_MODE === 'true';

/**
 * Beta scope classification for a route.
 *
 * - beta-live: Fully functional in beta; shows real data and accepts real actions.
 */
export type BetaScope = 'beta-live';

/**
 * Static map of all known routes to their beta scope status.
 * Source of truth: docs/beta-route-truth-table.md (21R-1 output).
 */
export const BETA_SCOPE: Record<string, BetaScope> = {
  // beta-live routes
  '/login': 'beta-live',
  '/register': 'beta-live',
  '/': 'beta-live',
  '/stable': 'beta-live',
  '/onboarding': 'beta-live',

  '/verify-email': 'beta-live',
  '/horses/:id': 'beta-live',
  '/profile': 'beta-live',
  '/settings': 'beta-live',
  '/bank': 'beta-live',
  '/leaderboards': 'beta-live',
  '/training': 'beta-live',
  '/breeding': 'beta-live',
  '/competitions': 'beta-live',
  '/competition-results': 'beta-live',
  '/prizes': 'beta-live',
  '/world': 'beta-live',
  '/grooms': 'beta-live',
  '/riders': 'beta-live',
  '/trainers': 'beta-live',
  '/vet': 'beta-live',
  '/farrier': 'beta-live',
  '/feed-shop': 'beta-live',
  '/tack-shop': 'beta-live',
  '/marketplace': 'beta-live',
  '/marketplace/horses': 'beta-live',
  '/marketplace/horse-trader': 'beta-live',
  '/inventory': 'beta-live',
  '/message-board': 'beta-live',
  '/message-board/:threadId': 'beta-live',
  '/clubs': 'beta-live',
  '/messages': 'beta-live',
  '/forgot-password': 'beta-live',
  '/reset-password': 'beta-live',
  '/crafting': 'beta-live',
  '/my-stable': 'beta-live',
  '/community': 'beta-live',
};

/**
 * Returns the beta scope for a given route path.
 *
 * Tries exact lookup first (fast path), then falls back to React Router
 * `matchPath` pattern matching to handle parameterized routes like
 * `/horses/:id` and `/message-board/:threadId`.
 *
 * Returns 'beta-live' for unknown routes during active beta so routing does not
 * hide broken integrations behind scope configuration.
 */
export function getBetaScope(path: string): BetaScope {
  const normalized = path === '/' ? '/' : path.replace(/\/$/, '');

  // 1. Fast path: exact string match
  if (Object.prototype.hasOwnProperty.call(BETA_SCOPE, normalized)) {
    return BETA_SCOPE[normalized];
  }

  // 2. Pattern match: iterate over keys that contain ':' (parameterized patterns)
  for (const [pattern, scope] of Object.entries(BETA_SCOPE)) {
    if (pattern.includes(':') && matchPath(pattern, normalized)) {
      return scope;
    }
  }

  return 'beta-live';
}

/**
 * Returns true if the given route is beta-live.
 */
export function isBetaLive(path: string): boolean {
  return getBetaScope(path) === 'beta-live';
}
