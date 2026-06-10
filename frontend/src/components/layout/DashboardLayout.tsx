/**
 * DashboardLayout — App-level shell for all authenticated pages (Section 07)
 *
 * Provides persistent compact top bar + content area with optional aside panel + footer.
 * PageBackground renders the scene-appropriate background behind all content.
 * Uses <Outlet /> from react-router-dom for nested route rendering.
 */

import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MainNavigation from '../MainNavigation';
import { AsidePanel } from './AsidePanel';
import { usePageBackground } from './PageBackground';
import { SidebarNav } from './SidebarNav';
import { BottomNav } from './BottomNav';
import { NavPanel } from './NavPanel';
import {
  ContextualBottomActionsProvider,
  useContextualBottomActionsHost,
} from './ContextualBottomActions';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { SceneKey } from '@/hooks/useResponsiveBackground';

/** Routes that show the aside panel on desktop */
const ASIDE_ROUTES = ['/', '/stable', '/my-stable'];

/**
 * Routes with dedicated artwork that must not be overridden by the scene
 * system. These were established before Epic 22 and ship with real images.
 */
const STATIC_BG: Record<string, string> = {
  '/stable': '/images/bg-stable.webp',
  '/my-stable': '/images/bg-stable.webp',
  '/farrier': '/assets/art/farrier.webp',
  '/vet': '/images/equinehospital.webp',
  '/feed-shop': '/images/feedstore2.webp',
  '/tack-shop': '/images/tackstore.webp',
};

/**
 * Derive the PageBackground scene from the current route pathname.
 * Only called for routes not covered by STATIC_BG or horse-detail.
 *
 * The `useResponsiveBackground` hook consults `SCENES_WITH_ART` and
 * transparently falls back to the generic /images/bg-{ratio}.webp pair
 * when a scene's art has not yet been delivered. We therefore ALWAYS
 * return the semantically-correct scene here — adding new scene art is a
 * one-line change in useResponsiveBackground.ts rather than here.
 */
function getSceneForPath(pathname: string): SceneKey {
  if (pathname === '/') return 'hub';
  if (pathname.startsWith('/training')) return 'training';
  if (pathname.startsWith('/competition')) return 'competition';
  if (pathname.startsWith('/breeding') || pathname.startsWith('/foal')) return 'breeding';
  if (pathname === '/horses' || pathname === '/stable' || pathname === '/my-stable')
    return 'stable';
  if (pathname.startsWith('/horses/')) return 'horse-detail';
  if (
    pathname.startsWith('/world') ||
    pathname.startsWith('/community') ||
    pathname.startsWith('/clubs') ||
    pathname.startsWith('/messages') ||
    pathname.startsWith('/message-board')
  ) {
    return 'world';
  }
  return 'default';
}

const DashboardLayout: React.FC = () => {
  const location = useLocation();
  const showAside = ASIDE_ROUTES.includes(location.pathname);

  // Story 22-8 — viewport-driven nav shell
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Equoria-o5hub.5 (D-24) — single contextual bottom-action slot. Pages
  // register an action bar via <ContextualBottomActions>; while one is
  // registered the content column reserves nav+actions space and the slot
  // renders fixed above BottomNav (mobile) / at the viewport bottom (md+).
  const bottomActions = useContextualBottomActionsHost();

  // Static routes: use existing artwork as-is.
  // Horse detail: fixed single image regardless of viewport ratio.
  // Everything else: scene-based responsive background.
  const staticSrc =
    STATIC_BG[location.pathname] ??
    (location.pathname.startsWith('/horses/') ? '/images/bg-horse-detail.webp' : undefined);
  const scene = staticSrc ? undefined : getSceneForPath(location.pathname);
  const bgStyle = usePageBackground({ scene, src: staticSrc });

  return (
    <ContextualBottomActionsProvider value={bottomActions.contextValue}>
      <div className="min-h-screen relative flex" style={bgStyle}>
        {/* Skip-to-content link — visible on focus (WCAG 2.1 §13) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-modal)] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--gold-primary)] focus:text-[var(--bg-deep-space)] focus:font-semibold focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Desktop-only left sidebar (≥1024px). Below that, MobileNav/BottomNav takes over. */}
        {isDesktop && <SidebarNav />}

        {/* Main column (top bar + content + footer + optional bottom nav spacer) */}
        <div className="flex-1 flex flex-col min-w-0">
          <MainNavigation onOpenNav={() => setIsNavOpen(true)} hideHamburger={isDesktop} />

          <div
            className={cn(
              'relative z-[var(--z-raised)] flex-1 flex max-w-[1440px] mx-auto w-full px-4 md:px-8 gap-6',
              bottomActions.hasActions
                ? // Contextual bar registered: reserve nav+actions+gap on
                  // mobile, actions+gap on desktop (tokens.css combined calcs).
                  'pb-[var(--content-bottom-reserve)] md:pb-[var(--content-bottom-reserve-desktop)]'
                : // Default: nav-only reservation (+ safe-area, 0px off-iOS —
                  // computed-identical to the pre-o5hub.5 padding elsewhere).
                  'pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+1rem)] md:pb-0'
            )}
          >
            <main id="main-content" className="flex-1 min-w-0">
              <Outlet />
            </main>
            {showAside && <AsidePanel />}
          </div>

          {/* Atmospheric footer — game world feel (Story 22-7, tokenised) */}
          <footer
            className="relative z-[var(--z-raised)] mt-auto border-t border-[var(--glass-border)]"
            aria-label="Game footer"
            style={{
              background: 'var(--footer-bg)',
              backdropFilter: 'var(--glass-bg-filter)',
              WebkitBackdropFilter: 'var(--glass-bg-filter)',
            }}
          >
            {/* Top gold fade line */}
            <div
              className="h-px w-full"
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--footer-divider-gold), transparent)',
              }}
            />
            <div className="py-8 text-center">
              <p
                className="text-sm tracking-[0.2em] uppercase opacity-30 select-none"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--gold-primary)',
                  textShadow: 'var(--footer-gold-glow)',
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

        {/* Contextual bottom-action slot (Equoria-o5hub.5 / D-24) — rendered
          only while a page has registered actions. Sits ABOVE BottomNav on
          mobile (offset = nav height + safe area) and at the viewport bottom
          on md+ (BottomNav is hidden ≥768px; only the safe-area offset
          remains). --z-nav tier, NOT --z-modal: dialogs must layer above. */}
        {bottomActions.hasActions && (
          <div
            ref={bottomActions.setContainer}
            data-testid="contextual-bottom-actions"
            className="fixed left-0 right-0 z-[var(--z-nav)] bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))] md:bottom-[var(--safe-area-bottom)]"
          />
        )}

        {/* Mobile-only bottom navigation bar (< 768px) */}
        {!isDesktop && <BottomNav onMoreClick={() => setIsNavOpen(true)} />}

        {/* Full navigation overlay — opened by hamburger OR bottom-nav "More" */}
        <NavPanel isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
      </div>
    </ContextualBottomActionsProvider>
  );
};

export default DashboardLayout;
