/**
 * RecentGains Component Tests
 *
 * Comprehensive tests for the Recent Gains component including:
 * - Display of recent XP gains (last 7-30 days)
 * - Grouping by date
 * - Visual indicators (green for gains)
 * - Expandable detail view
 * - Sorting by date or amount
 * - Time range selector (7/30 days)
 *
 * Story 3-4: XP & Progression Display - Task 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import RecentGains from '../RecentGains';
import * as useHorseXPHistoryHook from '@/hooks/api/useHorseXP';
import type { HorseXPHistory } from '@/lib/api-client';

// Mock the hook
vi.mock('@/hooks/api/useHorseXP');

describe('RecentGains', () => {
  let queryClient: QueryClient;

  const mockHistoryData: HorseXPHistory = {
    events: [
      {
        id: 1,
        amount: 50,
        reason: 'Training: Sprint Practice',
        timestamp: '2025-12-09T10:00:00Z',
      },
      {
        id: 2,
        amount: 100,
        reason: 'Competition: 5km Race',
        timestamp: '2025-12-09T14:00:00Z',
      },
      {
        id: 3,
        amount: 25,
        reason: 'Training: Obstacle Course',
        timestamp: '2025-12-08T10:00:00Z',
      },
      {
        id: 4,
        amount: 75,
        reason: 'Competition: Show Jumping',
        timestamp: '2025-12-07T15:00:00Z',
      },
      {
        id: 5,
        amount: 30,
        reason: 'Training: Dressage Practice',
        timestamp: '2025-12-05T09:00:00Z',
      },
    ],
    count: 5,
    pagination: {
      limit: 30,
      offset: 0,
      hasMore: false,
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Default mock: successful data fetch
    vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
      data: mockHistoryData,
      isLoading: false,
      error: null,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('Component Rendering (AC-1)', () => {
    it('should render component with title', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/recent gains/i)).toBeInTheDocument();
    });

    it('should display list of recent XP gains', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/sprint practice/i)).toBeInTheDocument();
      expect(screen.getByText(/5km race/i)).toBeInTheDocument();
      expect(screen.getByText(/obstacle course/i)).toBeInTheDocument();
    });

    it('should display XP amounts for each gain', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/\+50/)).toBeInTheDocument();
      expect(screen.getByText(/\+100/)).toBeInTheDocument();
      expect(screen.getByText(/\+25/)).toBeInTheDocument();
    });
  });

  describe('Date Grouping (AC-2)', () => {
    it('should group gains by date', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Check for date headers
      expect(screen.getByText(/dec 9/i)).toBeInTheDocument();
      expect(screen.getByText(/dec 8/i)).toBeInTheDocument();
      expect(screen.getByText(/dec 7/i)).toBeInTheDocument();
    });

    it('should show multiple gains under same date', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Dec 9 has 2 events (Sprint Practice and 5km Race)
      const dec9Section = screen.getByText(/dec 9/i).closest('div');
      expect(dec9Section).toBeTruthy();
    });

    it('should sort dates in descending order (most recent first)', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      const dates = screen.getAllByText(/dec \d+/i);
      expect(dates[0]).toHaveTextContent(/dec 9/i);
      expect(dates[dates.length - 1]).toHaveTextContent(/dec 5/i);
    });
  });

  describe('Visual Indicators (AC-3)', () => {
    it('should show green indicator for positive gains', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Check for green text class on gain amounts (not summary stats)
      const gainElements = screen.getAllByText(/\+\d+/).filter((el) => {
        const parent = el.closest('button');
        return parent !== null; // Only gain items, not summary
      });
      gainElements.forEach((element) => {
        expect(element).toHaveClass('text-emerald-600');
      });
    });

    it('should show up arrow icon for gains', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Check for ArrowUp icon (via testid or aria-label)
      const icons = screen.getAllByTestId('arrow-up-icon');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should use consistent styling for all gain indicators', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      const gainElements = screen.getAllByText(/\+\d+/).filter((el) => {
        const parent = el.closest('button');
        return parent !== null; // Only gain items
      });
      expect(gainElements.length).toBeGreaterThan(0);
      const firstClass = gainElements[0].className;
      gainElements.forEach((element) => {
        expect(element.className).toBe(firstClass);
      });
    });
  });

  describe('Time Range Selector (AC-4)', () => {
    it('should render time range buttons', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
    });

    it('should highlight selected time range (default: 30 days)', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      const button30Days = screen.getByRole('button', { name: /30 days/i });
      expect(button30Days).toHaveClass('bg-emerald-600');
    });

    it('should change time range when button clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const button7Days = screen.getByRole('button', { name: /7 days/i });
      await user.click(button7Days);

      await waitFor(() => {
        expect(button7Days).toHaveClass('bg-emerald-600');
      });
    });

    it('should fetch new data when time range changes', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: mockHistoryData,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);

      const button7Days = screen.getByRole('button', { name: /7 days/i });
      await user.click(button7Days);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });
  });

  describe('Sorting Options (AC-5)', () => {
    it('should render sort dropdown', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
    });

    it('should sort by date (default - newest first)', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Default sort is by date descending (newest first)
      // Dec 9 14:00 (id:2, +100) should be first
      const gainElements = screen.getAllByText(/\+\d+/).filter((el) => {
        const parent = el.closest('button');
        return parent !== null;
      });
      expect(gainElements[0]).toHaveTextContent('+100');
    });

    it('should sort by amount when selected', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'amount');

      await waitFor(() => {
        const gainElements = screen.getAllByText(/\+\d+/).filter((el) => {
          const parent = el.closest('button');
          return parent !== null;
        });
        expect(gainElements[0]).toHaveTextContent('+100');
      });
    });
  });

  describe('Expandable Detail View (AC-6)', () => {
    it('should show collapsed view by default', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Check that Time: label is not visible initially
      expect(screen.queryByText(/^Time:/)).not.toBeInTheDocument();
    });

    it('should expand gain details when clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const firstGain = screen.getByText(/sprint practice/i);
      await user.click(firstGain);

      await waitFor(() => {
        // Check for expanded details (Time: label and timestamp)
        expect(screen.getByText(/^Time:/)).toBeInTheDocument();
        // Check for timestamp (format depends on locale)
        expect(screen.getByText(/dec 9, 2025/i)).toBeInTheDocument();
      });
    });

    it('should collapse details when clicked again', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const firstGain = screen.getByText(/sprint practice/i);
      await user.click(firstGain); // Expand

      await waitFor(() => {
        expect(screen.getByText(/^Time:/)).toBeInTheDocument();
      });

      await user.click(firstGain); // Collapse

      await waitFor(() => {
        expect(screen.queryByText(/^Time:/)).not.toBeInTheDocument();
      });
    });

    it('should show full timestamp in expanded view', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const firstGain = screen.getByText(/sprint practice/i);
      await user.click(firstGain);

      await waitFor(() => {
        expect(screen.getByText(/Full Date:/)).toBeInTheDocument();
        expect(screen.getByText(/2025-12-09/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not show gains list when loading', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.queryByText(/sprint practice/i)).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch gains', statusCode: 500 } as any,
        isError: true,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/failed to fetch gains/i)).toBeInTheDocument();
    });

    it('should not show gains list when error', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error', statusCode: 500 } as any,
        isError: true,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.queryByText(/sprint practice/i)).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty gains list gracefully', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: { ...mockHistoryData, events: [] },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/no recent gains/i)).toBeInTheDocument();
    });

    it('should show helpful message in empty state', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: { ...mockHistoryData, events: [] },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/no xp gains/i)).toBeInTheDocument();
    });
  });

  describe('Summary Statistics (AC-7)', () => {
    it('should display total XP gained', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Total: 50 + 100 + 25 + 75 + 30 = 280
      expect(screen.getByText(/total xp/i)).toBeInTheDocument();
      expect(screen.getByText(/\+280/)).toBeInTheDocument();
    });

    it('should display number of gain events', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/5.*events/i)).toBeInTheDocument();
    });

    it('should display average gain per event', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Average: 280 / 5 = 56
      expect(screen.getByText(/avg.*56/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single gain event', () => {
      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: {
          ...mockHistoryData,
          events: [mockHistoryData.events[0]],
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/sprint practice/i)).toBeInTheDocument();
    });

    it('should handle large numbers of gains (50+)', () => {
      const largeEvents = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        amount: i * 10 + 10, // Start from 10 to avoid 0
        reason: `Training: Session ${i + 1}`,
        timestamp: new Date(2025, 11, 9 - Math.floor(i / 2)).toISOString(),
      }));

      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: {
          ...mockHistoryData,
          events: largeEvents,
          count: 60,
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      // Check that component renders with large dataset
      expect(screen.getByText(/recent gains/i)).toBeInTheDocument();
      expect(screen.getByText(/60.*events/i)).toBeInTheDocument();
    });

    it('should handle gains with same timestamp', () => {
      const sameTimeEvents = [
        {
          id: 1,
          amount: 50,
          reason: 'Training A',
          timestamp: '2025-12-09T10:00:00Z',
        },
        {
          id: 2,
          amount: 30,
          reason: 'Training B',
          timestamp: '2025-12-09T10:00:00Z',
        },
      ];

      vi.mocked(useHorseXPHistoryHook.useHorseXPHistory).mockReturnValue({
        data: {
          ...mockHistoryData,
          events: sameTimeEvents,
        },
        isLoading: false,
        error: null,
        isError: false,
      } as any);

      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByText(/training a/i)).toBeInTheDocument();
      expect(screen.getByText(/training b/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for buttons', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
    });

    it('should have keyboard accessible gain items', async () => {
      const user = userEvent.setup();
      renderWithProvider(<RecentGains horseId={1} />);

      const firstGain = screen.getByText(/sprint practice/i);
      const button = firstGain.closest('button')!;
      button.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/^Time:/)).toBeInTheDocument();
      });
    });

    it('should have proper ARIA roles for list', () => {
      renderWithProvider(<RecentGains horseId={1} />);
      // Component has nested lists - check outer list exists
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(0);
    });
  });
});
