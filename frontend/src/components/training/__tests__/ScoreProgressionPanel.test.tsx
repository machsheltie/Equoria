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
 * The two CHILD components (DisciplineScoreColumns, TrainingHistoryTable) remain
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
import { userMessageFor } from '@/lib/http/userMessage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const trainingHistoryPath = (horseId: number | string) =>
  `${base}/api/v1/horses/${horseId}/training-history`;

// Define prop interfaces for the child-component stubs
interface MockScoreColumnsProps {
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
vi.mock('../DisciplineScoreColumns', () => ({
  default: function MockDisciplineScoreColumns({
    disciplineScores,
    className,
  }: MockScoreColumnsProps) {
    return (
      <div
        data-testid="discipline-score-columns"
        data-discipline-scores={JSON.stringify(disciplineScores)}
        className={className}
      >
        Mock Score Columns
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

// Test data — the REAL TrainingLog wire shape returned inside
// `data.trainingHistory` (id, discipline, trainedAt, horseId, scoreBefore,
// scoreAfter). Old contract: the fixtures carried a `score` field the backend
// never sent. Equoria-ky2ob (owner ruling 2026-10-22): TrainingLog records the
// discipline score before and after each session; rows logged before that
// carry null for both.
const mockTrainingHistory = [
  {
    id: 1,
    discipline: 'Dressage',
    trainedAt: '2026-01-15T10:00:00Z',
    horseId: 1,
    scoreBefore: 40,
    scoreAfter: 45,
  },
  {
    id: 2,
    discipline: 'Show Jumping',
    trainedAt: '2026-01-10T14:30:00Z',
    horseId: 1,
    scoreBefore: 20,
    scoreAfter: 30,
  },
  {
    id: 3,
    discipline: 'Racing',
    trainedAt: '2026-01-05T09:15:00Z',
    horseId: 1,
    scoreBefore: null,
    scoreAfter: null,
  },
];

// The horse's real Horse.disciplineScores, keyed by discipline name as the
// backend stores them.
const horseDisciplineScores = { Dressage: 45, 'Show Jumping': 30, Racing: 12 };

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
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByTestId('discipline-score-columns')).toBeInTheDocument();
      expect(screen.getByTestId('score-progression-panel')).toBeInTheDocument();
    });

    it('renders DisciplineScoreColumns component', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByTestId('discipline-score-columns')).toBeInTheDocument();
    });

    it('renders TrainingHistoryTable component', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByTestId('training-history-table')).toBeInTheDocument();
    });

    // Old contract: a 'Score Caps & Bonuses' box claimed a 100 score cap and
    // trait/groom score bonuses. Owner ruling 2026-10-22 (Equoria-ky2ob): no
    // stat caps and traits carry no stats, so the box is gone.
    it('does not render a score caps box', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      expect(screen.queryByTestId('score-caps-section')).not.toBeInTheDocument();
      expect(screen.queryByText(/Score Caps/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cap: 100/i)).not.toBeInTheDocument();
    });

    it('renders both section headings', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByText('Discipline Scores')).toBeInTheDocument();
      expect(screen.getByText('Training History')).toBeInTheDocument();
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
                {
                  id: 9,
                  discipline: 'Dressage',
                  trainedAt: '2026-02-01T00:00:00Z',
                  scoreBefore: 65,
                  scoreAfter: 70,
                },
              ],
              disciplineBalance: {},
              trainingFrequency: {},
            },
          })
        )
      );

      render(<ScoreProgressionPanel horseId={42} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        const parsed = JSON.parse(table.getAttribute('data-history') || '[]');
        expect(parsed.length).toBe(1);
      });
    });

    it('passes history data to TrainingHistoryTable', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        const historyAttr = table.getAttribute('data-history');
        expect(historyAttr).toBeTruthy();
        expect(JSON.parse(historyAttr || '[]').length).toBeGreaterThan(0);
      });
    });

    it('passes disciplineScores to DisciplineScoreColumns', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const chart = await screen.findByTestId('discipline-score-columns');
      const scoresAttr = chart.getAttribute('data-discipline-scores');
      expect(scoresAttr).toBeTruthy();
      const parsedScores = JSON.parse(scoresAttr || '{}');
      expect(typeof parsedScores).toBe('object');
      // Old contract: the radar was rebuilt from a `score` field on history
      // rows that the backend never sent, so it was always all zeros. Owner
      // ruling 2026-10-22 (Equoria-ky2ob): the radar reads the horse's real
      // Horse.disciplineScores, mapped onto the chart's discipline ids.
      await waitFor(() => {
        const scores = JSON.parse(chart.getAttribute('data-discipline-scores') || '{}');
        expect(scores).toEqual({ dressage: 45, 'show-jumping': 30, racing: 12 });
      });
    });

    it('the score columns shows the horse scores even before any training is logged', async () => {
      stubTrainingHistory([]);
      render(<ScoreProgressionPanel horseId={1} disciplineScores={{ Dressage: 70 }} />, {
        wrapper: createWrapper(),
      });
      const chart = await screen.findByTestId('discipline-score-columns');
      expect(JSON.parse(chart.getAttribute('data-discipline-scores') || '{}')).toEqual({
        dressage: 70,
      });
    });

    it('passes each session real before, after and gain to the table', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]')).toHaveLength(3);
      });
      const rows = JSON.parse(table.getAttribute('data-history') || '[]');
      expect(rows[0]).toMatchObject({
        id: 1,
        date: '2026-01-15T10:00:00Z',
        discipline: 'Dressage',
        previousScore: 40,
        newScore: 45,
        scoreGain: 5,
      });
      expect(rows[1]).toMatchObject({
        id: 2,
        discipline: 'Show Jumping',
        previousScore: 20,
        newScore: 30,
        scoreGain: 10,
      });
    });

    it('a session logged before scores were recorded shows no numbers', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]')).toHaveLength(3);
      });
      const legacy = JSON.parse(table.getAttribute('data-history') || '[]')[2];
      expect(legacy).toMatchObject({
        id: 3,
        date: '2026-01-05T09:15:00Z',
        discipline: 'Racing',
        previousScore: null,
        newScore: null,
        scoreGain: null,
      });
    });

    it('a row without a trainedAt keeps no date, never "now"', async () => {
      stubTrainingHistory([
        { id: 5, discipline: 'Dressage', horseId: 1, scoreBefore: 10, scoreAfter: 15 },
      ]);
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]')).toHaveLength(1);
      });
      expect(JSON.parse(table.getAttribute('data-history') || '[]')[0].date).toBeNull();
    });

    it('refetches the new horse when horseId changes', async () => {
      server.use(
        http.get(trainingHistoryPath('2'), () =>
          HttpResponse.json({
            success: true,
            message: 'ok',
            data: {
              trainingHistory: [
                {
                  id: 99,
                  discipline: 'Racing',
                  trainedAt: '2026-03-01T00:00:00Z',
                  scoreBefore: 83,
                  scoreAfter: 88,
                },
              ],
              disciplineBalance: {},
              trainingFrequency: {},
            },
          })
        )
      );

      const { rerender } = render(
        <ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />,
        {
          wrapper: createWrapper(),
        }
      );

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(3);
      });

      rerender(<ScoreProgressionPanel horseId={2} disciplineScores={horseDisciplineScores} />);

      // Horse 2's boundary returns a single racing entry — the panel re-queries
      // under the new query key and re-renders with it.
      await waitFor(() => {
        const parsed = JSON.parse(
          screen.getByTestId('training-history-table').getAttribute('data-history') || '[]'
        );
        expect(parsed.length).toBe(1);
        expect(parsed[0].discipline).toBe('Racing');
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
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByTestId('loading-container')).toBeInTheDocument();
    });

    it('shows skeleton for chart area', () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
    });

    it('shows skeleton for table area', () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
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

    // Equoria-0vm61 (owner doctrine FRONTEND_ASYNC_STATE_DOCTRINE §4): this case used
    // to pin the server body's message rendered verbatim. A 5xx body can carry
    // internals, so the panel shows the shared mapper's copy instead and never the
    // server text.
    it('shows the mapped server-fault message, not the server text, on fetch failure', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(
        await screen.findByText(userMessageFor({ statusCode: 500 }).message)
      ).toBeInTheDocument();
      expect(screen.queryByText(/Failed to retrieve training history/)).not.toBeInTheDocument();
    });

    it('shows Try Again button on error', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('clicking Try Again refetches data', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const retryButton = await screen.findByRole('button', { name: /try again/i });

      // After retry, the boundary recovers and serves real data — the panel
      // transitions out of the error state into the rendered chart/table.
      stubTrainingHistory(mockTrainingHistory);
      fireEvent.click(retryButton);

      expect(await screen.findByTestId('training-history-table')).toBeInTheDocument();
    });

    it('error message has appropriate styling', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const errorContainer = await screen.findByTestId('error-container');
      expect(errorContainer).toHaveClass('border-[var(--role-danger-border)]');
    });
  });

  // ==================== RESPONSIVE LAYOUT TESTS (3) ====================
  describe('Responsive Layout', () => {
    it('uses grid layout for desktop (md:grid-cols-2)', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
    });

    it('uses single column for mobile (grid-cols-1)', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('grid-cols-1');
    });

    it('has proper spacing between sections', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      const gridContainer = screen.getByTestId('content-grid');
      expect(gridContainer).toHaveClass('gap-6');
    });
  });

  // ==================== INTEGRATION TESTS (3) ====================
  describe('Integration', () => {
    it('chart and table receive correct data', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(3);
      });

      const chart = screen.getByTestId('discipline-score-columns');
      const scoresData = JSON.parse(chart.getAttribute('data-discipline-scores') || '{}');
      expect(Object.keys(scoresData).length).toBeGreaterThan(0);
    });

    it('renders chart and table once data resolves', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });

      expect(await screen.findByTestId('discipline-score-columns')).toBeInTheDocument();
      expect(screen.getByTestId('training-history-table')).toBeInTheDocument();
    });

    it('handles empty training history', async () => {
      stubTrainingHistory([]);

      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });

      const table = await screen.findByTestId('training-history-table');
      await waitFor(() => {
        expect(JSON.parse(table.getAttribute('data-history') || '[]').length).toBe(0);
      });
    });
  });

  // ==================== PROPS TESTS (2) ====================
  describe('Props', () => {
    it('accepts className prop', async () => {
      render(
        <ScoreProgressionPanel
          horseId={1}
          disciplineScores={horseDisciplineScores}
          className="custom-class"
        />,
        {
          wrapper: createWrapper(),
        }
      );
      await screen.findByTestId('discipline-score-columns');
      const panel = screen.getByTestId('score-progression-panel');
      expect(panel).toHaveClass('custom-class');
    });

    it('renders for the provided horseId', async () => {
      render(<ScoreProgressionPanel horseId={123} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      expect(await screen.findByTestId('score-progression-panel')).toBeInTheDocument();
    });
  });

  // ==================== ACCESSIBILITY TESTS (3) ====================
  describe('Accessibility', () => {
    // Old contract: at least 3 headings, the third being the removed caps box
    // (owner ruling 2026-10-22, Equoria-ky2ob). The two remaining sections
    // keep their headings.
    it('has proper heading hierarchy', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      const headings = screen.getAllByRole('heading');
      expect(headings.map((h) => h.textContent)).toEqual(['Discipline Scores', 'Training History']);
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

      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      const loadingContainer = screen.getByTestId('loading-container');
      expect(loadingContainer).toHaveAttribute('aria-label', 'Loading training data');
    });

    it('uses semantic HTML structure', async () => {
      render(<ScoreProgressionPanel horseId={1} disciplineScores={horseDisciplineScores} />, {
        wrapper: createWrapper(),
      });
      await screen.findByTestId('discipline-score-columns');
      expect(screen.getByTestId('score-progression-panel').tagName.toLowerCase()).toBe('div');
    });
  });
});
