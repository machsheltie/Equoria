/**
 * DashboardLayout — App-level shell for all authenticated pages
 *
 * Provides persistent MainNavigation + content area + atmospheric footer.
 * StarfieldBackground is rendered at App level (above this).
 * Uses <Outlet /> from react-router-dom for nested route rendering.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import MainNavigation from '../MainNavigation';

const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen relative flex flex-col">
      <MainNavigation />

      <main className="relative z-[var(--z-raised)] flex-1">
        <Outlet />
      </main>

      {/* Atmospheric footer — game world feel */}
      <footer className="relative z-[var(--z-raised)] mt-auto" aria-label="Game footer">
        {/* Top gold fade line */}
        <div
          className="h-px w-full"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.2), transparent)',
          }}
        />
        <div className="py-8 text-center">
          <p
            className="text-sm tracking-[0.2em] uppercase opacity-30 select-none"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--gold-500)',
              textShadow: '0 0 20px rgba(201,162,39,0.3)',
            }}
          >
            Equoria
          </p>
          <p className="text-[0.6rem] text-[var(--text-muted)] opacity-40 mt-1 tracking-wide">
            A world of horses, stars, and legacy
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
