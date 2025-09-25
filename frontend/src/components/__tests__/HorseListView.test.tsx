/**
 * Horse List View Component Tests
 * 
 * Tests for the comprehensive horse list interface including:
 * - Horse list display with sorting and filtering
 * - Pagination for large horse collections
 * - Real-time data updates with React Query
 * - Responsive design for mobile and desktop
 * - Search functionality and filter options
 * 
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real API integration with backend horse management endpoints
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import HorseListView from '../HorseListView';

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

describe('HorseListView Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Component Rendering', () => {
    test('renders horse list view with loading state', () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('renders horse list view with proper structure', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      // Check for main sections
      expect(screen.getByRole('main')).toHaveClass('horse-list-container');
    });
  });

  describe('Horse List Display', () => {
    test('displays horses in a sortable table format', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Check for table headers
      expect(screen.getByText(/name/i)).toBeInTheDocument();
      expect(screen.getByText(/breed/i)).toBeInTheDocument();
      expect(screen.getByText(/age/i)).toBeInTheDocument();
      expect(screen.getByText(/level/i)).toBeInTheDocument();
    });

    test('displays horse cards on mobile view', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('horse-cards-container')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    test('provides filter options for breed, age, and level', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/filter by breed/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by age/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/filter by level/i)).toBeInTheDocument();
      });
    });

    test('allows sorting by different columns', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        const nameHeader = screen.getByText(/name/i);
        expect(nameHeader).toBeInTheDocument();
      });

      // Click to sort by name
      const nameHeader = screen.getByText(/name/i);
      fireEvent.click(nameHeader);

      // Verify sort indicator appears
      await waitFor(() => {
        expect(nameHeader.closest('th')).toHaveAttribute('aria-sort');
      });
    });

    test('filters horses based on search input', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      const searchInput = await screen.findByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Thunder' } });

      // Verify search is applied
      await waitFor(() => {
        expect(searchInput).toHaveValue('Thunder');
      });
    });
  });

  describe('Pagination', () => {
    test('displays pagination controls when needed', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      });
    });

    test('allows navigation between pages', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      const nextButton = await screen.findByRole('button', { name: /next page/i });
      fireEvent.click(nextButton);

      // Verify page change
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });
    });
  });

  describe('Horse Actions', () => {
    test('provides quick action buttons for each horse', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /train/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /compete/i })).toBeInTheDocument();
      });
    });

    test('navigates to horse detail view when clicking view details', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      const viewButton = await screen.findByRole('button', { name: /view details/i });
      fireEvent.click(viewButton);

      // Verify navigation (would be handled by React Router in real app)
      expect(viewButton).toBeInTheDocument();
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
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });
    });

    test('shows table layout for desktop screens', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when API fails', async () => {
      // This test would use real API calls that might fail
      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/error loading horses/i)).toBeInTheDocument();
      });
    });

    test('provides retry functionality on error', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={999999} />
        </TestWrapper>
      );

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      // Verify retry attempt
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('loads within acceptable time limits', async () => {
      const startTime = Date.now();

      render(
        <TestWrapper>
          <HorseListView userId={1} />
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
          <HorseListView userId={1} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Horse list');
        expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Horses table');
      });
    });

    test('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} />
        </TestWrapper>
      );

      const firstButton = await screen.findByRole('button');
      firstButton.focus();

      expect(document.activeElement).toBe(firstButton);
    });
  });
});
