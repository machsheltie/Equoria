/**
 * LeaderboardsPage — one real-shape test per tab (Equoria-pthuj).
 *
 * The player and horse boards and the discipline tab showed
 * "No entries found" after a successful request that held real rows, because
 * the backend answered shapes the page did not read. Each response below is the
 * exact JSON the backend serves for that board (see backend/modules/
 * leaderboards/__tests__/leaderboardPageBoards.integration.test.mjs, which pins
 * the same shapes against the real routes): rows first, empty only when the
 * board really is empty.
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
const boardPath = (board: string) => `${base}/api/v1/leaderboards/boards/${board}`;

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

function renderPage(search: string) {
  server.use(http.get(summaryPath, () => HttpResponse.json({ success: true, data: emptySummary })));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'Tester' }}>
        <MemoryRouter initialEntries={[`/leaderboards?${search}`]}>
          <LeaderboardsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('LeaderboardsPage — real board shapes (Equoria-pthuj)', () => {
  it('player-xp: lists the players the backend ranked', async () => {
    server.use(
      http.get(boardPath('playerXp'), () =>
        HttpResponse.json(
          board([
            {
              rank: 1,
              ownerId: userId,
              ownerName: 'Tester',
              primaryStat: 14,
              secondaryStats: {},
              isCurrentUser: true,
            },
            {
              rank: 2,
              ownerId: 'user-2',
              ownerName: 'Rowan',
              primaryStat: 11,
              secondaryStats: {},
              isCurrentUser: false,
            },
          ])
        )
      )
    );

    renderPage('category=player-xp');

    const rows = await screen.findAllByTestId('leaderboard-entry');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Tester');
    expect(rows[0]).toHaveTextContent('14');
    expect(rows[1]).toHaveTextContent('Rowan');
    // A player row has no horse to open, so it is not offered as clickable.
    expect(rows[0]).not.toHaveAttribute('tabindex');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('horse-earnings: lists the horses with their earnings', async () => {
    server.use(
      http.get(boardPath('horseEarnings'), () =>
        HttpResponse.json(
          board([
            {
              rank: 1,
              horseId: 501,
              horseName: 'Moonflower',
              ownerId: userId,
              ownerName: 'Tester',
              primaryStat: 12500,
              secondaryStats: {},
              isCurrentUser: true,
            },
          ])
        )
      )
    );

    renderPage('category=horse-earnings');

    const row = await screen.findByTestId('leaderboard-entry');
    expect(row).toHaveTextContent('Moonflower');
    expect(row).toHaveTextContent('Tester');
    expect(row).toHaveTextContent('12,500');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('player-earnings: lists the players with their summed earnings', async () => {
    server.use(
      http.get(boardPath('playerEarnings'), () =>
        HttpResponse.json(
          board([
            {
              rank: 1,
              ownerId: 'user-2',
              ownerName: 'Rowan',
              primaryStat: 98000,
              secondaryStats: {},
              isCurrentUser: false,
            },
          ])
        )
      )
    );

    renderPage('category=player-earnings');

    const row = await screen.findByTestId('leaderboard-entry');
    expect(row).toHaveTextContent('Rowan');
    expect(row).toHaveTextContent('98,000');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });

  it('discipline: asks for the selected discipline by name and lists its winners', async () => {
    const asked: Array<string | null> = [];
    server.use(
      http.get(boardPath('discipline'), ({ request }) => {
        const discipline = new URL(request.url).searchParams.get('discipline');
        asked.push(discipline);
        return HttpResponse.json(
          board([
            {
              rank: 1,
              horseId: 501,
              horseName: discipline === 'Show Jumping' ? 'Skyline' : 'Moonflower',
              ownerId: userId,
              ownerName: 'Tester',
              primaryStat: 3,
              secondaryStats: { wins: 3, totalCompetitions: 4 },
              isCurrentUser: true,
            },
          ])
        );
      })
    );

    const user = userEvent.setup();
    renderPage('category=discipline');

    // The select shows its first option, so that is the board that loads.
    const row = await screen.findByTestId('leaderboard-entry');
    expect(row).toHaveTextContent('Moonflower');
    expect(asked[0]).toBe('Western Pleasure');
    expect(screen.getByTestId('discipline-selector')).toHaveValue('western-pleasure');

    await user.selectOptions(screen.getByTestId('discipline-selector'), 'show-jumping');

    expect(await screen.findByText('Skyline')).toBeInTheDocument();
    expect(asked).toContain('Show Jumping');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('discipline: says no horse has won there yet only after a successful empty board', async () => {
    server.use(http.get(boardPath('discipline'), () => HttpResponse.json(board([]))));

    renderPage('category=discipline&discipline=reining');

    const empty = await screen.findByTestId('empty-state');
    expect(within(empty).getByText('No horse has won in this discipline yet')).toBeInTheDocument();
  });

  it('shows an error, never the empty state, when a board request fails', async () => {
    server.use(
      http.get(boardPath('playerXp'), () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
      )
    );

    renderPage('category=player-xp');

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
  });
});
