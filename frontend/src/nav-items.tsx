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
} from 'lucide-react';
import Index from './pages/Index';
import TrainingPage from './pages/TrainingPage';
import BreedingPage from './pages/BreedingPage';
import StableView from './pages/StableView';
import ProfilePage from './pages/ProfilePage';
import CompetitionBrowserPage from './pages/CompetitionBrowserPage';
import WorldHubPage from './pages/WorldHubPage';
import SettingsPage from './pages/SettingsPage';
import LeaderboardsPage from './pages/LeaderboardsPage';
import RidersPage from './pages/RidersPage';
import GroomsPage from './pages/GroomsPage';
import VeterinarianPage from './pages/VeterinarianPage';
import FarrierPage from './pages/FarrierPage';
import FeedShopPage from './pages/FeedShopPage';
import TackShopPage from './pages/TackShopPage';
// Epic 12 — Stable Management pages
import BankPage from './pages/BankPage';
import InventoryPage from './pages/InventoryPage';
import MyStablePage from './pages/MyStablePage';
// Epic 11 — Community pages
import CommunityPage from './pages/CommunityPage';
import MessageBoardPage from './pages/MessageBoardPage';
import ClubsPage from './pages/ClubsPage';
import MessagesPage from './pages/MessagesPage';

/**
 * Navigation items for the Equoria application
 * Defines the main navigation structure with routes, icons, and page components.
 * World sub-location routes (/vet, /farrier, /grooms, etc.) are registered here
 * for App.tsx route mapping but do not appear in the main navigation bar.
 */
export const navItems = [
  {
    title: 'Home',
    to: '/',
    icon: <Home className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: 'My Stable',
    to: '/stable',
    icon: <Warehouse className="h-4 w-4" />,
    page: <StableView />,
  },
  {
    title: 'Training',
    to: '/training',
    icon: <Dumbbell className="h-4 w-4" />,
    page: <TrainingPage />,
  },
  {
    title: 'Breeding',
    to: '/breeding',
    icon: <HeartHandshake className="h-4 w-4" />,
    page: <BreedingPage />,
  },
  {
    title: 'Competitions',
    to: '/competitions',
    icon: <Trophy className="h-4 w-4" />,
    page: <CompetitionBrowserPage />,
  },
  {
    title: 'World',
    to: '/world',
    icon: <Globe className="h-4 w-4" />,
    page: <WorldHubPage />,
  },
  {
    title: 'Riders',
    to: '/riders',
    icon: <PersonStanding className="h-4 w-4" />,
    page: <RidersPage />,
  },
  {
    title: 'Leaderboards',
    to: '/leaderboards',
    icon: <BarChart3 className="h-4 w-4" />,
    page: <LeaderboardsPage />,
  },
  {
    title: 'Settings',
    to: '/settings',
    icon: <Settings className="h-4 w-4" />,
    page: <SettingsPage />,
  },
  {
    title: 'Profile',
    to: '/profile',
    icon: <User className="h-4 w-4" />,
    page: <ProfilePage />,
  },
  // World sub-locations — routes only, not shown in main nav bar
  {
    title: 'Grooms',
    to: '/grooms',
    icon: null,
    page: <GroomsPage />,
  },
  {
    title: 'Vet Clinic',
    to: '/vet',
    icon: null,
    page: <VeterinarianPage />,
  },
  {
    title: 'Farrier',
    to: '/farrier',
    icon: null,
    page: <FarrierPage />,
  },
  {
    title: 'Feed Shop',
    to: '/feed-shop',
    icon: null,
    page: <FeedShopPage />,
  },
  {
    title: 'Tack Shop',
    to: '/tack-shop',
    icon: null,
    page: <TackShopPage />,
  },
  // Epic 12 — Stable management pages (routes only, linked from dashboard/nav)
  {
    title: 'Bank',
    to: '/bank',
    icon: null,
    page: <BankPage />,
  },
  {
    title: 'Inventory',
    to: '/inventory',
    icon: null,
    page: <InventoryPage />,
  },
  {
    title: 'My Stable',
    to: '/my-stable',
    icon: null,
    page: <MyStablePage />,
  },
  // Epic 11 — Community pages (Community linked from main nav; sub-pages route-only)
  {
    title: 'Community',
    to: '/community',
    icon: null,
    page: <CommunityPage />,
  },
  {
    title: 'Message Board',
    to: '/message-board',
    icon: null,
    page: <MessageBoardPage />,
  },
  {
    title: 'Clubs',
    to: '/clubs',
    icon: null,
    page: <ClubsPage />,
  },
  {
    title: 'Messages',
    to: '/messages',
    icon: null,
    page: <MessagesPage />,
  },
];

/**
 * Type definition for navigation items
 */
export type NavItem = {
  title: string;
  to: string;
  icon: React.ReactNode;
  page: React.ReactNode;
};
