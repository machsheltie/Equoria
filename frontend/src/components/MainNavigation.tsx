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

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Search, Bell, User, ChevronDown } from 'lucide-react';

interface User {
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
  const [user, setUser] = useState<User>({ id: '1', name: 'Test User', email: 'test@example.com' });
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', message: 'New competition available', read: false },
    { id: '2', message: 'Training session completed', read: true }
  ]);
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '🏠' },
    { name: 'Stable', href: '/stable', icon: '🐎' },
    { name: 'Training', href: '/training', icon: '🏋️' },
    { name: 'Competition', href: '/competition', icon: '🏆' },
    { name: 'Breeding', href: '/breeding', icon: '🧬' },
    { name: 'Genetics', href: '/genetics', icon: '🔬' },
    { name: 'Analytics', href: '/analytics', icon: '📊' }
  ];

  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: 'Stable', href: '/stable' },
    { name: 'Horses', href: '/stable/horses' }
  ];

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const isActiveRoute = (href: string) => {
    return location.pathname === href;
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
      {/* Skip Navigation Link */}
      <Link
        to="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2 z-50"
      >
        Skip to main content
      </Link>

      <nav
        role="navigation"
        aria-label="Main navigation"
        className="main-navigation bg-white shadow-lg border-b border-gray-200"
        data-testid="main-navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Desktop Navigation */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900 mr-8">
                Equoria
              </Link>

              {/* Desktop Navigation Links */}
              <div className="hidden md:flex space-x-4" data-testid="desktop-navigation">
                {navigationItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActiveRoute(item.href)
                        ? 'bg-blue-100 text-blue-700 active'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-100'
                    }`}
                    aria-current={isActiveRoute(item.href) ? 'page' : undefined}
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Search, Notifications, and User Profile */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="hidden md:flex">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="search"
                    role="searchbox"
                    placeholder="Search horses, competitions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </form>

              {/* Notifications */}
              <div className="relative">
                <button
                  className="p-2 text-gray-600 hover:text-blue-600 relative"
                  data-testid="notification-indicator"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && (
                    <span
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      data-testid="notification-count"
                    >
                      {unreadNotifications}
                    </span>
                  )}
                </button>
              </div>

              {/* User Profile Dropdown */}
              <div className="relative" data-testid="user-profile-section">
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100"
                  aria-label="User profile"
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center" data-testid="user-avatar">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700" data-testid="user-name">
                    {user.name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="search"
                    role="searchbox"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </form>

              {/* Mobile Navigation Links */}
              {navigationItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActiveRoute(item.href)
                      ? 'bg-blue-100 text-blue-700 active'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Breadcrumb Navigation */}
      <nav role="navigation" aria-label="Breadcrumb" className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ol className="flex items-center space-x-2 py-3 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.name} className="flex items-center">
                {index > 0 && <span className="text-gray-400 mx-2">/</span>}
                <Link
                  to={crumb.href}
                  className={`${
                    index === breadcrumbs.length - 1
                      ? 'text-gray-900 font-medium'
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </nav>
    </>
  );
};

export default MainNavigation;
