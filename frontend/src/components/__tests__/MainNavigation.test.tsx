/**
 * Main Navigation Component Tests
 *
 * Tests for the compact top-bar navigation (Section 07 — direction-4-hybrid).
 * Layout: [hamburger] [EQUORIA logo] [breadcrumb] ... [coins] [bell] [avatar] [logout]
 *
 * Boundary-level (Equoria-fefh2.12): the nav renders against the REAL
 * `useUnreadCount` (DMs) and `useGameNotifications` hooks (real React Query +
 * real `apiClient`) with the network boundary stubbed by MSW
 * (`server.use(...)`) — NOT `vi.mock('@/hooks/api/useMessages')` /
 * `vi.mock('@/hooks/api/useGameNotifications')`. This exercises the real
 * `{ success, data: { count } }` and `{ success, data: { notifications,
 * unreadCount } }` envelope unwraps and the real `totalUnread = dmUnread +
 * gameUnread` derivation end-to-end against the EXACT wire shapes produced by:
 *   - backend/modules/community/controllers/messageController.mjs#getUnreadCount
 *     → `res.json({ success: true, data: { count } })`
 *   - backend/modules/users/controllers/userController.mjs#getGameNotifications
 *     → `res.json({ success: true, data: { notifications, unreadCount } })`
 *
 * The badge-math tests drive the two counts per-test with inline
 * `server.use(...)` overrides; the bell is async because the counts arrive
 * over the (stubbed) network rather than from a synchronous module mock.
 *
 * Many earlier expectations (desktop sidebar links, role-based admin links,
 * search input, mobile menu toggle, profile dropdown menu, skip-to-content link)
 * were features of an older MainNavigation. The current component is intentionally
 * minimal — those features now live in SidebarNav, NavPanel, or are removed.
 *
 * `useEventStream` is real and degrades silently in jsdom (no `EventSource`),
 * so it issues no network call and needs no boundary stub.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, test, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '../../test/utils';
import { server } from '@/test/msw/server';

import MainNavigation from '../MainNavigation';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const UNREAD_COUNT_PATH = `${base}/api/v1/messages/unread-count`;
const GAME_NOTIFS_PATH = `${base}/api/v1/users/me/game-notifications`;

/**
 * Stub the DM unread-count boundary with the REAL backend envelope
 * (`{ success, data: { count } }`). apiClient unwraps `.data` → `{ count }`.
 */
function stubDmUnread(count: number) {
  server.use(
    http.get(UNREAD_COUNT_PATH, () => HttpResponse.json({ success: true, data: { count } }))
  );
}

/**
 * Stub the game-notifications boundary with the REAL backend envelope
 * (`{ success, data: { notifications, unreadCount } }`). apiClient unwraps
 * `.data` → `{ notifications, unreadCount }`.
 */
function stubGameNotifs(unreadCount: number) {
  server.use(
    http.get(GAME_NOTIFS_PATH, () =>
      HttpResponse.json({ success: true, data: { notifications: [], unreadCount } })
    )
  );
}

// Test wrapper with required providers
const createTestWrapper = (initialRoute = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

describe('MainNavigation Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
    // Default: no unread of either kind. Individual tests below override the
    // boundary with stubDmUnread / stubGameNotifs to drive the badge math.
    stubDmUnread(0);
    stubGameNotifs(0);
  });

  describe('Component Rendering', () => {
    test('renders main navigation banner', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
    });

    test('renders the Equoria logo as a link to home', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const logoLink = screen.getByRole('link', { name: /equoria/i });
      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute('href', '/');
    });

    test('uses banner role for the navigation header', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });
  });

  describe('Hamburger Menu Trigger', () => {
    test('renders hamburger button by default (mobile / tablet)', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByTestId('hamburger-menu')).toBeInTheDocument();
    });

    test('hides hamburger when hideHamburger prop is true (desktop)', () => {
      render(
        <TestWrapper>
          <MainNavigation hideHamburger />
        </TestWrapper>
      );

      expect(screen.queryByTestId('hamburger-menu')).not.toBeInTheDocument();
    });

    test('calls onOpenNav when hamburger is clicked', () => {
      const onOpenNav = vi.fn();
      render(
        <TestWrapper>
          <MainNavigation onOpenNav={onOpenNav} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('hamburger-menu'));
      expect(onOpenNav).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Profile Section', () => {
    test('shows user avatar link to settings', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('href', '/settings');
    });

    test('renders coins display showing user money', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const coins = screen.getByTestId('coins-display');
      expect(coins).toBeInTheDocument();
      // Default mock user has money: 5000
      expect(coins).toHaveTextContent('5,000');
      expect(coins).toHaveAttribute('href', '/bank');
    });

    test('includes logout button', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });

  describe('Notifications', () => {
    test('renders the notification indicator', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-indicator')).toBeInTheDocument();
      });
    });

    test('notification indicator links to messages page', async () => {
      const bell = await renderAndFindBell();
      expect(bell).toHaveAttribute('href', '/messages');
    });

    // Equoria-x44k — totalUnread = dmUnread + gameUnread math (MainNavigation.tsx:43-45)
    describe('Combined DM + game-notification unread badge (Equoria-x44k)', () => {
      const renderBell = async () => {
        render(
          <TestWrapper>
            <MainNavigation />
          </TestWrapper>
        );
        return screen.findByTestId('notification-indicator');
      };

      test('dmUnread=0, gameUnread=2 → dot visible, aria-label "2 unread"', async () => {
        stubDmUnread(0);
        stubGameNotifs(2);

        const bell = await renderBell();
        await waitFor(() => expect(bell).toHaveAttribute('aria-label', 'Notifications, 2 unread'));
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
      });

      test('dmUnread=3, gameUnread=2 → aria-label "5 unread" (sums both)', async () => {
        stubDmUnread(3);
        stubGameNotifs(2);

        const bell = await renderBell();
        // Math sanity: 3 DMs + 2 game notifications = 5 unread total.
        // Asserts the bell does NOT show just dmUnread (3) or just gameUnread (2).
        await waitFor(() => expect(bell).toHaveAttribute('aria-label', 'Notifications, 5 unread'));
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
      });

      test('dmUnread=0, gameUnread=0 → no dot, no count in aria-label', async () => {
        stubDmUnread(0);
        stubGameNotifs(0);

        const bell = await renderBell();
        // Counts resolve to 0 over the wire; bell stays unadorned.
        await waitFor(() => expect(bell).toHaveAttribute('aria-label', 'Notifications'));
        expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument();
      });

      test('only dmUnread set (gameUnread=0) → dot visible, math = dmUnread', async () => {
        stubDmUnread(4);
        stubGameNotifs(0);

        const bell = await renderBell();
        await waitFor(() => expect(bell).toHaveAttribute('aria-label', 'Notifications, 4 unread'));
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
      });

      test('boundary errors → counts default to 0, no dot', async () => {
        // Guards the `?? 0` fallback at MainNavigation.tsx:43-44. When both
        // reads fail (retry:false), `data` is undefined and totalUnread is 0.
        server.use(
          http.get(UNREAD_COUNT_PATH, () =>
            HttpResponse.json({ success: false, message: 'fail' }, { status: 500 })
          ),
          http.get(GAME_NOTIFS_PATH, () =>
            HttpResponse.json({ success: false, message: 'fail' }, { status: 500 })
          )
        );

        const bell = await renderBell();
        await waitFor(() => expect(bell).toHaveAttribute('aria-label', 'Notifications'));
        expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument();
      });
    });
  });

  // Local helper used by the Notifications group above.
  async function renderAndFindBell() {
    render(
      <TestWrapper>
        <MainNavigation />
      </TestWrapper>
    );
    return screen.findByTestId('notification-indicator');
  }

  describe('Accessibility', () => {
    test('provides aria-label on hamburger button', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    test('provides aria-label on logout button', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });

    test('provides aria-label on user avatar link', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /user settings/i })).toBeInTheDocument();
    });

    test('supports keyboard focus on links', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const allLinks = await screen.findAllByRole('link');
      expect(allLinks.length).toBeGreaterThan(0);
      const firstLink = allLinks[0];
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);
    });
  });

  describe('Performance', () => {
    test('loads navigation within acceptable time limits', async () => {
      const startTime = Date.now();

      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
    });
  });
});
