/**
 * Route manifest for the design-system baseline screenshot set
 * (Equoria-o5hub.1, handoff §6.1).
 *
 * Source of truth: frontend/src/App.tsx route tree + frontend/src/nav-items.tsx
 * (the authenticated route table DashboardLayout pages mount from) +
 * frontend/src/components/layout/navItems.ts (nav labels). Reconciled
 * 2026-06-10. When a route is added to nav-items.tsx, add it here — the
 * baseline spec fails loudly on manifest drift (route count assertion).
 *
 * `family` matches the Stage B page-family migration grouping in
 * docs/frontend-design-consistency-remaining-work-handoff.md §5.
 */

export interface BaselineRoute {
  /** Route path to visit (no dynamic segments — see dynamicEntityRoutes). */
  path: string;
  /** Slug used in the screenshot filename. */
  slug: string;
  /** Page family per handoff §5 / Stage B grouping. */
  family:
    | 'auth'
    | 'hub'
    | 'world-services'
    | 'marketplace-economy'
    | 'community-messaging'
    | 'stable-entity'
    | 'workflow'
    | 'settings-profile';
  /** Whether the route requires the authenticated storageState. */
  auth: boolean;
}

export const staticRoutes: BaselineRoute[] = [
  // ── Auth (unauthenticated chrome) ──────────────────────────────────────
  { path: '/login', slug: 'login', family: 'auth', auth: false },
  { path: '/register', slug: 'register', family: 'auth', auth: false },
  { path: '/forgot-password', slug: 'forgot-password', family: 'auth', auth: false },
  { path: '/reset-password', slug: 'reset-password-no-token', family: 'auth', auth: false },
  { path: '/verify-email', slug: 'verify-email', family: 'auth', auth: false },

  // ── Hub / dashboard ────────────────────────────────────────────────────
  { path: '/', slug: 'dashboard', family: 'hub', auth: true },
  { path: '/world', slug: 'world', family: 'hub', auth: true },

  // ── World services ─────────────────────────────────────────────────────
  { path: '/vet', slug: 'vet', family: 'world-services', auth: true },
  { path: '/farrier', slug: 'farrier', family: 'world-services', auth: true },
  { path: '/feed-shop', slug: 'feed-shop', family: 'world-services', auth: true },
  { path: '/tack-shop', slug: 'tack-shop', family: 'world-services', auth: true },
  { path: '/grooms', slug: 'grooms', family: 'world-services', auth: true },
  { path: '/riders', slug: 'riders', family: 'world-services', auth: true },
  { path: '/trainers', slug: 'trainers', family: 'world-services', auth: true },
  { path: '/crafting', slug: 'crafting', family: 'world-services', auth: true },

  // ── Marketplace & economy ──────────────────────────────────────────────
  { path: '/marketplace', slug: 'marketplace', family: 'marketplace-economy', auth: true },
  {
    path: '/marketplace/horses',
    slug: 'horse-marketplace',
    family: 'marketplace-economy',
    auth: true,
  },
  {
    path: '/marketplace/horse-trader',
    slug: 'horse-trader',
    family: 'marketplace-economy',
    auth: true,
  },
  { path: '/bank', slug: 'bank', family: 'marketplace-economy', auth: true },
  { path: '/inventory', slug: 'inventory', family: 'marketplace-economy', auth: true },
  { path: '/prizes', slug: 'prize-history', family: 'marketplace-economy', auth: true },

  // ── Community & messaging ──────────────────────────────────────────────
  { path: '/community', slug: 'community', family: 'community-messaging', auth: true },
  { path: '/clubs', slug: 'clubs', family: 'community-messaging', auth: true },
  { path: '/message-board', slug: 'message-board', family: 'community-messaging', auth: true },
  { path: '/messages', slug: 'messages', family: 'community-messaging', auth: true },

  // ── Stable / entity ────────────────────────────────────────────────────
  { path: '/stable', slug: 'stable', family: 'stable-entity', auth: true },
  { path: '/my-stable', slug: 'stable-profile', family: 'stable-entity', auth: true },

  // ── Workflow pages ─────────────────────────────────────────────────────
  { path: '/training', slug: 'training', family: 'workflow', auth: true },
  { path: '/breeding', slug: 'breeding', family: 'workflow', auth: true },
  { path: '/competitions', slug: 'competition-browser', family: 'workflow', auth: true },
  { path: '/competition-results', slug: 'competition-results', family: 'workflow', auth: true },
  {
    path: '/conformation-shows',
    slug: 'conformation-shows-redirect',
    family: 'workflow',
    auth: true,
  },

  // ── Settings & profile ─────────────────────────────────────────────────
  { path: '/settings', slug: 'settings', family: 'settings-profile', auth: true },
  { path: '/profile', slug: 'profile', family: 'settings-profile', auth: true },
];

/**
 * Dynamic entity routes — resolved at runtime by navigating from the stable
 * roster (first horse). The spec fails loudly if no horse exists: a baseline
 * without entity-detail pages is incomplete, not "gracefully skipped".
 */
export const dynamicEntityRoutes = [
  { template: '/horses/:id', slug: 'horse-detail', family: 'stable-entity' as const },
  { template: '/horses/:id/equip', slug: 'horse-equip', family: 'stable-entity' as const },
] as const;

export const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;
