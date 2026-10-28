/**
 * Hall of Fame career figures: loading, failed with retry, and lazy (Equoria-l8w4t, STA-08)
 *
 * Each retired horse's career figures showed "—" both while its history was
 * loading and after it failed, with no way to tell them apart and no retry,
 * and every history was fetched even when the Hall of Fame was never opened.
 * Each entry now says it is loading, or says it failed with a real Try Again,
 * and histories are fetched only once the Hall of Fame tab is open.
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
const userId = 'user-l8w4t';
const historyPath = `${base}/api/v1/horses/:id/competition-history`;

const retired = {
  id: 301,
  name: 'Old Lantern',
  ageYears: 23,
  sex: 'Mare',
  breed: 'Arabian',
  totalEarnings: 50,
};

function history(horseId: number) {
  return {
    horseId,
    horseName: 'Old Lantern',
    statistics: {
      totalCompetitions: 14,
      wins: 6,
      top3Finishes: 9,
      winRate: 42.86,
      totalPrizeMoney: 900,
      averagePlacement: 2.5,
      bestPlacement: 1,
    },
    competitions: [],
  };
}

function stubBase() {
  server.use(
    http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [retired] })),
    http.get(`${base}/api/v1/users/${userId}/competition-stats`, () =>
      HttpResponse.json({ userId, totalCompetitions: 0, totalWins: 0, recentCompetitions: [] })
    )
  );
}

function renderPage() {
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

describe('Hall of Fame career figures (Equoria-l8w4t)', () => {
  it('fetches no career history until the Hall of Fame tab is opened', async () => {
    stubBase();
    let historyRequests = 0;
    server.use(
      http.get(historyPath, ({ params }) => {
        historyRequests += 1;
        return HttpResponse.json(history(Number(params.id)));
      })
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByTestId('stable-stats');
    expect(historyRequests).toBe(0);

    await user.click(screen.getByRole('tab', { name: /hall of fame/i }));
    const entry = await screen.findByTestId('hof-entry-301');
    expect(await within(entry).findByText('14')).toBeInTheDocument();
    expect(historyRequests).toBe(1);
  });

  it('says a career record is loading while its history is pending', async () => {
    stubBase();
    server.use(
      http.get(historyPath, async ({ params }) => {
        await delay(200);
        return HttpResponse.json(history(Number(params.id)));
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /hall of fame/i }));

    const entry = await screen.findByTestId('hof-entry-301');
    expect(within(entry).getByRole('status')).toHaveTextContent(/loading/i);
    // A champion's card is re-framed once its wins arrive, so look it up again.
    await screen.findByTestId('hof-champion-frame-301');
    const loaded = screen.getByTestId('hof-entry-301');
    expect(within(loaded).getByText('14')).toBeInTheDocument();
    expect(within(loaded).queryByRole('status')).not.toBeInTheDocument();
  });

  it('says a career record failed, and Try Again fetches it for real', async () => {
    stubBase();
    let fail = true;
    server.use(
      http.get(historyPath, ({ params }) =>
        fail
          ? HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 })
          : HttpResponse.json(history(Number(params.id)))
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /hall of fame/i }));

    const entry = await screen.findByTestId('hof-entry-301');
    expect(await within(entry).findByRole('alert')).toHaveTextContent(/career record/i);
    expect(within(entry).queryByRole('status')).not.toBeInTheDocument();

    fail = false;
    await user.click(within(entry).getByRole('button', { name: /try again/i }));

    // A champion's card is re-framed once its wins arrive, so look it up again.
    await screen.findByTestId('hof-champion-frame-301');
    const loaded = screen.getByTestId('hof-entry-301');
    expect(within(loaded).getByText('14')).toBeInTheDocument();
    expect(within(loaded).queryByRole('alert')).not.toBeInTheDocument();
  });
});
