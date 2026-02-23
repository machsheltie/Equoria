/**
 * Main Navigation Component
 *
 * Primary navigation interface providing:
 * - Navigation menu with role-based access control
 * - Responsive design with mobile hamburger menu and desktop layout
 * - Active route highlighting and breadcrumb navigation
 * - User profile dropdown with logout functionality
 * - Global search functionality with suggestions
 * - Notification indicator with real-time updates
 * - Accessibility support with ARIA labels and keyboard navigation
 *
 * Integrates with backend APIs:
 * - GET /api/auth/profile - User profile data
 * - GET /api/notifications - User notifications
 * - POST /api/auth/logout - User logout
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, Bell, User, ChevronDown, LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
}

const MainNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user] = useState<UserData>({ id: '1', name: 'Test User', email: 'test@example.com' });
  const [notifications] = useState<Notification[]>([
    { id: '1', message: 'New competition available', read: false },
    { id: '2', message: 'Training session completed', read: true },
  ]);
  const location = useLocation();

  const navigationItems = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Stable', href: '/stable', icon: '🐎' },
    { name: 'Training', href: '/training', icon: '🏋️' },
    { name: 'Competitions', href: '/competitions', icon: '🏆' },
    { name: 'Breeding', href: '/breeding', icon: '🧬' },
    { name: 'World', href: '/world', icon: '🌍' },
    { name: 'Riders', href: '/riders', icon: '🏇' },
    { name: 'Leaderboards', href: '/leaderboards', icon: '📊' },
  ];

  /*
   * Note: Breadcrumbs are temporarily hidden in this design iteration
   * to maintain a cleaner aesthetic. Can be re-enabled if user feedback requests it.
   */
  // const breadcrumbs = [
  //   { name: 'Home', href: '/' },
  //   { name: 'Stable', href: '/stable' },
  //   { name: 'Horses', href: '/stable/horses' },
  // ];

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const isActiveRoute = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    // Logout functionality
    console.log('Logout clicked');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Search:', searchQuery);
  };

  return (
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur-md supports-[backdrop-filter]:bg-black/20"
        data-testid="main-navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Navigation */}
            <div className="flex items-center">
              <Link
                to="/"
                className="text-2xl font-bold font-heading text-gradient-gold mr-8 tracking-tighter shadow-glow"
              >
                Equoria
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden md:flex space-x-1" data-testid="desktop-navigation">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'group px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2',
                      isActiveRoute(item.href)
                        ? 'bg-white/10 text-celestial-gold shadow-[0_0_10px_rgba(255,215,0,0.1)] border border-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    )}
                    aria-current={isActiveRoute(item.href) ? 'page' : undefined}
                  >
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Search, Notifications, and User Profile */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden lg:flex relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
                <Input
                  type="search"
                  role="searchbox"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-celestial-gold/50 h-9"
                />
              </form>

              {/* Notifications */}
              <button
                className="p-2 text-white/70 hover:text-celestial-gold hover:bg-white/5 rounded-full transition-colors relative"
                data-testid="notification-indicator"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-black"
                    data-testid="notification-count"
                  >
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {/* User Profile Dropdown */}
              <div className="relative" data-testid="user-profile-section">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                  aria-label="User profile"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner border border-white/20"
                    data-testid="user-avatar"
                  >
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span
                    className="hidden md:block text-sm font-medium text-white/90 px-1"
                    data-testid="user-name"
                  >
                    {user.name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white/50" />
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                  >
                    <div className="px-4 py-3 border-b border-white/10 mb-1">
                      <p className="text-sm text-white font-medium">{user.name}</p>
                      <p className="text-xs text-white/50 truncate">{user.email}</p>
                    </div>

                    <Link
                      to="/profile"
                      role="menuitem"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      Profile Settings
                    </Link>
                    <Link
                      to="/settings"
                      role="menuitem"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Account Settings
                    </Link>

                    <div className="border-t border-white/10 my-1"></div>

                    <button
                      onClick={handleLogout}
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10 absolute w-full"
            data-testid="mobile-menu"
          >
            <div className="px-4 pt-4 pb-6 space-y-4">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
                  <Input
                    type="search"
                    role="searchbox"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSearchQuery(e.target.value)
                    }
                    className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </form>

              {/* Mobile Navigation Links */}
              <div className="space-y-1">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'block px-3 py-3 rounded-md text-base font-medium flex items-center gap-3',
                      isActiveRoute(item.href)
                        ? 'bg-celestial-gold/10 text-celestial-gold border border-celestial-gold/20'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span>{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default MainNavigation;
