/**
 * LeaderboardsPage — "Your rankings" cards open the board they rank (Equoria-3kfne)
 *
 * The rank summary names each ranking for the player board it counts
 * (playerXp, playerEarnings, playerWins, playerWinPercentage); pressing a card
 * opens that board.
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

const ranking = (category: string, categoryLabel: string, statLabel: string) => ({
  category,
  categoryLabel,
  rank: 4,
  totalEntries: 90,
  primaryStat: 12,
  statLabel,
});

const summary = {
  userId,
  userName: 'Tester',
  rankings: [
    ranking('playerXp', 'Player XP', 'XP'),
    ranking('playerWins', 'Player Wins', 'Wins'),
    ranking('playerWinPercentage', 'Player Win %', 'Win %'),
  ],
  bestRankings: [],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'Tester' }}>
        <MemoryRouter initialEntries={['/leaderboards?category=horse-points']}>
          <LeaderboardsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('LeaderboardsPage — ranking cards (Equoria-3kfne)', () => {
  it.each([
    ['Player Wins', 'player-wins'],
    ['Player Win %', 'player-win-rate'],
    ['Player XP', 'player-xp'],
  ])('opens the %s board when its card is pressed', async (label, board) => {
    server.use(http.get(summaryPath, () => HttpResponse.json({ success: true, data: summary })));
    const user = userEvent.setup();
    renderPage();

    const section = await screen.findByRole('region', { name: /your rankings/i });
    const card = await within(section).findByText(label);
    await user.click(card);

    expect(await screen.findByTestId(`category-${board}`)).toHaveAttribute('aria-selected', 'true');
  });
});
