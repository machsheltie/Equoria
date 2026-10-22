/**
 * LeaderboardsPage — win-percentage and number-of-wins boards (Equoria-xxdqh)
 *
 * Owner ruling 2026-10-22: two categories — win percentage (wins / shows
 * entered, horses with at least 100 shows entered) and number of wins. Both
 * render the backend's real response shape `{ entries, currentPage,
 * totalPages, totalEntries }` with honest loading / error / empty states.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import LeaderboardsPage from '../LeaderboardsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'user-abc';
const summaryPath = `${base}/api/v1/leaderboards/user-summary/${userId}`;
const winRatePath = `${base}/api/v1/leaderboards/win-rate`;
const winsPath = `${base}/api/v1/leaderboards/wins`;

const emptySummary = { userId, userName: 'Tester', rankings: [], bestRankings: [] };

const board = (entries: unknown[]) => ({
  success: true,
  data: {
    entries,
    currentPage: 1,
    totalPages: entries.length > 0 ? 1 : 0,
    totalEntries: entries.length,
  },
});

const moonflower = {
  rank: 1,
  horseId: 501,
  horseName: 'Moonflower',
  ownerId: userId,
  ownerName: 'Tester',
  primaryStat: 62.5,
  secondaryStats: { wins: 75, totalCompetitions: 120, winRate: 62.5 },
  isCurrentUser: true,
};

function renderPage(category: string) {
  server.use(http.get(summaryPath, () => HttpResponse.json({ success: true, data: emptySummary })));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'Tester' }}>
        <MemoryRouter initialEntries={[`/leaderboards?category=${category}`]}>
          <LeaderboardsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('LeaderboardsPage — win percentage board (Equoria-xxdqh)', () => {
  it('renders the real win percentage and shows entered', async () => {
    server.use(http.get(winRatePath, () => HttpResponse.json(board([moonflower]))));

    renderPage('win-rate');

    const table = await screen.findByRole('region', { name: /leaderboard table/i });
    const row = await within(table).findByTestId('leaderboard-entry');
    expect(row).toHaveTextContent('Moonflower');
    expect(row).toHaveTextContent('62.5%');
    expect(row).toHaveTextContent('Wins: 75');
    expect(row).toHaveTextContent('Shows: 120');
  });

  it('says no horse has entered 100 shows yet only after a successful empty response', async () => {
    server.use(http.get(winRatePath, () => HttpResponse.json(board([]))));

    renderPage('win-rate');

    expect(await screen.findByText('No horse has entered 100 shows yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that re-fetches, never the empty state', async () => {
    let calls = 0;
    server.use(
      http.get(winRatePath, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'board boom' }, { status: 500 })
          : HttpResponse.json(board([moonflower]));
      })
    );

    const user = userEvent.setup();
    renderPage('win-rate');

    const alert = await screen.findByRole('alert');
    expect(screen.queryByText('No horse has entered 100 shows yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/board boom/)).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('Moonflower')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('does not offer a time period filter for a lifetime record', async () => {
    server.use(http.get(winRatePath, () => HttpResponse.json(board([moonflower]))));

    renderPage('win-rate');

    await screen.findByText('Moonflower');
    expect(screen.queryByRole('group', { name: /time period filter/i })).not.toBeInTheDocument();
  });
});

describe('LeaderboardsPage — number of wins board (Equoria-xxdqh)', () => {
  it('has its own Wins tab and renders the real win count', async () => {
    server.use(
      http.get(winsPath, () =>
        HttpResponse.json(
          board([
            {
              ...moonflower,
              primaryStat: 75,
              secondaryStats: { wins: 75, totalCompetitions: 120 },
            },
          ])
        )
      )
    );

    renderPage('wins');

    expect(screen.getByTestId('category-wins')).toHaveAttribute('aria-selected', 'true');
    const row = await screen.findByTestId('leaderboard-entry');
    expect(row).toHaveTextContent('Moonflower');
    expect(row).toHaveTextContent('75');
    expect(row).toHaveTextContent('Shows: 120');
  });

  it('says no horse has won a show yet after a successful empty response', async () => {
    server.use(http.get(winsPath, () => HttpResponse.json(board([]))));

    renderPage('wins');

    expect(await screen.findByText('No horse has won a show yet')).toBeInTheDocument();
  });
});
