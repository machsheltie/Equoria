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

  // beta-readonly routes
  '/verify-email': 'beta-readonly',
  '/onboarding': 'beta-readonly',
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
 * Strips trailing slashes and normalizes before lookup.
 * Returns 'beta-readonly' as a safe default for unknown routes.
 */
export function getBetaScope(path: string): BetaScope {
  const normalized = path === '/' ? '/' : path.replace(/\/$/, '');
  return BETA_SCOPE[normalized] ?? 'beta-readonly';
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
