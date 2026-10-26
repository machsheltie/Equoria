/**
 * navItems — Single source of truth for Celestial Night navigation (Story 22-8)
 *
 * Shared by SidebarNav, MobileNav/NavPanel, and BottomNav. Every item is
 * always rendered — no beta-hidden / beta-read-only gating.
 */

import {
  Home,
  Building2,
  Package,
  Trophy,
  Dna,
  Globe,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Mail,
  Landmark,
  UsersRound,
  User,
  Settings,
  MoreHorizontal,
  Newspaper,
  BookOpen,
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
  // Equoria-wbt8l: News, where While You Were Away's "Okay" leads. Home stays.
  { name: 'News', href: '/news', Icon: Newspaper },
  // Equoria-kd2dd: the new player guide. Owner ruling 2026-10-23 (q20): its link goes in the sidebar.
  { name: 'Guide', href: '/guide', Icon: BookOpen },
  { name: 'Competitions', href: '/competitions', Icon: Trophy, shortName: 'Compete' },
  { name: 'Breeding', href: '/breeding', Icon: Dna, shortName: 'Breed' },
  { name: 'World', href: '/world', Icon: Globe },
  { name: 'Marketplace', href: '/marketplace', Icon: ShoppingCart },
  { name: 'Leaderboards', href: '/leaderboards', Icon: BarChart3 },
  { name: 'Community', href: '/community', Icon: MessageSquare },
  { name: 'Messages', href: '/messages', Icon: Mail },
  { name: 'Profile', href: '/profile', Icon: User },
  { name: 'Settings', href: '/settings', Icon: Settings },
];

/**
 * The rooms under Home — the stars on the Constellation Thread (owner ruling
 * 2026-10-26, q96, option A). Home stays a page; these hang beneath it.
 * Stable moved here from the top level; Riders is no longer a sidebar link
 * (Riders, Trainers and Grooms are browsed and hired under World); Bank stays
 * here and in the top bar.
 */
export const homeRooms: NavItem[] = [
  // D-27 (DECISIONS.md §10): /stable is the roster browser — label "Stable".
  { name: 'Stable', href: '/stable', Icon: Building2, shortName: 'Stable' },
  { name: 'Staff', href: '/staff', Icon: UsersRound },
  { name: 'Inventory', href: '/inventory', Icon: Package },
  { name: 'Bank', href: '/bank', Icon: Landmark },
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
