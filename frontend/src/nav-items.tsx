import { lazy } from 'react';
import {
  Home,
  Dumbbell,
  HeartHandshake,
  Warehouse,
  User,
  Trophy,
  Globe,
  Settings,
  BarChart3,
  PersonStanding,
  ShoppingCart,
} from 'lucide-react';

// Lazy page imports — each page becomes a separate JS chunk loaded on demand
const Index = lazy(() => import('./pages/Index'));
const TrainingPage = lazy(() => import('./pages/TrainingPage'));
const BreedingPage = lazy(() => import('./pages/BreedingPage'));
const StableViewNav = lazy(() => import('./pages/StableView'));
const ProfilePageNav = lazy(() => import('./pages/ProfilePage'));
const CompetitionBrowserPage = lazy(() => import('./pages/CompetitionBrowserPage'));
const CompetitionResultsPage = lazy(() => import('./pages/CompetitionResultsPage'));
const PrizeHistoryPage = lazy(() => import('./pages/PrizeHistoryPage'));
const WorldHubPage = lazy(() => import('./pages/WorldHubPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LeaderboardsPage = lazy(() => import('./pages/LeaderboardsPage'));
const RidersPage = lazy(() => import('./pages/RidersPage'));
const GroomsPage = lazy(() => import('./pages/GroomsPage'));
const VeterinarianPage = lazy(() => import('./pages/VeterinarianPage'));
const FarrierPage = lazy(() => import('./pages/FarrierPage'));
const FeedShopPage = lazy(() => import('./pages/FeedShopPage'));
const TackShopPage = lazy(() => import('./pages/TackShopPage'));
// Epic 12 — Stable Management pages
const BankPage = lazy(() => import('./pages/BankPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const MyStablePage = lazy(() => import('./pages/MyStablePage'));
// Epic 13 — Trainer System (World sub-location, route-only)
const TrainersPage = lazy(() => import('./pages/TrainersPage'));
// Epic 21 — Marketplace Hub + sub-routes
const MarketplaceHubPage = lazy(() => import('./pages/MarketplaceHubPage'));
const HorseMarketplacePage = lazy(() => import('./pages/HorseMarketplacePage'));
const HorseTraderPage = lazy(() => import('./pages/HorseTraderPage'));
// Leathersmith Crafting Workshop
const CraftingPage = lazy(() => import('./pages/CraftingPage'));
// Epic 11 — Community pages
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const MessageBoardPage = lazy(() => import('./pages/MessageBoardPage'));
const MessageThreadPage = lazy(() => import('./pages/MessageThreadPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));

/**
 * Navigation items for the Equoria application
 * Defines the main navigation structure with routes, icons, and page components.
 * World sub-location routes (/vet, /farrier, /grooms, etc.) are registered here
 * for App.tsx route mapping but do not appear in the main navigation bar.
 *
 * Pages are lazy-loaded — each route is a separate JS chunk loaded on demand.
 */
export const navItems = [
  {
    title: 'Home',
    to: '/',
    icon: <Home className="h-4 w-4" />,
    Page: Index,
  },
  {
    title: 'My Stable',
    to: '/stable',
    icon: <Warehouse className="h-4 w-4" />,
    Page: StableViewNav,
  },
  {
    title: 'Training',
    to: '/training',
    icon: <Dumbbell className="h-4 w-4" />,
    Page: TrainingPage,
  },
  {
    title: 'Breeding',
    to: '/breeding',
    icon: <HeartHandshake className="h-4 w-4" />,
    Page: BreedingPage,
  },
  {
    title: 'Competitions',
    to: '/competitions',
    icon: <Trophy className="h-4 w-4" />,
    Page: CompetitionBrowserPage,
  },
  {
    title: 'World',
    to: '/world',
    icon: <Globe className="h-4 w-4" />,
    Page: WorldHubPage,
  },
  {
    title: 'Marketplace',
    to: '/marketplace',
    icon: <ShoppingCart className="h-4 w-4" />,
    Page: MarketplaceHubPage,
  },
  {
    title: 'Riders',
    to: '/riders',
    icon: <PersonStanding className="h-4 w-4" />,
    Page: RidersPage,
  },
  {
    title: 'Leaderboards',
    to: '/leaderboards',
    icon: <BarChart3 className="h-4 w-4" />,
    Page: LeaderboardsPage,
  },
  {
    title: 'Settings',
    to: '/settings',
    icon: <Settings className="h-4 w-4" />,
    Page: SettingsPage,
  },
  {
    title: 'Profile',
    to: '/profile',
    icon: <User className="h-4 w-4" />,
    Page: ProfilePageNav,
  },
  // World sub-locations — routes only, not shown in main nav bar
  {
    title: 'Grooms',
    to: '/grooms',
    icon: null,
    Page: GroomsPage,
  },
  {
    title: 'Vet Clinic',
    to: '/vet',
    icon: null,
    Page: VeterinarianPage,
  },
  {
    title: 'Farrier',
    to: '/farrier',
    icon: null,
    Page: FarrierPage,
  },
  {
    title: 'Feed Shop',
    to: '/feed-shop',
    icon: null,
    Page: FeedShopPage,
  },
  {
    title: 'Tack Shop',
    to: '/tack-shop',
    icon: null,
    Page: TackShopPage,
  },
  {
    title: 'Leathersmith Workshop',
    to: '/crafting',
    icon: null,
    Page: CraftingPage,
  },
  // Epic 12 — Stable management pages (routes only, linked from dashboard/nav)
  {
    title: 'Bank',
    to: '/bank',
    icon: null,
    Page: BankPage,
  },
  {
    title: 'Inventory',
    to: '/inventory',
    icon: null,
    Page: InventoryPage,
  },
  {
    title: 'My Stable',
    to: '/my-stable',
    icon: null,
    Page: MyStablePage,
  },
  // Epic 13 — Trainer System (World sub-location, accessible via World Hub card)
  {
    title: 'Trainers',
    to: '/trainers',
    icon: null,
    Page: TrainersPage,
  },
  // Epic 21 — Marketplace sub-routes (hub at /marketplace; sub-pages linked from hub cards)
  {
    title: 'Horse Marketplace',
    to: '/marketplace/horses',
    icon: null,
    Page: HorseMarketplacePage,
  },
  {
    title: 'Horse Trader',
    to: '/marketplace/horse-trader',
    icon: null,
    Page: HorseTraderPage,
  },
  // Epic 5 — Competition results and prize history (route-only; linked from competition browser / results modal)
  {
    title: 'Competition Results',
    to: '/competition-results',
    icon: null,
    Page: CompetitionResultsPage,
  },
  {
    title: 'Prize History',
    to: '/prizes',
    icon: null,
    Page: PrizeHistoryPage,
  },
  // Epic 11 — Community pages (Community linked from main nav; sub-pages route-only)
  {
    title: 'Community',
    to: '/community',
    icon: null,
    Page: CommunityPage,
  },
  {
    title: 'Message Board',
    to: '/message-board',
    icon: null,
    Page: MessageBoardPage,
  },
  {
    title: 'Thread',
    to: '/message-board/:threadId',
    icon: null,
    Page: MessageThreadPage,
  },
  {
    title: 'Clubs',
    to: '/clubs',
    icon: null,
    Page: ClubsPage,
  },
  {
    title: 'Messages',
    to: '/messages',
    icon: null,
    Page: MessagesPage,
  },
];

/**
 * Type definition for navigation items
 */
export type NavItem = {
  title: string;
  to: string;
  icon: React.ReactNode;
  Page: React.LazyExoticComponent<React.ComponentType>;
};
