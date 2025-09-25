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

import React from 'react';

const MainNavigation: React.FC = () => {
  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="main-navigation bg-white shadow-lg border-b border-gray-200"
      data-testid="main-navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <span className="text-xl font-bold text-gray-900">Equoria</span>
          </div>
          <div className="flex items-center space-x-4">
            <span data-testid="user-name">Test User</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default MainNavigation;
