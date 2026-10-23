/**
 * The first-ever win moment on the results screen (Equoria-oey96.41).
 *
 * Owner ruling 2026-10-23: the backend marks a horse's first win; the results
 * screen shows the CinematicMoment once for that first win; repeat wins show the
 * normal result; no toast. "Once" rides on the server's viewedAt latch: a first
 * win the player has not opened yet is celebrated when the screen loads, and the
 * screen's mark-viewed write then closes it for every later visit.
 *
 * Real page, real hooks, real list; only the HTTP boundary is stubbed (MSW).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import CompetitionResultsPage from '../CompetitionResultsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const row = (overrides: Record<string, unknown>) => ({
  horseId: 7,
  horseName: 'Moonflower',
  rank: 1,
  score: 88,
  prizeWon: 500,
  horsePointsAwarded: 10,
  isFirstWin: false,
  viewed: false,
  ...overrides,
});

const summary = (competitionId: number, userResults: unknown[]) => ({
  competitionId,
  competitionName: `Halcyon Downs Classic ${competitionId}`,
  discipline: 'Dressage',
  date: '2026-10-20T10:00:00.000Z',
  totalParticipants: 6,
  prizePool: 1000,
  userResults,
});

function stub(results: unknown[]) {
  server.use(
    http.get(`${base}/api/v1/users/123/competition-stats`, () =>
      HttpResponse.json({
        userId: '123',
        totalCompetitions: 2,
        totalWins: 1,
        totalTop3: 1,
        winRate: 50,
        totalPrizeMoney: 500,
        bestPlacement: 1,
        mostSuccessfulDiscipline: 'Dressage',
        recentCompetitions: [],
      })
    ),
    http.get(`${base}/api/v1/competition/user-results`, () =>
      HttpResponse.json({ success: true, results, count: results.length })
    ),
    http.post(`${base}/api/v1/competition/results/viewed`, () =>
      HttpResponse.json({ success: true, markedCount: 1 })
    )
  );
}

describe('CompetitionResultsPage — first-ever win (Equoria-oey96.41)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 123, username: 'TestUser' }}>
          <MemoryRouter initialEntries={['/competitions/results']}>
            <Routes>
              <Route path="/competitions/results" element={<CompetitionResultsPage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it("celebrates a horse's first win, not yet seen, with the cinematic moment", async () => {
    stub([summary(11, [row({ isFirstWin: true, viewed: false })])]);
    renderPage();

    const overlay = await screen.findByTestId('cinematic-moment-overlay');
    expect(overlay).toHaveAttribute('aria-label', 'Competition victory notification');
    expect(screen.getByTestId('cinematic-moment-title')).toHaveTextContent(/first victory/i);
    expect(screen.getByTestId('cinematic-moment-subtitle')).toHaveTextContent(
      'Moonflower won Halcyon Downs Classic 11'
    );
  });

  it('shows the moment once: dismissed, it does not return when the results refresh', async () => {
    stub([summary(11, [row({ isFirstWin: true, viewed: false })])]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('cinematic-moment-overlay'));
    expect(screen.queryByTestId('cinematic-moment-overlay')).not.toBeInTheDocument();

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['user-competition-results'] });
    });
    expect(screen.queryByTestId('cinematic-moment-overlay')).not.toBeInTheDocument();
  });

  it('shows no moment for a first win the player has already opened', async () => {
    stub([summary(11, [row({ isFirstWin: true, viewed: true })])]);
    renderPage();

    expect(await screen.findByText('Halcyon Downs Classic 11')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Moonflower')).toBeInTheDocument());
    expect(screen.queryByTestId('cinematic-moment-overlay')).not.toBeInTheDocument();
  });

  it('shows the normal result, with no moment, for a repeat win', async () => {
    stub([summary(12, [row({ isFirstWin: false, viewed: false })])]);
    renderPage();

    expect(await screen.findByText('Halcyon Downs Classic 12')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Moonflower')).toBeInTheDocument());
    expect(screen.queryByTestId('cinematic-moment-overlay')).not.toBeInTheDocument();
  });
});
