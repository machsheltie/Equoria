/**
 * LeaderboardsPage — honest rank-summary / horse-profile states
 * (Equoria-ffmha, Equoria-b9yi1)
 *
 * ffmha: a failed user-rank-summary fetch fell through to the new-player
 *   "No rankings yet" / "No achievements yet" empties. A player WITH rankings
 *   whose request failed was told she had none. Error -> alert + retry;
 *   empty only via a successful, genuinely-empty summary.
 * ffmha (same class): a failed horse-profile fetch opened a modal saying
 *   "Horse details not available" with no way to retry.
 * b9yi1: any unrecognised sex token was displayed as the real value
 *   "Stallion". Unknown renders "—".
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
const USER_ID = 'user-abc';
const SUMMARY_PATH = `${base}/api/v1/leaderboards/user-summary/${USER_ID}`;
const HORSE_PATH = `${base}/api/v1/leaderboards/horse/:horseId`;

const emptySummary = { userId: USER_ID, userName: 'Tester', rankings: [], bestRankings: [] };
const fullSummary = {
  userId: USER_ID,
  userName: 'Tester',
  rankings: [
    {
      category: 'level',
      categoryLabel: 'Level',
      rank: 7,
      totalEntries: 120,
      rankChange: 1,
      primaryStat: 15,
      statLabel: 'Level',
    },
  ],
  bestRankings: [{ category: 'level', categoryLabel: 'Level', rank: 7, achievement: 'Top 10' }],
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ id: USER_ID, username: 'Tester' }}>
        <MemoryRouter initialEntries={['/leaderboards']}>
          <LeaderboardsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const horseProfile = (sex: unknown) => ({
  success: true,
  data: {
    horseId: 101,
    name: 'Horse 1',
    breed: 'Arabian',
    age: 7,
    sex,
    stats: {
      speed: 88,
      stamina: 91,
      agility: 76,
      balance: 70,
      precision: 82,
      intelligence: 79,
      boldness: 84,
      flexibility: 73,
      obedience: 80,
      focus: 86,
    },
    totalEarnings: 125000,
    competitionWins: 12,
    topThreeFinishes: 21,
  },
});

describe('LeaderboardsPage — rank summary four-state (Equoria-ffmha)', () => {
  it('shows an error with retry, not "No rankings yet", when the summary fails', async () => {
    server.use(
      http.get(SUMMARY_PATH, () =>
        HttpResponse.json({ status: 'error', message: 'summary boom' }, { status: 500 })
      )
    );

    renderPage();

    const section = await screen.findByRole('region', { name: /your rankings/i });
    expect(await within(section).findByRole('alert')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
    expect(within(section).queryByText('No rankings yet')).not.toBeInTheDocument();
    expect(within(section).queryByText('No achievements yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/summary boom/i)).not.toBeInTheDocument();
  });

  it('retry re-fetches and renders the real ranks', async () => {
    let calls = 0;
    server.use(
      http.get(SUMMARY_PATH, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ status: 'error' }, { status: 500 })
          : HttpResponse.json({ success: true, data: fullSummary });
      })
    );

    const user = userEvent.setup();
    renderPage();

    const section = await screen.findByRole('region', { name: /your rankings/i });
    await user.click(await within(section).findByRole('button', { name: /try again|retry/i }));

    expect(await within(section).findByTestId('rankings-grid')).toBeInTheDocument();
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('shows "No rankings yet" only after a successful, genuinely empty summary', async () => {
    server.use(
      http.get(SUMMARY_PATH, () => HttpResponse.json({ success: true, data: emptySummary }))
    );

    renderPage();

    const section = await screen.findByRole('region', { name: /your rankings/i });
    expect(await within(section).findByText('No rankings yet')).toBeInTheDocument();
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LeaderboardsPage — horse detail modal (Equoria-ffmha, Equoria-b9yi1)', () => {
  const openFirstHorse = async () => {
    const user = userEvent.setup();
    renderPage();
    const rows = await screen.findAllByTestId('leaderboard-entry');
    await user.click(rows[0]);
  };

  it('renders an unknown sex as "—", never a fabricated "Stallion"', async () => {
    server.use(
      http.get(SUMMARY_PATH, () => HttpResponse.json({ success: true, data: emptySummary })),
      http.get(HORSE_PATH, () => HttpResponse.json(horseProfile('Gelding')))
    );

    await openFirstHorse();

    const dialog = await screen.findByTestId('horse-detail-modal');
    const header = await within(dialog).findByText(/Arabian/);
    expect(header).toHaveTextContent('7 years old');
    expect(header).toHaveTextContent('—');
    expect(header).not.toHaveTextContent('Stallion');
  });

  it('renders a missing sex as "—" too', async () => {
    server.use(
      http.get(SUMMARY_PATH, () => HttpResponse.json({ success: true, data: emptySummary })),
      http.get(HORSE_PATH, () => HttpResponse.json(horseProfile(undefined)))
    );

    await openFirstHorse();

    const dialog = await screen.findByTestId('horse-detail-modal');
    const header = await within(dialog).findByText(/Arabian/);
    expect(header).not.toHaveTextContent('Stallion');
    expect(header).toHaveTextContent('—');
  });

  it('still renders a recognised sex verbatim', async () => {
    server.use(
      http.get(SUMMARY_PATH, () => HttpResponse.json({ success: true, data: emptySummary })),
      http.get(HORSE_PATH, () => HttpResponse.json(horseProfile('Mare')))
    );

    await openFirstHorse();

    const dialog = await screen.findByTestId('horse-detail-modal');
    expect(await within(dialog).findByText(/Arabian/)).toHaveTextContent('Mare');
  });

  it('shows an error with retry (not the bare "not available" empty) when the profile fails', async () => {
    let calls = 0;
    server.use(
      http.get(SUMMARY_PATH, () => HttpResponse.json({ success: true, data: emptySummary })),
      http.get(HORSE_PATH, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ status: 'error', message: 'profile boom' }, { status: 500 })
          : HttpResponse.json(horseProfile('Mare'));
      })
    );

    await openFirstHorse();

    const dialog = await screen.findByTestId('horse-detail-modal');
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('empty-horse-state')).not.toBeInTheDocument();
    expect(screen.queryByText(/profile boom/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: /try again|retry/i }));
    expect(await within(dialog).findByText(/Arabian/)).toHaveTextContent('Mare');
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
