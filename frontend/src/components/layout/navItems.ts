/**
 * navItems — the one source of truth for Equoria's main menu.
 *
 * Owner ruling 2026-10-28 (decisions page q249, Equoria-m5ml8), with her same-day
 * addition that News and Guide belong under Community: the menu is five groups —
 * Home, World, Community, Marketplace and Compete. Grooms, Riders and Trainers
 * sit in the Marketplace because they are all for hire. A destination is listed
 * only once its page exists; the ruling's Breeding Specialist, Equestrian Tailor,
 * Seasonal Events and Parades have no page yet and are left out until they do.
 *
 * Shared by SidebarNav (desktop), NavPanel (phone menu) and BottomNav (the phone
 * bottom bar, the same five realms: owner ruling q267).
 */

import {
  Home,
  Building2,
  Package,
  Trophy,
  Globe,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Mail,
  Landmark,
  UsersRound,
  Users,
  User,
  Settings,
  Newspaper,
  BookOpen,
  Stethoscope,
  Hammer,
  Store,
  Wheat,
  Dumbbell,
  Gem,
  Scissors,
  Flag,
  Crown,
  HandCoins,
  Sparkles,
  PersonStanding,
  GraduationCap,
  Medal,
  Ribbon,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  name: string;
  /** A path, optionally with a query (e.g. a tab of a shared page). */
  href: string;
  Icon: LucideIcon;
  /** Mobile-first abbreviation used on bottom-tab labels */
  shortName?: string;
}

export type NavRealmId = 'home' | 'world' | 'community' | 'marketplace' | 'compete';

export interface NavRealm {
  id: NavRealmId;
  name: string;
  Icon: LucideIcon;
  /** The realm's own page, when it has one. Compete has none: it only opens its menu. */
  href?: string;
  items: NavItem[];
}

export const navRealms: NavRealm[] = [
  {
    id: 'home',
    name: 'Home',
    // Home stays a page (owner ruling q96); its rooms hang beneath it.
    href: '/',
    Icon: Home,
    items: [
      // D-27 (DECISIONS.md §10): /stable is the roster browser — label "Stable".
      { name: 'Stable', href: '/stable', Icon: Building2, shortName: 'Stable' },
      { name: 'Staff', href: '/staff', Icon: UsersRound },
      { name: 'Inventory', href: '/inventory', Icon: Package },
      { name: 'Bank', href: '/bank', Icon: Landmark },
      { name: 'Settings', href: '/settings', Icon: Settings },
      { name: 'Profile', href: '/profile', Icon: User },
    ],
  },
  {
    id: 'world',
    name: 'World',
    href: '/world',
    Icon: Globe,
    items: [
      { name: 'Vet Clinic', href: '/vet', Icon: Stethoscope },
      { name: 'Farrier', href: '/farrier', Icon: Hammer },
      { name: 'Tack Shop', href: '/tack-shop', Icon: Store },
      { name: 'Feed Shop', href: '/feed-shop', Icon: Wheat },
      { name: 'Training Center', href: '/training', Icon: Dumbbell },
      { name: 'Premium Shop', href: '/premium-shop', Icon: Gem },
      { name: 'Leathersmith', href: '/crafting', Icon: Scissors },
    ],
  },
  {
    id: 'community',
    name: 'Community',
    href: '/community',
    Icon: Users,
    items: [
      { name: 'Message Boards', href: '/message-board', Icon: MessageSquare },
      { name: 'Clubs', href: '/clubs', Icon: Flag },
      { name: 'Messages', href: '/messages', Icon: Mail },
      { name: 'Leaderboards', href: '/leaderboards', Icon: BarChart3 },
      // Its own page; /my-stable redirects there (stable agent, Equoria-631wc).
      { name: 'Hall of Fame', href: '/hall-of-fame', Icon: Crown },
      // Equoria-wbt8l: News, where While You Were Away's "Okay" leads.
      { name: 'News', href: '/news', Icon: Newspaper },
      // Equoria-kd2dd: the new player guide, right after News (owner ruling q20).
      { name: 'Guide', href: '/guide', Icon: BookOpen },
    ],
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    href: '/marketplace',
    Icon: ShoppingCart,
    items: [
      { name: 'Horse Trader', href: '/marketplace/horse-trader', Icon: HandCoins },
      { name: 'Horse Marketplace', href: '/marketplace/horses', Icon: ShoppingCart },
      { name: 'Grooms', href: '/grooms', Icon: Sparkles },
      { name: 'Riders', href: '/riders', Icon: PersonStanding },
      { name: 'Trainers', href: '/trainers', Icon: GraduationCap },
    ],
  },
  {
    id: 'compete',
    name: 'Compete',
    Icon: Medal,
    items: [
      { name: 'Ridden Shows', href: '/competitions', Icon: Trophy },
      { name: 'Conformation Shows', href: '/competitions?tab=conformation', Icon: Ribbon },
    ],
  },
];

/** Every destination in menu order — the list a flat reading of the menu walks. */
export const navDestinations: NavItem[] = navRealms.flatMap((realm) => realm.items);

/**
 * Helpers used by active-state indicators.
 */
export function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href.startsWith('#')) return false;
  return pathname.startsWith(href.split('?')[0]);
}

/**
 * The one menu link that marks where the player is. A link with a query (a tab
 * of a shared page) matches only when the address carries the same values, and
 * the most specific match wins — so /marketplace/horses lights Horse Marketplace,
 * not Marketplace as well, and ?tab=conformation lights Conformation Shows, not
 * Ridden Shows.
 */
export function currentMenuHref(
  pathname: string,
  search: string,
  hrefs: readonly string[]
): string | undefined {
  const params = new URLSearchParams(search);
  let best: { href: string; score: number } | undefined;
  for (const href of hrefs) {
    const [path, query = ''] = href.split('?');
    if (!isRouteActive(pathname, path)) continue;
    const wanted = [...new URLSearchParams(query)];
    if (wanted.some(([key, value]) => params.get(key) !== value)) continue;
    const score = path.length * 10 + wanted.length;
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href;
}

/** Every link the main menu shows: each realm's own page, then its places. */
export const navMenuHrefs: string[] = navRealms.flatMap((realm) => [
  ...(realm.href ? [realm.href] : []),
  ...realm.items.map((item) => item.href),
]);

/** The realm the player is in: the one whose page or places holds the current link. */
export function currentRealmId(pathname: string, search: string): NavRealmId | undefined {
  const href = currentMenuHref(pathname, search, navMenuHrefs);
  if (!href) return undefined;
  return navRealms.find(
    (realm) => realm.href === href || realm.items.some((item) => item.href === href)
  )?.id;
}
