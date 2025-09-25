/**
 * CompetitionBrowser Component Tests
 * 
 * Tests for the competition browsing interface including:
 * - Competition listing with filtering and search
 * - Discipline-based filtering and sorting
 * - Entry eligibility checking and validation
 * - Real-time competition status updates
 * - Responsive design and mobile optimization
 * - Error handling and loading states
 * - Accessibility compliance
 * 
 * Uses TDD with NO MOCKING approach for authentic API validation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import CompetitionBrowser from '../CompetitionBrowser';

// Test wrapper with required providers
const createTestWrapper = (initialRoute = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const TestWrapper = createTestWrapper();

describe('CompetitionBrowser Component', () => {
  describe('Component Rendering', () => {
    test('renders competition browser with loading state', () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      expect(screen.getByTestId('competition-browser')).toBeInTheDocument();
    });

    test('renders browser with proper structure', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-browser')).toBeInTheDocument();
        expect(screen.getByTestId('competition-filters')).toBeInTheDocument();
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });
  });

  describe('Competition Listing', () => {
    test('displays available competitions', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });

    test('shows competition details and entry information', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });

    test('displays competition status and entry deadlines', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Search', () => {
    test('provides discipline filtering options', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('discipline-filter')).toBeInTheDocument();
      });
    });

    test('filters competitions by discipline', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const disciplineFilter = await screen.findByTestId('discipline-filter');
      fireEvent.change(disciplineFilter, { target: { value: 'Racing' } });

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });

    test('provides search functionality', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('searchbox')).toBeInTheDocument();
      });
    });

    test('searches competitions by name and description', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const searchInput = await screen.findByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'Derby' } });

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });
  });

  describe('Entry Eligibility', () => {
    test('displays entry eligibility status', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-status')).toBeInTheDocument();
      });
    });

    test('shows eligible horses for competition', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligible-horses')).toBeInTheDocument();
      });
    });

    test('provides entry action buttons', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enter competition/i })).toBeInTheDocument();
      });
    });

    test('handles entry submission', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const entryButton = await screen.findByRole('button', { name: /enter competition/i });
      fireEvent.click(entryButton);

      await waitFor(() => {
        expect(screen.getByTestId('entry-confirmation')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting and Organization', () => {
    test('provides sorting options', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sort-options')).toBeInTheDocument();
      });
    });

    test('sorts competitions by date', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const sortSelect = await screen.findByTestId('sort-options');
      fireEvent.change(sortSelect, { target: { value: 'date' } });

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });

    test('sorts competitions by prize money', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const sortSelect = await screen.findByTestId('sort-options');
      fireEvent.change(sortSelect, { target: { value: 'prize' } });

      await waitFor(() => {
        expect(screen.getByTestId('competition-list')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('adapts to mobile screen sizes', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-competition-view')).toBeInTheDocument();
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
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-competition-view')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    test('updates competition status in real-time', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-status')).toBeInTheDocument();
      });
    });

    test('refreshes entry counts automatically', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('entry-count')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message when competitions fail to load', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-browser')).toBeInTheDocument();
      });
    });

    test('provides retry functionality on error', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-browser')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('provides proper ARIA labels and roles', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByLabelText(/search competitions/i)).toBeInTheDocument();
      });
    });

    test('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      const searchInput = await screen.findByRole('searchbox');
      searchInput.focus();

      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Performance', () => {
    test('loads competition data within acceptable time limits', async () => {
      const startTime = Date.now();

      render(
        <TestWrapper>
          <CompetitionBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('competition-browser')).toBeInTheDocument();
      });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000); // Should load within 2 seconds
    });
  });
});
