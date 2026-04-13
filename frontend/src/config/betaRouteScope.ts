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
 * - beta-live:     Fully functional in beta; shows real data and accepts real actions.
 * - beta-readonly: Route is visible and loads real data where available, but actions
 *                  that require unsupported backend features show beta-excluded copy.
 * - beta-hidden:   Route is intentionally excluded from beta. Nav links are removed;
 *                  direct navigation renders BetaExcludedNotice or redirects to /.
 */
export type BetaScope = 'beta-live' | 'beta-readonly' | 'beta-hidden';

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

  // beta-readonly routes
  '/verify-email': 'beta-readonly',
  '/horses/:id': 'beta-readonly',
  '/profile': 'beta-readonly',
  '/settings': 'beta-readonly',
  '/bank': 'beta-readonly',
  '/leaderboards': 'beta-readonly',
  '/training': 'beta-readonly',
  '/breeding': 'beta-readonly',
  '/competitions': 'beta-readonly',
  '/competition-results': 'beta-readonly',
  '/prizes': 'beta-readonly',
  '/world': 'beta-readonly',
  '/grooms': 'beta-readonly',
  '/riders': 'beta-readonly',
  '/trainers': 'beta-readonly',
  '/vet': 'beta-readonly',
  '/farrier': 'beta-readonly',
  '/feed-shop': 'beta-readonly',
  '/tack-shop': 'beta-readonly',
  '/marketplace': 'beta-readonly',
  '/marketplace/horses': 'beta-readonly',
  '/marketplace/horse-trader': 'beta-readonly',
  '/inventory': 'beta-readonly',
  '/message-board': 'beta-readonly',
  '/message-board/:threadId': 'beta-readonly',
  '/clubs': 'beta-readonly',
  '/messages': 'beta-readonly',

  // beta-hidden routes
  '/forgot-password': 'beta-hidden',
  '/reset-password': 'beta-hidden',
  '/crafting': 'beta-hidden',
  '/my-stable': 'beta-hidden',
  '/community': 'beta-hidden',
};

/**
 * Returns the beta scope for a given route path.
 *
 * Tries exact lookup first (fast path), then falls back to React Router
 * `matchPath` pattern matching to handle parameterized routes like
 * `/horses/:id` and `/message-board/:threadId`.
 *
 * Returns 'beta-readonly' as a safe default for unknown routes.
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

  return 'beta-readonly';
}

/**
 * Returns true if the given route is beta-live.
 */
export function isBetaLive(path: string): boolean {
  return getBetaScope(path) === 'beta-live';
}

/**
 * Returns true if the given route is beta-readonly.
 */
export function isBetaReadonly(path: string): boolean {
  return getBetaScope(path) === 'beta-readonly';
}

/**
 * Returns true if the given route is beta-hidden.
 */
export function isBetaHidden(path: string): boolean {
  return getBetaScope(path) === 'beta-hidden';
}
