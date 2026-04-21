/**
 * navItems — Single source of truth for Celestial Night navigation (Story 22-8)
 *
 * Shared by SidebarNav, MobileNav/NavPanel, and BottomNav. Every item is
 * always rendered — no beta-hidden / beta-read-only gating.
 */

import {
  Home,
  Building2,
  Dumbbell,
  Trophy,
  Dna,
  PersonStanding,
  Globe,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Mail,
  Landmark,
  User,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  Icon: LucideIcon;
  /** Mobile-first abbreviation used on bottom-tab labels */
  shortName?: string;
}

/** Full navigation — used by SidebarNav (desktop) and NavPanel (hamburger overlay) */
export const NAV_SECTIONS: NavItem[] = [
  { name: 'Home', href: '/', Icon: Home },
  { name: 'My Stable', href: '/stable', Icon: Building2, shortName: 'Stable' },
  { name: 'Training', href: '/training', Icon: Dumbbell },
  { name: 'Competitions', href: '/competitions', Icon: Trophy, shortName: 'Compete' },
  { name: 'Breeding', href: '/breeding', Icon: Dna, shortName: 'Breed' },
  { name: 'Riders', href: '/riders', Icon: PersonStanding },
  { name: 'World', href: '/world', Icon: Globe },
  { name: 'Marketplace', href: '/marketplace', Icon: ShoppingCart },
  { name: 'Leaderboards', href: '/leaderboards', Icon: BarChart3 },
  { name: 'Community', href: '/community', Icon: MessageSquare },
  { name: 'Messages', href: '/messages', Icon: Mail },
  { name: 'Bank', href: '/bank', Icon: Landmark },
  { name: 'Profile', href: '/profile', Icon: User },
  { name: 'Settings', href: '/settings', Icon: Settings },
];

/**
 * Bottom-nav configuration — 5 most-used items on mobile.
 * "More" opens a drawer exposing the full NAV_SECTIONS list.
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { name: 'Home', href: '/', Icon: Home },
  { name: 'Horses', href: '/stable', Icon: Building2 },
  { name: 'Compete', href: '/competitions', Icon: Trophy },
  { name: 'Breed', href: '/breeding', Icon: Dna },
  { name: 'More', href: '#more', Icon: MoreHorizontal },
];

/**
 * Helpers used by active-state indicators.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href.startsWith('#')) return false;
  return pathname.startsWith(href);
}
