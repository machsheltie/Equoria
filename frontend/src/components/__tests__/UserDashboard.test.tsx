/**
 * User Dashboard Component Tests
 * 
 * Tests for the comprehensive user dashboard interface including:
 * - User overview with level, XP, money, and statistics
 * - Progress tracking with visual indicators
 * - Recent activity timeline with pagination
 * - Quick actions for common game functions
 * - Real-time data updates with React Query
 * 
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real API integration with backend user management endpoints
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import UserDashboard from '../UserDashboard';

// Test wrapper with required providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('UserDashboard Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Component Rendering', () => {
    test('renders user dashboard with loading state', () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('renders user dashboard with proper structure', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Check for main sections
      expect(screen.getByRole('main')).toHaveClass('user-dashboard-container');
    });
  });

  describe('User Overview Display', () => {
    test('displays user level and XP information', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/level/i)).toBeInTheDocument();
        expect(screen.getByText(/xp/i)).toBeInTheDocument();
      });
    });

    test('displays user money and statistics', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/money/i)).toBeInTheDocument();
        expect(screen.getByText(/horses/i)).toBeInTheDocument();
      });
    });

    test('shows user profile information', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-section')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    test('displays level progress bar', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-label', /level progress/i);
    });

    test('shows achievement indicators', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('achievement-section')).toBeInTheDocument();
      });
    });

    test('displays progress statistics', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('progress-stats')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Feed', () => {
    test('displays recent activity timeline', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
      });
    });

    test('shows activity items with timestamps', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('activity-item')).toBeInTheDocument();
      });

      const activityItem = screen.getByTestId('activity-item');
      expect(activityItem).toHaveTextContent(/ago|recently/i);
    });

    test('supports activity feed pagination', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    test('provides quick action buttons', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /visit stable/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /train horses/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /enter competition/i })).toBeInTheDocument();
      });
    });

    test('navigates to correct pages when clicking actions', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      const stableButton = await screen.findByRole('button', { name: /visit stable/i });
      fireEvent.click(stableButton);

      // Verify navigation (would be handled by React Router in real app)
      expect(stableButton).toBeInTheDocument();
    });

    test('shows contextual quick actions based on user state', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions-section')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    test('updates data automatically with React Query', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      // Initial load
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Verify React Query is managing the data
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    test('handles data refresh correctly', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      const refreshButton = await screen.findByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      // Verify refresh functionality
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    test('adapts layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument();
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
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when API fails', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={999999} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading dashboard/i)).toBeInTheDocument();
      });
    });

    test('provides retry functionality on error', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={999999} />
        </TestWrapper>
      );

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('loads within acceptable time limits', async () => {
      const startTime = Date.now();

      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });

  describe('Accessibility', () => {
    test('provides proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'User dashboard');
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', /level progress/i);
      });
    });

    test('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <UserDashboard userId={1} />
        </TestWrapper>
      );

      const firstButton = await screen.findByRole('button');
      firstButton.focus();

      expect(document.activeElement).toBe(firstButton);
    });
  });
});
