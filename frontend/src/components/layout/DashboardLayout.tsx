/**
 * DashboardLayout — App-level shell for all authenticated pages (Section 07)
 *
 * Provides persistent compact top bar + content area with optional aside panel + footer.
 * StarfieldBackground is rendered at App level (above this).
 * Uses <Outlet /> from react-router-dom for nested route rendering.
 */

import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MainNavigation from '../MainNavigation';
import { AsidePanel } from './AsidePanel';
import { useResponsiveBackground } from '@/hooks/useResponsiveBackground';

/** Routes that show the aside panel on desktop */
const ASIDE_ROUTES = ['/', '/stable', '/my-stable'];

/** Routes that use the stable background instead of the default */
const STABLE_BG_ROUTES = ['/stable', '/my-stable'];

/** Routes that supply their own full-bleed background image */
const CUSTOM_BG_ROUTES: Record<string, string> = {
  '/feed-shop': '/images/feedstore2.webp',
  '/tack-shop': '/images/tackstore.webp',
};

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const showAside = ASIDE_ROUTES.includes(location.pathname);
  const responsiveBg = useResponsiveBackground();

  const isHorseDetail = location.pathname.startsWith('/horses/');
  const customBg = CUSTOM_BG_ROUTES[location.pathname];
  const bgImage = customBg
    ? customBg
    : isHorseDetail
      ? '/images/bg-horse-detail.webp'
      : STABLE_BG_ROUTES.includes(location.pathname)
        ? '/images/bg-stable.webp'
        : responsiveBg;

  return (
    <div
      className="min-h-screen relative flex flex-col"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
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
