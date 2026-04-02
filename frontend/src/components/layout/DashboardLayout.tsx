/**
 * DashboardLayout — App-level shell for all authenticated pages (Section 07)
 *
 * Provides persistent compact top bar + content area with optional aside panel + footer.
 * PageBackground renders the scene-appropriate background behind all content.
 * Uses <Outlet /> from react-router-dom for nested route rendering.
 */

import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MainNavigation from '../MainNavigation';
import { AsidePanel } from './AsidePanel';
import { PageBackground } from './PageBackground';
import type { SceneKey } from '@/hooks/useResponsiveBackground';

/** Routes that show the aside panel on desktop */
const ASIDE_ROUTES = ['/', '/stable', '/my-stable'];

/**
 * Derive the PageBackground scene from the current route pathname.
 * Order matters — more specific prefixes checked before generic ones.
 */
function getSceneForPath(pathname: string): SceneKey {
  if (pathname === '/') return 'hub';
  if (pathname.startsWith('/horses/')) return 'horse-detail';
  if (pathname === '/horses' || pathname === '/my-stable' || pathname === '/stable')
    return 'stable';
  if (pathname.startsWith('/training')) return 'training';
  if (pathname.startsWith('/competition')) return 'competition';
  if (pathname.startsWith('/breeding') || pathname.startsWith('/foal')) return 'breeding';
  if (
    pathname.startsWith('/world') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/clubs') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/message-board')
  )
    return 'world';
  return 'default';
}

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const showAside = ASIDE_ROUTES.includes(location.pathname);
  const scene = getSceneForPath(location.pathname);

  return (
    <div className="min-h-screen relative flex flex-col">
      <PageBackground scene={scene} />

      {/* Skip-to-content link — visible on focus (WCAG 2.1 §13) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-modal)] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--gold-primary)] focus:text-[var(--bg-deep-space)] focus:font-semibold focus:outline-none"
      >
        Skip to main content
      </a>
      <MainNavigation />

      <div className="relative z-[var(--z-raised)] flex-1 flex max-w-[1440px] mx-auto w-full px-4 md:px-8 gap-6">
        <main id="main-content" className="flex-1 min-w-0">
          <Outlet />
        </main>
        {showAside && <AsidePanel />}
      </div>

      {/* Atmospheric footer — game world feel */}
      <footer
        className="relative z-[var(--z-raised)] mt-auto border-t border-[var(--glass-border)]"
        aria-label="Game footer"
        style={{
          background: 'rgba(15, 25, 50, 0.55)',
          backdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)',
          WebkitBackdropFilter: 'blur(10px) saturate(1.3) brightness(1.1)',
        }}
      >
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
              color: 'var(--gold-primary)',
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
