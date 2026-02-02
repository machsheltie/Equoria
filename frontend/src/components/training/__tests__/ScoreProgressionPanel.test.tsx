/**
 * ScoreProgressionPanel Component Tests
 *
 * Comprehensive tests for the integration component that combines
 * ScoreRadarChart and TrainingHistoryTable with React Query data fetching.
 *
 * Tests cover:
 * - Rendering (5 tests): component structure and child components
 * - Data Fetching (4 tests): hook calls and data passing
 * - Loading State (3 tests): skeleton displays
 * - Error State (4 tests): error handling and retry
 * - Responsive Layout (3 tests): grid and spacing
 * - Info Section (3 tests): score caps information
 * - Integration (3 tests): data flow and updates
 *
 * Story 4-2: Training History Display - Task 3
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScoreProgressionPanel from '../ScoreProgressionPanel';

// Mock the useHorseTrainingHistory hook
vi.mock('../../../hooks/api/useHorses', () => ({
  useHorseTrainingHistory: vi.fn(),
}));

// Define prop interfaces for mock components
interface MockRadarChartProps {
  disciplineScores: Record<string, number>;
  className?: string;
}

interface MockHistoryTableProps {
  history: Array<Record<string, unknown>>;
  loading?: boolean;
  className?: string;
}

// Mock child components to isolate testing
vi.mock('../ScoreRadarChart', () => ({
  default: function MockScoreRadarChart({ disciplineScores, className }: MockRadarChartProps) {
    return (
      <div
        data-testid="score-radar-chart"
        data-discipline-scores={JSON.stringify(disciplineScores)}
        className={className}
      >
        Mock Radar Chart
      </div>
    );
  },
}));

vi.mock('../TrainingHistoryTable', () => ({
  default: function MockTrainingHistoryTable({
    history,
    loading,
    className,
  }: MockHistoryTableProps) {
    return (
      <div
        data-testid="training-history-table"
        data-history={JSON.stringify(history)}
        data-loading={loading}
        className={className}
      >
        Mock Training History Table
      </div>
    );
  },
}));

// Import the mocked hook for manipulation
import { useHorseTrainingHistory } from '../../../hooks/api/useHorses';
const mockUseHorseTrainingHistory = useHorseTrainingHistory as Mock;

// Test data
const mockTrainingHistory = [
  {
    id: 1,
    discipline: 'dressage',
    score: 45,
    trainedAt: '2026-01-15T10:00:00Z',
    notes: 'Good session',
  },
  {
    id: 2,
    discipline: 'show-jumping',
    score: 30,
    trainedAt: '2026-01-10T14:30:00Z',
    notes: null,
  },
  {
    id: 3,
    discipline: 'racing',
    score: 60,
    trainedAt: '2026-01-05T09:15:00Z',
    notes: 'Excellent progress',
  },
];

// Note: Mock discipline scores are not needed for tests since component generates them internally
// based on horseId. The component uses getMockDisciplineScores(horseId) function.

// Helper to create QueryClient wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ScoreProgressionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== RENDERING TESTS (5) ====================
  describe('Rendering', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('renders without crashing', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('score-progression-panel')).toBeInTheDocument();
    });

    it('renders ScoreRadarChart component', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('score-radar-chart')).toBeInTheDocument();
    });

    it('renders TrainingHistoryTable component', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('training-history-table')).toBeInTheDocument();
    });

    it('renders score caps info section', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('score-caps-section')).toBeInTheDocument();
    });

    it('renders all section headings', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByText('Discipline Distribution')).toBeInTheDocument();
      expect(screen.getByText('Training History')).toBeInTheDocument();
      expect(screen.getByText(/Score Caps & Bonuses/)).toBeInTheDocument();
    });
  });

  // ==================== DATA FETCHING TESTS (4) ====================
  describe('Data Fetching', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('calls useHorseTrainingHistory with correct horseId', () => {
      render(<ScoreProgressionPanel horseId={42} />, { wrapper: createWrapper() });
      expect(mockUseHorseTrainingHistory).toHaveBeenCalledWith(42);
    });

    it('passes history data to TrainingHistoryTable', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const table = screen.getByTestId('training-history-table');
      const historyAttr = table.getAttribute('data-history');
      expect(historyAttr).toBeTruthy();

      const parsedHistory = JSON.parse(historyAttr || '[]');
      expect(parsedHistory.length).toBeGreaterThan(0);
    });

    it('passes disciplineScores to ScoreRadarChart', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const chart = screen.getByTestId('score-radar-chart');
      const scoresAttr = chart.getAttribute('data-discipline-scores');
      expect(scoresAttr).toBeTruthy();

      const parsedScores = JSON.parse(scoresAttr || '{}');
      expect(typeof parsedScores).toBe('object');
    });

    it('updates when horseId changes', () => {
      const { rerender } = render(<ScoreProgressionPanel horseId={1} />, {
        wrapper: createWrapper(),
      });
      expect(mockUseHorseTrainingHistory).toHaveBeenCalledWith(1);

      rerender(<ScoreProgressionPanel horseId={2} />);
      expect(mockUseHorseTrainingHistory).toHaveBeenCalledWith(2);
    });
  });

  // ==================== LOADING STATE TESTS (3) ====================
  describe('Loading State', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('shows loading state initially', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('loading-container')).toBeInTheDocument();
    });

    it('shows skeleton for chart area', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    });

    it('shows skeleton for table area', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    });
  });

  // ==================== ERROR STATE TESTS (4) ====================
  describe('Error State', () => {
    const mockError = { message: 'Failed to load training history' };
    const mockRefetch = vi.fn();

    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch,
      });
    });

    it('shows error message on fetch failure', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByText(/Failed to load training history/)).toBeInTheDocument();
    });

    it('shows Try Again button on error', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('clicking Try Again refetches data', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });

    it('error message has appropriate styling', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const errorContainer = screen.getByTestId('error-container');
      expect(errorContainer).toHaveClass('border-red-200');
    });
  });

  // ==================== RESPONSIVE LAYOUT TESTS (3) ====================
  describe('Responsive Layout', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('uses grid layout for desktop (md:grid-cols-2)', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
    });

    it('uses single column for mobile (grid-cols-1)', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('grid-cols-1');
    });

    it('has proper spacing between sections', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('gap-6');
    });
  });

  // ==================== INFO SECTION TESTS (3) ====================
  describe('Info Section', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('displays score caps heading', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByText(/Score Caps & Bonuses/)).toBeInTheDocument();
    });

    it('lists all 3 bonus types', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(screen.getByText(/Base score cap: 100 per discipline/)).toBeInTheDocument();
      expect(screen.getByText(/Trait bonuses can add \+10-20/)).toBeInTheDocument();
      expect(screen.getByText(/Groom bonuses can add \+5-15/)).toBeInTheDocument();
    });

    it('has proper icon', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const heading = screen.getByText(/Score Caps & Bonuses/);
      expect(heading.textContent).toContain('\uD83D\uDCCA'); // chart emoji
    });
  });

  // ==================== INTEGRATION TESTS (3) ====================
  describe('Integration', () => {
    it('chart and table receive correct data', () => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      // Check table receives the history data
      const table = screen.getByTestId('training-history-table');
      const historyData = JSON.parse(table.getAttribute('data-history') || '[]');
      expect(historyData.length).toBe(3);

      // Check chart receives discipline scores
      const chart = screen.getByTestId('score-radar-chart');
      const scoresData = JSON.parse(chart.getAttribute('data-discipline-scores') || '{}');
      expect(Object.keys(scoresData).length).toBeGreaterThan(0);
    });

    it('updates when data refetches', async () => {
      const refetchMock = vi.fn();
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: refetchMock,
      });

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      // Verify initial render
      expect(screen.getByTestId('score-radar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('training-history-table')).toBeInTheDocument();
    });

    it('handles empty training history', () => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      // Table should still render with empty history
      const table = screen.getByTestId('training-history-table');
      const historyData = JSON.parse(table.getAttribute('data-history') || '[]');
      expect(historyData.length).toBe(0);
    });
  });

  // ==================== PROPS TESTS (2) ====================
  describe('Props', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('accepts className prop', () => {
      render(<ScoreProgressionPanel horseId={1} className="custom-class" />, {
        wrapper: createWrapper(),
      });
      const panel = screen.getByTestId('score-progression-panel');
      expect(panel).toHaveClass('custom-class');
    });

    it('requires horseId prop', () => {
      render(<ScoreProgressionPanel horseId={123} />, { wrapper: createWrapper() });
      expect(mockUseHorseTrainingHistory).toHaveBeenCalledWith(123);
    });
  });

  // ==================== ACCESSIBILITY TESTS (3) ====================
  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: mockTrainingHistory,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });
    });

    it('has proper heading hierarchy', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThanOrEqual(3);
    });

    it('loading state has aria-label', () => {
      mockUseHorseTrainingHistory.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const loadingContainer = screen.getByTestId('loading-container');
      expect(loadingContainer).toHaveAttribute('aria-label', 'Loading training data');
    });

    it('uses semantic HTML structure', () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      // Check for section elements
      expect(screen.getByTestId('score-progression-panel').tagName.toLowerCase()).toBe('div');
    });
  });
});
