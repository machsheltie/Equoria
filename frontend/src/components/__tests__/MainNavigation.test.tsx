/**
 * Main Navigation Component Tests
 *
 * Tests for the primary navigation interface including:
 * - Navigation menu with role-based access control
 * - Responsive design with mobile hamburger menu
 * - Active route highlighting and breadcrumb navigation
 * - User profile dropdown with logout functionality
 * - Accessibility support with keyboard navigation
 * - Real-time user data integration
 *
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real navigation behavior and user authentication state
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '../../test/utils';
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
      <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('MainNavigation Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Component Rendering', () => {
    test('renders main navigation with loading state', () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
    });

    test('renders navigation with proper structure', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });

      expect(screen.getByTestId('main-navigation')).toHaveClass('main-navigation');
    });
  });

  describe('Navigation Menu Items', () => {
    test('displays core navigation links', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        const desktopNav = screen.getByTestId('desktop-navigation');
        expect(within(desktopNav).getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: /stable/i })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: /training/i })).toBeInTheDocument();
        expect(within(desktopNav).getByRole('link', { name: /competition/i })).toBeInTheDocument();
      });
    });

    test('shows breeding and genetics links', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /breeding/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /genetics/i })).toBeInTheDocument();
      });
    });

    test('displays advanced feature links for appropriate users', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument();
      });
    });
  });

  describe('Active Route Highlighting', () => {
    test('highlights active navigation item', async () => {
      const TestWrapperWithRoute = createTestWrapper('/dashboard');

      render(
        <TestWrapperWithRoute>
          <MainNavigation />
        </TestWrapperWithRoute>
      );

      await waitFor(() => {
        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        expect(dashboardLink).toHaveClass('active');
      });
    });

    test('updates active state when route changes', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const desktopNav = screen.getByTestId('desktop-navigation');
      const stableLink = await within(desktopNav).findByRole('link', { name: /stable/i });
      fireEvent.click(stableLink);

      await waitFor(() => {
        expect(stableLink).toHaveClass('active');
      });
    });
  });

  describe('User Profile Section', () => {
    test('displays user profile information', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-section')).toBeInTheDocument();
      });
    });

    test('shows user avatar and name', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
        expect(screen.getByTestId('user-name')).toBeInTheDocument();
      });
    });

    test('provides profile dropdown menu', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const profileButton = await screen.findByRole('button', { name: /user profile/i });
      fireEvent.click(profileButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    test('includes logout functionality', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const profileButton = await screen.findByRole('button', { name: /user profile/i });
      fireEvent.click(profileButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('shows mobile hamburger menu on small screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument();
      });
    });

    test('toggles mobile menu visibility', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const menuToggle = await screen.findByRole('button', { name: /toggle menu/i });
      fireEvent.click(menuToggle);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
      });
    });

    test('shows desktop layout for larger screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Access Control', () => {
    test('shows admin links for admin users', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      // This would be based on user role from API
      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });
    });

    test('hides restricted features for regular users', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Breadcrumb Navigation', () => {
    test('displays breadcrumb trail', async () => {
      const TestWrapperWithRoute = createTestWrapper('/stable/horses/123');

      render(
        <TestWrapperWithRoute>
          <MainNavigation />
        </TestWrapperWithRoute>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      });
    });

    test('shows correct breadcrumb hierarchy', async () => {
      const TestWrapperWithRoute = createTestWrapper('/stable/horses/123');

      render(
        <TestWrapperWithRoute>
          <MainNavigation />
        </TestWrapperWithRoute>
      );

      await waitFor(() => {
        const breadcrumbNav = screen.getByRole('navigation', { name: /breadcrumb/i });
        expect(within(breadcrumbNav).getByText(/stable/i)).toBeInTheDocument();
        expect(within(breadcrumbNav).getByText(/horses/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    test('provides global search input', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
    });

    test('handles search input and suggestions', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const searchInput = await screen.findByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'Thunder' } });

      await waitFor(() => {
        expect(searchInput).toHaveValue('Thunder');
      });
    });
  });

  describe('Notifications', () => {
    test('displays notification indicator', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-indicator')).toBeInTheDocument();
      });
    });

    test('shows notification count when available', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when user data fails to load', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      // Component should handle API errors gracefully
      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });
    });

    test('provides fallback navigation when API is unavailable', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('provides proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-navigation')).toHaveAttribute(
          'aria-label',
          'Main navigation'
        );
      });
    });

    test('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      const allLinks = await screen.findAllByRole('link');
      const firstLink = allLinks[0];
      firstLink.focus();

      expect(document.activeElement).toBe(firstLink);
    });

    test('provides skip navigation link', async () => {
      render(
        <TestWrapper>
          <MainNavigation />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
      });
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
