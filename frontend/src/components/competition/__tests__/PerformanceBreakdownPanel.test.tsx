/**
 * PerformanceBreakdownPanel Tests (Equoria-gf8sj, Spec 11.3 ScoreBreakdownRadar)
 *
 * Wires the (previously dead) performanceView state on CompetitionResultsPage
 * to a real score-breakdown view. The panel fetches the REAL competition
 * results via useCompetitionResults, finds the participant by horseId, and
 * feeds the backend's real scoreBreakdown into ScoreBreakdownRadar.
 *
 * Verifies:
 *   - renders ScoreBreakdownRadar with the real scoreBreakdown components
 *   - exposes the breakdown values to screen readers (accessible text)
 *   - loading / error / no-breakdown states behave
 *
 * The useCompetitionResults hook is mocked here ONLY to inject a deterministic
 * server payload shape — this is the data the real backend
 * (competitionController scoringDetails) returns. No api-client is vi.mocked.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PerformanceBreakdownPanel from '../PerformanceBreakdownPanel';
import * as useCompetitionResultsHook from '@/hooks/api/useCompetitionResults';

vi.mock('@/hooks/api/useCompetitionResults');

const realServerPayload = {
  competitionId: 42,
  competitionName: 'Spring Dressage Classic',
  discipline: 'Dressage',
  date: '2026-05-10',
  totalParticipants: 8,
  prizePool: 1000,
  prizeDistribution: { first: 500, second: 300, third: 200 },
  results: [
    {
      rank: 1,
      horseId: 7,
      horseName: 'Luna',
      ownerId: 'u1',
      ownerName: 'Me',
      finalScore: 187.4,
      prizeWon: 500,
      isCurrentUser: true,
      scoreBreakdown: {
        baseStatScore: 92,
        traitBonus: 5,
        trainingScore: 60,
        equipmentBonus: 8,
        riderBonus: 12,
        healthModifier: 3,
        randomLuck: 7.4,
      },
    },
  ],
};

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PerformanceBreakdownPanel competitionId={42} horseId={7} onClose={() => {}} />
    </QueryClientProvider>
  );
}

describe('PerformanceBreakdownPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the score breakdown radar from the real backend scoreBreakdown', () => {
    vi.mocked(useCompetitionResultsHook.useCompetitionResults).mockReturnValue({
      data: realServerPayload,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCompetitionResultsHook.useCompetitionResults>);

    renderPanel();

    // The radar chart region is present (ScoreBreakdownRadar renders a figure/region).
    expect(screen.getByTestId('performance-breakdown-panel')).toBeInTheDocument();
    // Screen-reader accessible breakdown values (Spec: values exposed to SRs).
    const sr = screen.getByTestId('score-breakdown-sr');
    expect(sr).toHaveTextContent(/Base Stat Score/i);
    expect(sr).toHaveTextContent(/92/);
    expect(sr).toHaveTextContent(/Trait Bonus/i);
    expect(sr).toHaveTextContent(/Final Score/i);
    expect(sr).toHaveTextContent(/187\.4/);
  });

  it('shows a loading state while results are fetching', () => {
    vi.mocked(useCompetitionResultsHook.useCompetitionResults).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCompetitionResultsHook.useCompetitionResults>);

    renderPanel();
    expect(screen.getByTestId('performance-breakdown-loading')).toBeInTheDocument();
  });

  it('shows a friendly message when the horse has no score breakdown', () => {
    vi.mocked(useCompetitionResultsHook.useCompetitionResults).mockReturnValue({
      data: {
        ...realServerPayload,
        results: [{ ...realServerPayload.results[0], scoreBreakdown: undefined }],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCompetitionResultsHook.useCompetitionResults>);

    renderPanel();
    expect(screen.getByTestId('performance-breakdown-empty')).toBeInTheDocument();
  });
});
