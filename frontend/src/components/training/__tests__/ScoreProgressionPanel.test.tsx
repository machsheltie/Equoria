/**
 * ScoreProgressionPanel Component Tests (Equoria-fefh2.12 — MSW boundary)
 *
 * Boundary-level tests: the component renders against the REAL
 * `useHorseTrainingHistory` hook (real React Query + real api-client) with the
 * network boundary stubbed by MSW (`server.use(http.get(...))`) — NOT a
 * `vi.mock('../../../hooks/api/useHorses')`. This exercises the real query-key
 * construction, the `enabled` gating, the `{ success, message, data }` envelope
 * unwrap, and the `select: (data) => data.trainingHistory` transform end-to-end.
 *
 * The two CHILD components (ScoreRadarChart, TrainingHistoryTable) remain
 * stubbed so the data the panel passes down can be inspected via data-* attrs —
 * child stubs are an allowed isolation boundary (they are not the system under
 * test; the panel's data fetch + transform IS).
 *
 * Real wire shape (verified against
 * backend/modules/horses/routes/horseHistoryRoutes.mjs GET /:id/training-history):
 *   { success: true, message: '...', data: {
 *       trainingHistory: HorseTrainingHistoryEntry[],
 *       disciplineBalance: {}, trainingFrequency: {} } }
 * The hook's `select` extracts `data.trainingHistory` (the api-client first
 * unwraps the outer `data` envelope key).
 *
 * Story 4-2: Training History Display - Task 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ScoreProgressionPanel from '../ScoreProgressionPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const trainingHistoryPath = (horseId: number | string) =>
  `${base}/api/v1/horses/${horseId}/training-history`;

// Define prop interfaces for the child-component stubs
interface MockRadarChartProps {
  disciplineScores: Record<string, number>;
  className?: string;
}

interface MockHistoryTableProps {
  history: Array<Record<string, unknown>>;
  loading?: boolean;
  className?: string;
}

// Stub child components to isolate the panel's data fetch + transform. These
// are NOT the system under test (the panel's hook + transform is); they expose
// the data the panel hands down through data-* attributes for inspection.
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

// Test data — the REAL HorseTrainingHistoryEntry wire shape (id, discipline,
// score, trainedAt, notes), as returned inside `data.trainingHistory`.
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

/**
 * Stub the GET /training-history boundary with a given trainingHistory array,
 * mirroring the real `{ success, message, data: { trainingHistory, ... } }`
 * envelope the backend returns. `:id` matches any horse id.
 */
function stubTrainingHistory(trainingHistory: Array<Record<string, unknown>>) {
  server.use(
    http.get(trainingHistoryPath(':id'), () =>
      HttpResponse.json({
        success: true,
        message: 'Training history retrieved successfully',
        data: { trainingHistory, disciplineBalance: {}, trainingFrequency: {} },
      })
    )
  );
}

// Helper to create a QueryClient wrapper (retry off so error-state assertions
// resolve fast and deterministically).
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ScoreProgressionPanel', () => {
  beforeEach(() => {
    // Default: the boundary returns the three-entry history.
    stubTrainingHistory(mockTrainingHistory);
  });

  // ==================== RENDERING TESTS (5) ====================
  describe('Rendering', () => {
    it('renders without crashing', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByTestId('score-radar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('score-progression-panel')).toBeInTheDocument();
    });

    it('renders ScoreRadarChart component', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByTestId('score-radar-chart')).toBeInTheDocument();
    });

    it('renders TrainingHistoryTable component', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByTestId('training-history-table')).toBeInTheDocument();
    });

    it('renders score caps info section', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByTestId('score-caps-section')).toBeInTheDocument();
    });

    it('renders all section headings', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByText('Discipline Distribution')).toBeInTheDocument();
      expect(screen.getByText('Training History')).toBeInTheDocument();
      expect(screen.getByText(/Score Caps & Bonuses/)).toBeInTheDocument();
    });
  });

  // ==================== DATA FETCHING TESTS (4) ====================
  describe('Data Fetching', () => {
    it('fetches training history for the correct horseId from the boundary', async () => {
      // Assert the real query hits the real per-horse endpoint: stub ONLY id 42
      // and confirm the panel renders its data (proves the query key + URL are
      // built from the horseId prop).
      server.use(
        http.get(trainingHistoryPath('42'), () =>
          HttpResponse.json({
            success: true,
            message: 'ok',
            data: {
              trainingHistory: [
                { id: 9, discipline: 'dressage', score: 70, trainedAt: '2026-02-01T00:00:00Z' },
              ],
              disciplineBalance: {},
              trainingFrequency: {},
            },
          })
        )
      );

      render(<ScoreProgressionPanel horseId={42} />, { wrapper: createWrapper() });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        const parsed = JSON.parse(table.getAttribute('data-history') || '[]');
        expect(parsed.length).toBe(1);
      });
    });

    it('passes history data to TrainingHistoryTable', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        const historyAttr = table.getAttribute('data-history');
        expect(historyAttr).toBeTruthy();
        expect(JSON.parse(historyAttr || '[]').length).toBeGreaterThan(0);
      });
    });

    it('passes disciplineScores to ScoreRadarChart', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const chart = await screen.findByTestId('score-radar-chart');
      const scoresAttr = chart.getAttribute('data-discipline-scores');
      expect(scoresAttr).toBeTruthy();
      const parsedScores = JSON.parse(scoresAttr || '{}');
      expect(typeof parsedScores).toBe('object');
      // The real buildDisciplineScores reduces the fetched history into a
      // discipline→max-score map: dressage=45 from the fetched entry.
      await waitFor(() => {
        const scores = JSON.parse(chart.getAttribute('data-discipline-scores') || '{}');
        expect(scores.dressage).toBe(45);
      });
    });

    it('refetches the new horse when horseId changes', async () => {
      server.use(
        http.get(trainingHistoryPath('2'), () =>
          HttpResponse.json({
            success: true,
            message: 'ok',
            data: {
              trainingHistory: [
                { id: 99, discipline: 'racing', score: 88, trainedAt: '2026-03-01T00:00:00Z' },
              ],
              disciplineBalance: {},
              trainingFrequency: {},
            },
          })
        )
      );

      const { rerender } = render(<ScoreProgressionPanel horseId={1} />, {
        wrapper: createWrapper(),
      });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(3);
      });

      rerender(<ScoreProgressionPanel horseId={2} />);

      // Horse 2's boundary returns a single racing entry — the panel re-queries
      // under the new query key and re-renders with it.
      await waitFor(() => {
        const parsed = JSON.parse(
          screen.getByTestId('training-history-table').getAttribute('data-history') || '[]'
        );
        expect(parsed.length).toBe(1);
        expect(parsed[0].discipline).toBe('racing');
      });
    });
  });

  // ==================== LOADING STATE TESTS (3) ====================
  describe('Loading State', () => {
    beforeEach(() => {
      // Delay the boundary response so the loading state is observable.
      server.use(
        http.get(trainingHistoryPath(':id'), async () => {
          await delay('infinite');
          return HttpResponse.json({
            success: true,
            message: 'ok',
            data: { trainingHistory: [], disciplineBalance: {}, trainingFrequency: {} },
          });
        })
      );
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
    beforeEach(() => {
      // The boundary returns a 500 — the real api-client surfaces it as an
      // ApiError with a message the component renders.
      server.use(
        http.get(trainingHistoryPath(':id'), () =>
          HttpResponse.json(
            { success: false, message: 'Failed to retrieve training history' },
            { status: 500 }
          )
        )
      );
    });

    it('shows error message on fetch failure', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByText(/Failed to retrieve training history/)).toBeInTheDocument();
    });

    it('shows Try Again button on error', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('clicking Try Again refetches data', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const retryButton = await screen.findByRole('button', { name: /try again/i });

      // After retry, the boundary recovers and serves real data — the panel
      // transitions out of the error state into the rendered chart/table.
      stubTrainingHistory(mockTrainingHistory);
      fireEvent.click(retryButton);

      expect(await screen.findByTestId('training-history-table')).toBeInTheDocument();
    });

    it('error message has appropriate styling', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const errorContainer = await screen.findByTestId('error-container');
      expect(errorContainer).toHaveClass('border-[var(--role-danger-border)]');
    });
  });

  // ==================== RESPONSIVE LAYOUT TESTS (3) ====================
  describe('Responsive Layout', () => {
    it('uses grid layout for desktop (md:grid-cols-2)', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByTestId('score-radar-chart');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
    });

    it('uses single column for mobile (grid-cols-1)', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByTestId('score-radar-chart');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('grid-cols-1');
    });

    it('has proper spacing between sections', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByTestId('score-radar-chart');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('gap-6');
    });
  });

  // ==================== INFO SECTION TESTS (3) ====================
  describe('Info Section', () => {
    it('displays score caps heading', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      expect(await screen.findByText(/Score Caps & Bonuses/)).toBeInTheDocument();
    });

    it('lists all 3 bonus types', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByText(/Score Caps & Bonuses/);
      expect(screen.getByText(/Base score cap: 100 per discipline/)).toBeInTheDocument();
      expect(screen.getByText(/Trait bonuses can add \+10-20/)).toBeInTheDocument();
      expect(screen.getByText(/Groom bonuses can add \+5-15/)).toBeInTheDocument();
    });

    it('has proper icon', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const heading = await screen.findByText(/Score Caps & Bonuses/);
      expect(heading.textContent).toContain('📊'); // chart emoji
    });
  });

  // ==================== INTEGRATION TESTS (3) ====================
  describe('Integration', () => {
    it('chart and table receive correct data', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(3);
      });

      const chart = screen.getByTestId('score-radar-chart');
      const scoresData = JSON.parse(chart.getAttribute('data-discipline-scores') || '{}');
      expect(Object.keys(scoresData).length).toBeGreaterThan(0);
    });

    it('renders chart and table once data resolves', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      expect(await screen.findByTestId('score-radar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('training-history-table')).toBeInTheDocument();
    });

    it('handles empty training history', async () => {
      stubTrainingHistory([]);

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(0);
      });
    });
  });

  // ==================== PROPS TESTS (2) ====================
  describe('Props', () => {
    it('accepts className prop', async () => {
      render(<ScoreProgressionPanel horseId={1} className="custom-class" />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('score-radar-chart');
      const panel = screen.getByTestId('score-progression-panel');
      expect(panel).toHaveClass('custom-class');
    });

    it('renders for the provided horseId', async () => {
      render(<ScoreProgressionPanel horseId={123} />, { wrapper: createWrapper() });
      expect(await screen.findByTestId('score-progression-panel')).toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY TESTS (3) ====================
  describe('Accessibility', () => {
    it('has proper heading hierarchy', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByTestId('score-radar-chart');
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThanOrEqual(3);
    });

    it('loading state has aria-label', async () => {
      // Hold the boundary open so the loading container stays mounted.
      server.use(
        http.get(trainingHistoryPath(':id'), async () => {
          await delay('infinite');
          return HttpResponse.json({
            success: true,
            message: 'ok',
            data: { trainingHistory: [], disciplineBalance: {}, trainingFrequency: {} },
          });
        })
      );

      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      const loadingContainer = screen.getByTestId('loading-container');
      expect(loadingContainer).toHaveAttribute('aria-label', 'Loading training data');
    });

    it('uses semantic HTML structure', async () => {
      render(<ScoreProgressionPanel horseId={1} />, { wrapper: createWrapper() });
      await screen.findByTestId('score-radar-chart');
      expect(screen.getByTestId('score-progression-panel').tagName.toLowerCase()).toBe('div');
    });
  });
});
