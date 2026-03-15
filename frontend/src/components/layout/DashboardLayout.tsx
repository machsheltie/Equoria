/**
 * DashboardLayout — App-level shell for all authenticated pages
 *
 * Provides persistent MainNavigation + content area.
 * StarfieldBackground is rendered at App level (above this).
 * Uses <Outlet /> from react-router-dom for nested route rendering.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import MainNavigation from '../MainNavigation';

const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen relative">
      <MainNavigation />

      <main className="relative z-[var(--z-raised)]">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
