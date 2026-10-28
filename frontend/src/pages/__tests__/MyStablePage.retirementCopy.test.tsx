/**
 * MyStablePage — retirement copy (Equoria-s9brd).
 *
 * Owner ruling 2026-10-28 (q181, final): players can not retire horses. The only
 * way a horse retires is turning 21. The Hall of Fame and the stable profile
 * panel used to tell players to "Retire a horse at level 8 or higher" and that
 * horses retire "at level 10 or after 80–104 career weeks" — neither is true.
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
import MyStablePage from '../MyStablePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const userId = 'user-s9brd';

function renderPage() {
  server.use(
    http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [] })),
    http.get(`${base}/api/v1/users/${userId}/competition-stats`, () =>
      HttpResponse.json({
        userId,
        totalCompetitions: 0,
        totalWins: 0,
        totalTop3: 0,
        winRate: 0,
        totalPrizeMoney: 0,
        bestPlacement: null,
        mostSuccessfulDiscipline: null,
        recentCompetitions: [],
      })
    )
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: userId, username: 'tester' }}>
        <MemoryRouter initialEntries={['/my-stable']}>
          <MyStablePage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

// Any wording that invites the player to retire a horse, or a level/career rule.
const playerRetires = /retire (a|your|this) horse|level 8|level 10|career weeks/i;

describe('MyStablePage — horses retire only at 21 (Equoria-s9brd)', () => {
  it('the empty Hall of Fame says horses retire at 21 and never asks the player to retire one', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /hall of fame/i }));

    const tab = await screen.findByTestId('legacy-hall-tab');
    expect(await within(tab).findByText('No Retired Horses Yet')).toBeInTheDocument();
    expect(tab).toHaveTextContent(/21st birthday/i);
    expect(tab.textContent ?? '').not.toMatch(playerRetires);
  });

  it('the stable profile panel never says a player retires a horse', async () => {
    renderPage();
    const panel = (await screen.findByText('About Your Stable Profile')).closest('aside');
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent(/21st birthday/i);
    expect(panel?.textContent ?? '').not.toMatch(playerRetires);
    expect(document.body.textContent ?? '').not.toMatch(playerRetires);
  });
});
