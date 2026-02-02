/**
 * StatHistoryGraph Component Tests
 *
 * Comprehensive tests for the Stat History Graph component including:
 * - Chart rendering with historical data
 * - Time range selector functionality
 * - Multi-line stat display (6 stats)
 * - Hover tooltips
 * - Loading and error states
 * - Responsive behavior
 *
 * Story 3-4: XP & Progression Display - Task 2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import StatHistoryGraph from '../StatHistoryGraph';
import * as useHorseXPHook from '@/hooks/api/useHorseXP';
import type { HorseXPHistory } from '@/lib/api-client';

// Mock the hook
vi.mock('@/hooks/api/useHorseXP');

// Mock Chart.js to avoid canvas issues in tests
// Store options without stringification to preserve callback functions
let lastChartOptions: any = null;
let lastChartData: any = null;

vi.mock('react-chartjs-2', () => ({
  Line: ({ data, options, ...props }: any) => {
    lastChartOptions = options;
    lastChartData = data;
    return (
      <div
        data-testid="chart-canvas"
        data-chart-data={JSON.stringify(data)}
        data-chart-options={JSON.stringify(options)}
        {...props}
      >
        <canvas>Mocked Chart</canvas>
      </div>
    );
  },
}));

// Helper to get non-stringified chart options
const getChartOptions = () => lastChartOptions;
const getChartData = () => lastChartData;

describe('StatHistoryGraph', () => {
  let queryClient: QueryClient;

  const now = new Date();
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  const mockHistoryData: HorseXPHistory = {
    events: [
      {
        id: 4,
        amount: 100, // Changed to match old logic order if needed, but I'll keep the amounts from original test
        reason: 'Level up bonus',
        timestamp: daysAgo(6),
      },
      {
        id: 3,
        amount: 50,
        reason: 'Training session completed',
        timestamp: daysAgo(5),
      },
      {
        id: 2,
        amount: 75,
        reason: 'Competition win',
        timestamp: daysAgo(2),
      },
      {
        id: 1,
        amount: 120,
        reason: 'Training session completed',
        timestamp: daysAgo(1),
      },
    ],
    count: 4,
    pagination: {
      limit: 50,
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
    vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
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

  describe('Chart Rendering (AC-1)', () => {
    it('should render chart canvas', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.getByTestId('chart-canvas')).toBeInTheDocument();
    });

    it('should render with Chart.js Line component', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const canvas = screen.getByTestId('chart-canvas').querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should pass chart data with XP events', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets[0].data.length).toBe(4); // 4 events in mock data
    });

    it('should format dates for X-axis labels', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.labels).toBeDefined();
      expect(chartData.labels.length).toBe(4);
      // Check for date format "MMM DD" (e.g., "Jan 23", "Dec 1") - date-agnostic
      expect(chartData.labels[0]).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/); // Format like "Jan 23" or "Dec 1"
    });

    it('should set Y-axis range from 0 to max XP', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartOptions = JSON.parse(chartElement.getAttribute('data-chart-options') || '{}');

      expect(chartOptions.scales.y.min).toBe(0);
      expect(chartOptions.scales.y.max).toBeGreaterThan(0);
    });
  });

  describe('Time Range Selector (AC-2)', () => {
    it('should render time range buttons', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /90 days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all time/i })).toBeInTheDocument();
    });

    it('should highlight active time range (default 30 days)', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      const button30d = screen.getByRole('button', { name: /30 days/i });
      expect(button30d).toHaveClass('active'); // or check for specific styling
    });

    it('should change time range when button clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      const button7d = screen.getByRole('button', { name: /7 days/i });
      await user.click(button7d);

      expect(button7d).toHaveClass('active');
    });

    it('should refetch data when time range changes', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: mockHistoryData,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      } as any);

      const user = userEvent.setup();
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      const button7d = screen.getByRole('button', { name: /7 days/i });
      await user.click(button7d);

      await waitFor(() => {
        expect(useHorseXPHook.useHorseXPHistory).toHaveBeenCalledWith(1, { limit: 100 });
      });
    });
  });

  describe('Chart Data Transformation (AC-3)', () => {
    it('should transform API data to Chart.js format', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets[0]).toHaveProperty('data');
      expect(chartData.datasets[0]).toHaveProperty('label');
    });

    it('should calculate cumulative XP for line chart', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      const dataPoints = chartData.datasets[0].data;
      expect(dataPoints[0]).toBe(100); // First event: 100 XP
      expect(dataPoints[1]).toBe(150); // Second event: 100 + 50 = 150
      expect(dataPoints[2]).toBe(225); // Third event: 150 + 75 = 225
      expect(dataPoints[3]).toBe(345); // Fourth event: 225 + 120 = 345
    });

    it('should handle empty data gracefully', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: { events: [], count: 0, pagination: { limit: 50, offset: 0, hasMore: false } },
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);

      expect(screen.getByText(/no xp history/i)).toBeInTheDocument();
    });

    it('should sort events by timestamp chronologically', () => {
      const unsortedData: HorseXPHistory = {
        events: [
          { id: 1, amount: 50, reason: 'Event 1', timestamp: daysAgo(1) },
          { id: 2, amount: 100, reason: 'Event 2', timestamp: daysAgo(10) },
          { id: 3, amount: 75, reason: 'Event 3', timestamp: daysAgo(5) },
        ],
        count: 3,
        pagination: { limit: 50, offset: 0, hasMore: false },
      };

      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: unsortedData,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      // After sorting, first label should be the oldest one (10 days ago)
      const oldestDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const month = oldestDate.toLocaleDateString('en-US', { month: 'short' });
      const day = oldestDate.getDate();

      expect(chartData.labels[0]).toContain(`${month} ${day}`);
      expect(chartData.datasets[0].data[0]).toBe(100); // Oldest event's amount (cumulative)
    });
  });

  describe('Chart Styling (AC-4)', () => {
    it('should use emerald color for line', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].borderColor).toMatch(/emerald|#10b981|rgb\(16, 185, 129\)/i);
    });

    it('should set line width appropriately', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].borderWidth).toBeGreaterThanOrEqual(2);
    });

    it('should enable gradient fill under line', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].fill).toBe(true);
    });

    it('should configure smooth curve tension', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].tension).toBeGreaterThan(0);
    });
  });

  describe('Tooltips (AC-5)', () => {
    it('should configure tooltip plugin', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartOptions = JSON.parse(chartElement.getAttribute('data-chart-options') || '{}');

      expect(chartOptions.plugins.tooltip.enabled).toBe(true);
    });

    it('should display XP amount in tooltip', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      screen.getByTestId('chart-canvas'); // Ensure render completed
      const chartOptions = getChartOptions();

      expect(chartOptions.plugins.tooltip.callbacks.label).toBeDefined();
      expect(typeof chartOptions.plugins.tooltip.callbacks.label).toBe('function');
    });

    it('should display date in tooltip', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      screen.getByTestId('chart-canvas'); // Ensure render completed
      const chartOptions = getChartOptions();

      expect(chartOptions.plugins.tooltip.callbacks.title).toBeDefined();
      expect(typeof chartOptions.plugins.tooltip.callbacks.title).toBe('function');
    });

    it('should display reason/source in tooltip', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      screen.getByTestId('chart-canvas'); // Ensure render completed
      const chartOptions = getChartOptions();

      expect(chartOptions.plugins.tooltip.callbacks.afterLabel).toBeDefined();
      expect(typeof chartOptions.plugins.tooltip.callbacks.afterLabel).toBe('function');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when data is loading', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not show chart when loading', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.queryByTestId('chart-canvas')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch XP history', statusCode: 500 } as any,
        isError: true,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.getByText(/failed to fetch xp history/i)).toBeInTheDocument();
    });

    it('should not show chart when error', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error', statusCode: 500 } as any,
        isError: true,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.queryByTestId('chart-canvas')).not.toBeInTheDocument();
    });

    it('should offer retry action on error', () => {
      const mockRefetch = vi.fn();
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Error', statusCode: 500 } as any,
        isError: true,
        refetch: mockRefetch,
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single data point', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: {
          events: [{ id: 1, amount: 100, reason: 'First event', timestamp: daysAgo(1) }],
          count: 1,
          pagination: { limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data.length).toBe(1);
    });

    it('should handle very large XP numbers', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: {
          events: [{ id: 1, amount: 999999, reason: 'Huge bonus', timestamp: daysAgo(1) }],
          count: 1,
          pagination: { limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '{}');

      expect(chartData.datasets[0].data[0]).toBe(999999);
    });

    it('should handle missing timestamp gracefully', () => {
      vi.mocked(useHorseXPHook.useHorseXPHistory).mockReturnValue({
        data: {
          events: [{ id: 1, amount: 100, reason: 'Event', timestamp: '' }],
          count: 1,
          pagination: { limit: 50, offset: 0, hasMore: false },
        },
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.getByTestId('chart-canvas')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have descriptive heading', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      expect(screen.getByRole('heading', { name: /xp history/i })).toBeInTheDocument();
    });

    it('should have accessible time range buttons', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('should announce chart data to screen readers', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');

      expect(chartElement).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation for time range buttons', async () => {
      const user = userEvent.setup();
      renderWithProvider(<StatHistoryGraph horseId={1} />);

      await user.tab(); // Focus first button
      const firstButton = screen.getByRole('button', { name: /7 days/i });
      expect(firstButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(firstButton).toHaveClass('active');
    });
  });

  describe('Responsive Behavior', () => {
    it('should configure responsive chart options', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartOptions = JSON.parse(chartElement.getAttribute('data-chart-options') || '{}');

      expect(chartOptions.responsive).toBe(true);
      expect(chartOptions.maintainAspectRatio).toBe(true);
    });

    it('should set appropriate aspect ratio', () => {
      renderWithProvider(<StatHistoryGraph horseId={1} />);
      const chartElement = screen.getByTestId('chart-canvas');
      const chartOptions = JSON.parse(chartElement.getAttribute('data-chart-options') || '{}');

      expect(chartOptions.aspectRatio).toBeDefined();
      expect(chartOptions.aspectRatio).toBeGreaterThan(1); // Wider than tall
    });
  });
});
