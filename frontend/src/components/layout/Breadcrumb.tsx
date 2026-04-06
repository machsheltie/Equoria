/**
 * Breadcrumb — route-aware breadcrumb trail for hub-spoke navigation (Section 07)
 *
 * Rules:
 * - Hub (/): no breadcrumb shown
 * - Spoke pages: "Home > Training"
 * - Detail pages: "Home > Stable > HorseName"
 * - Mobile (<768px): collapsed to "< Back" link
 */

import { Link, useLocation } from 'react-router-dom';

/** Override href for segments that don't have their own route */
const ROUTE_HREF_OVERRIDE: Record<string, string> = {
  horses: '/stable',
};

/** Full-path label overrides — checked before segment lookup to resolve ambiguous segments */
const PATH_LABEL_OVERRIDES: Record<string, string> = {
  '/marketplace/horses': 'Horse Marketplace',
  '/marketplace/horse-trader': 'Horse Trader',
};

/** Map route segments to display names */
const ROUTE_LABELS: Record<string, string> = {
  stable: 'My Stable',
  training: 'Training',
  competitions: 'Competitions',
  breeding: 'Breeding',
  world: 'World',
  marketplace: 'Marketplace',
  community: 'Community',
  messages: 'Messages',
  riders: 'Riders',
  leaderboards: 'Leaderboards',
  settings: 'Settings',
  profile: 'Profile',
  bank: 'Bank',
  inventory: 'Inventory',
  horses: 'Stable',
  grooms: 'Grooms',
  trainers: 'Trainers',
  'message-board': 'Message Board',
  clubs: 'Clubs',
  'my-stable': 'My Stable',
  'feed-shop': 'Feed Shop',
  'tack-shop': 'Tack Shop',
  farrier: 'Farrier',
  veterinarian: 'Veterinarian',
  'competition-browser': 'Competitions',
  'forgot-password': 'Forgot Password',
  'reset-password': 'Reset Password',
  'verify-email': 'Verify Email',
};

interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  // Hub — no breadcrumb
  if (segments.length === 0) return null;

  const crumbs: Crumb[] = [];
  let path = '';

  for (const segment of segments) {
    path += `/${segment}`;
    const label =
      PATH_LABEL_OVERRIDES[path] || ROUTE_LABELS[segment] || decodeURIComponent(segment);
    const href = ROUTE_HREF_OVERRIDE[segment] || path;
    crumbs.push({ label, href });
  }

  // Parent for mobile back link
  const parentCrumb = crumbs.length > 1 ? crumbs[crumbs.length - 2] : { label: 'Home', href: '/' };

  return (
    <>
      {/* Mobile: "< Back" link */}
      <nav aria-label="Back navigation" className="md:hidden">
        <Link
          to={parentCrumb.href}
          className="flex items-center gap-1 text-[0.8rem] text-[var(--text-secondary)] hover:text-[var(--gold-primary)] transition-colors"
        >
          <span>&lsaquo;</span>
          <span>{parentCrumb.label}</span>
        </Link>
      </nav>

      {/* Desktop: full breadcrumb trail */}
      <nav aria-label="Breadcrumb" className="hidden md:block">
        <ol className="flex items-center gap-0 text-[0.8rem] list-none p-0 m-0">
          <li>
            <Link
              to="/"
              className="text-[var(--text-secondary)] hover:text-[var(--gold-primary)] transition-colors"
            >
              Home
            </Link>
          </li>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center">
                <span className="mx-2 text-[var(--text-muted)] opacity-50">&rsaquo;</span>
                {isLast ? (
                  <span className="text-[var(--text-primary)]">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.href}
                    className="text-[var(--text-secondary)] hover:text-[var(--gold-primary)] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
