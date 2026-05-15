/**
 * Main Navigation Component Tests
 *
 * Tests for the compact top-bar navigation (Section 07 — direction-4-hybrid).
 * Layout: [hamburger] [EQUORIA logo] [breadcrumb] ... [coins] [bell] [avatar] [logout]
 *
 * Many earlier expectations (desktop sidebar links, role-based admin links,
 * search input, mobile menu toggle, profile dropdown menu, skip-to-content link)
 * were features of an older MainNavigation. The current component is intentionally
 * minimal — those features now live in SidebarNav, NavPanel, or are removed.
 *
 * Tests below preserve original behavioral intents that still apply to the
 * current component (rendering, links, accessibility, logout, notifications)
 * and drop intents tied to extinct features.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '../../test/utils';

// Mocks for the unread-badge math tests (Equoria-x44k).
// These are hooks, not the api-client; per CLAUDE.md, hook-level mocks are
// acceptable for unit-testing the component's totalUnread derivation.
const mockUseUnreadCount = vi.fn();
const mockUseGameNotifications = vi.fn();

vi.mock('@/hooks/api/useMessages', async () => {
  const actual =
    await vi.importActual<typeof import('@/hooks/api/useMessages')>('@/hooks/api/useMessages');
  return {
    ...actual,
    useUnreadCount: () => mockUseUnreadCount(),
  };
});

vi.mock('@/hooks/api/useGameNotifications', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/api/useGameNotifications')>(
    '@/hooks/api/useGameNotifications'
  );
  return {
    ...actual,
    useGameNotifications: () => mockUseGameNotifications(),
  };
});

import MainNavigation from '../MainNavigation';

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
    // Default: no unread of either kind. Individual tests below override.
    mockUseUnreadCount.mockReturnValue({ data: { count: 0 } });
    mockUseGameNotifications.mockReturnValue({ data: { unreadCount: 0, notifications: [] } });
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

    // Equoria-x44k — totalUnread = dmUnread + gameUnread math (MainNavigation.tsx:33-38)
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
        mockUseUnreadCount.mockReturnValue({ data: { count: 0 } });
        mockUseGameNotifications.mockReturnValue({
          data: { unreadCount: 2, notifications: [] },
        });

        const bell = await renderBell();
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
        expect(bell).toHaveAttribute('aria-label', 'Notifications, 2 unread');
      });

      test('dmUnread=3, gameUnread=2 → aria-label "5 unread" (sums both)', async () => {
        mockUseUnreadCount.mockReturnValue({ data: { count: 3 } });
        mockUseGameNotifications.mockReturnValue({
          data: { unreadCount: 2, notifications: [] },
        });

        const bell = await renderBell();
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
        // Math sanity: 3 DMs + 2 game notifications = 5 unread total.
        // Asserts the bell does NOT show just dmUnread (3) or just gameUnread (2).
        expect(bell).toHaveAttribute('aria-label', 'Notifications, 5 unread');
      });

      test('dmUnread=0, gameUnread=0 → no dot, no count in aria-label', async () => {
        mockUseUnreadCount.mockReturnValue({ data: { count: 0 } });
        mockUseGameNotifications.mockReturnValue({
          data: { unreadCount: 0, notifications: [] },
        });

        const bell = await renderBell();
        expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument();
        expect(bell).toHaveAttribute('aria-label', 'Notifications');
      });

      test('only dmUnread set (gameUnread=0) → dot visible, math = dmUnread', async () => {
        mockUseUnreadCount.mockReturnValue({ data: { count: 4 } });
        mockUseGameNotifications.mockReturnValue({
          data: { unreadCount: 0, notifications: [] },
        });

        const bell = await renderBell();
        expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
        expect(bell).toHaveAttribute('aria-label', 'Notifications, 4 unread');
      });

      test('hooks return undefined data → defaults to 0, no dot', async () => {
        // Guards the `?? 0` fallback at MainNavigation.tsx:36-37.
        mockUseUnreadCount.mockReturnValue({ data: undefined });
        mockUseGameNotifications.mockReturnValue({ data: undefined });

        const bell = await renderBell();
        expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument();
        expect(bell).toHaveAttribute('aria-label', 'Notifications');
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
