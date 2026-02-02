import { Home, Dumbbell, HeartHandshake, Warehouse, User } from 'lucide-react';
import Index from './pages/Index';
import TrainingPage from './pages/TrainingPage';
import BreedingPage from './pages/BreedingPage';
import StableView from './pages/StableView';
import ProfilePage from './pages/ProfilePage';

/**
 * Navigation items for the Equoria application
 * Defines the main navigation structure with routes, icons, and page components
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
    title: 'Profile',
    to: '/profile',
    icon: <User className="h-4 w-4" />,
    page: <ProfilePage />,
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
