/**
 * MyStablePage — honest horses / career-stats states (Equoria-ye01k)
 *
 * useHorses had no error branch (`data = []`), so a failed roster read looked
 * like a brand-new empty stable ("Total Horses 0", "No Retired Horses Yet"),
 * and zeros were shown while any query was still pending. The four states
 * (doctrine §1): loading -> status, error -> alert + retry, empty only via a
 * successful empty fetch, success -> real values.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import MyStablePage from '../MyStablePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'user-123';
const HORSES_PATH = `${base}/api/v1/horses`;
const STATS_PATH = `${base}/api/v1/users/${USER_ID}/competition-stats`;
const HISTORY_PATH = `${base}/api/v1/horses/:id/competition-history`;

const statsOk = {
  userId: USER_ID,
  totalCompetitions: 17,
  totalWins: 5,
  totalTop3: 9,
  winRate: 29.4,
  totalPrizeMoney: 4200,
  bestPlacement: 1,
  mostSuccessfulDiscipline: 'Racing',
  recentCompetitions: [],
};

const horseRow = (id: number, name: string, ageYears: number, sex = 'Mare') => ({
  id,
  name,
  ageYears,
  sex,
  breed: 'Thoroughbred',
  totalEarnings: 100,
});

function stubStats(ok = true) {
  server.use(
    http.get(STATS_PATH, () =>
      ok
        ? HttpResponse.json(statsOk)
        : HttpResponse.json({ status: 'error', message: 'stats boom' }, { status: 500 })
    )
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: USER_ID, username: 'tester' }}>
        <MemoryRouter initialEntries={['/my-stable']}>
          <MyStablePage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

/** The value paragraph of a StatBlock, found from its label. */
const statValue = (label: string) =>
  screen.getByText(label).parentElement?.parentElement?.querySelector('p') as HTMLElement;

describe('MyStablePage — horses query four-state (Equoria-ye01k)', () => {
  it('shows an error with retry, not an empty stable, when the roster fails', async () => {
    stubStats();
    server.use(
      http.get(HORSES_PATH, () =>
        HttpResponse.json({ status: 'error', message: 'horses boom' }, { status: 500 })
      )
    );

    renderPage();

    const tab = await screen.findByTestId('stable-profile-tab');
    expect(await within(tab).findByRole('alert')).toBeInTheDocument();
    expect(within(tab).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // Not the new-stable story, not fabricated zeros.
    expect(within(tab).queryByText(/will grow as you add horses/i)).not.toBeInTheDocument();
    expect(statValue('Total Horses')).toHaveTextContent('—');
    expect(statValue('Active Racers')).toHaveTextContent('—');
    // Raw server text never leaks.
    expect(screen.queryByText(/horses boom/i)).not.toBeInTheDocument();
  });

  it('Hall of Fame shows the error (not "No Retired Horses Yet") when the roster fails', async () => {
    stubStats();
    server.use(
      http.get(HORSES_PATH, () => HttpResponse.json({ status: 'error' }, { status: 500 }))
    );

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /hall of fame/i }));

    const tab = await screen.findByTestId('legacy-hall-tab');
    expect(await within(tab).findByRole('alert')).toBeInTheDocument();
    expect(within(tab).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No Retired Horses Yet')).not.toBeInTheDocument();
  });

  it('retry re-fetches the roster and renders the real counts', async () => {
    stubStats();
    let calls = 0;
    server.use(
      http.get(HORSES_PATH, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ status: 'error' }, { status: 500 })
          : HttpResponse.json({
              success: true,
              data: [horseRow(1, 'Alpha', 5), horseRow(2, 'Beta', 6, 'Stallion')],
            });
      })
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /try again/i }));

    await screen.findByText(/live stable profile/i);
    expect(statValue('Total Horses')).toHaveTextContent('2');
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('shows a loading status, not zeros, while the roster is pending', async () => {
    stubStats();
    server.use(
      http.get(HORSES_PATH, async () => {
        await delay(150);
        return HttpResponse.json({ success: true, data: [horseRow(1, 'Alpha', 5)] });
      })
    );

    renderPage();

    const tab = await screen.findByTestId('stable-profile-tab');
    expect(within(tab).getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('stable-stats')).not.toBeInTheDocument();
    await screen.findByTestId('stable-stats');
    expect(statValue('Total Horses')).toHaveTextContent('1');
  });

  it('a genuinely empty roster is honest zero (empty only via success)', async () => {
    stubStats();
    server.use(http.get(HORSES_PATH, () => HttpResponse.json({ success: true, data: [] })));

    renderPage();

    expect(await screen.findByText(/will grow as you add horses/i)).toBeInTheDocument();
    expect(statValue('Total Horses')).toHaveTextContent('0');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('MyStablePage — career figures are unknown, not zero (Equoria-ye01k)', () => {
  it('shows "—" for competitions and wins while the stats query is pending', async () => {
    server.use(
      http.get(HORSES_PATH, () => HttpResponse.json({ success: true, data: [] })),
      http.get(STATS_PATH, () => new Promise(() => {}))
    );

    renderPage();

    await screen.findByTestId('stable-stats');
    expect(statValue('Competitions')).toHaveTextContent('—');
    expect(statValue('First Place Wins')).toHaveTextContent('—');
  });

  it('shows "—" for competitions and wins when the stats query fails', async () => {
    server.use(http.get(HORSES_PATH, () => HttpResponse.json({ success: true, data: [] })));
    stubStats(false);

    renderPage();

    await screen.findByTestId('career-stats-error');
    expect(statValue('Competitions')).toHaveTextContent('—');
    expect(statValue('First Place Wins')).toHaveTextContent('—');
  });

  it('shows "—" for a retired horse career whose history request fails', async () => {
    stubStats();
    server.use(
      http.get(HORSES_PATH, () =>
        HttpResponse.json({ success: true, data: [horseRow(101, 'Old Champion', 25)] })
      ),
      http.get(HISTORY_PATH, () => HttpResponse.json({ status: 'error' }, { status: 500 }))
    );

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /hall of fame/i }));

    const entry = await screen.findByTestId('hof-entry-101');
    const comps = within(entry).getByText('Competitions').previousElementSibling as HTMLElement;
    const wins = within(entry).getByText('Wins').previousElementSibling as HTMLElement;
    expect(comps).toHaveTextContent('—');
    expect(wins).toHaveTextContent('—');
  });
});
