/**
 * MyStablePage career-stats wiring tests (boundary; converted under Equoria-fefh2.12)
 *
 * Story 21S-4: verify that MyStablePage displays REAL career data from the
 * backend endpoints, not hardcoded zeros.
 *
 * Boundary-level conversion (replaces the 5 app-own mocks that previously stood
 * in for AuthContext / useAuth / useHorses / useUserCompetitionStats /
 * competitionResults). The page now renders against:
 *   - the REAL AuthContext via `MockAuthProvider` (NOT
 *     `vi.mock('@/contexts/AuthContext')` + `vi.mock('@/hooks/useAuth')`);
 *   - the REAL `useHorses` / `useUserCompetitionStats` hooks and the REAL
 *     `fetchHorseCompetitionHistory` api fn (NOT module mocks) — each driven by
 *     real React Query over `apiClient`, with the network boundary stubbed by
 *     MSW inline `server.use(http.get(...))`.
 *
 * Verified real wire shapes (read from the backend controllers, not guessed):
 *   - GET /api/v1/horses → canonical envelope { success, message, data: [...] }
 *     (backend/modules/horses/routes/horseRoutes.mjs router.get('/') →
 *     res.json({ success: true, message, data: horses.map(...) })). The
 *     `horsesApi.list` call appends a `?t=<ts>` cache-buster, so the handler
 *     path ignores the query string. `fetchWithAuth` unwraps `.data` → the
 *     hook receives the bare array.
 *   - GET /api/v1/horses/:id/competition-history → BARE object (NO envelope):
 *     backend/modules/horses/controllers/horseOverviewController.mjs#getHorseCompetitionHistory
 *     returns res.json({ horseId, horseName, statistics: {...}, competitions: [] }).
 *   - GET /api/v1/users/:userId/competition-stats → BARE object (NO envelope):
 *     backend/modules/users/controllers/userController.mjs#getUserCompetitionStats
 *     returns res.json({ userId, totalCompetitions, totalWins, ... }). The
 *     mock user's id is the UUID string 'user-123', so the request hits
 *     /api/v1/users/user-123/competition-stats.
 *
 * The error state is now produced honestly by the real hook: the stats
 * boundary returns 500, the real query surfaces `isError: true`, and the page
 * renders the `career-stats-error` notice. Sync mock-returns became async
 * `findBy` / `waitFor` assertions, faithful to the real async data path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import MyStablePage from '../MyStablePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'user-123';
const HORSES_PATH = `${base}/api/v1/horses`;
const STATS_PATH = `${base}/api/v1/users/${USER_ID}/competition-stats`;
const HISTORY_PATH = `${base}/api/v1/horses/:id/competition-history`;

/**
 * Build a horse-list envelope entry. Only the fields MyStablePage reads are
 * populated (id, name, breed, ageYears, totalEarnings, sex) — the real
 * projection carries far more, but the page consumes just these.
 */
function horse(
  overrides: Record<string, unknown> & { id: number; name: string; ageYears: number }
) {
  return {
    breed: 'Thoroughbred',
    totalEarnings: 0,
    sex: 'Mare',
    ...overrides,
  };
}

/** Stub GET /api/v1/horses with the canonical { success, data } envelope. */
function stubHorses(list: Array<Record<string, unknown>>) {
  server.use(http.get(HORSES_PATH, () => HttpResponse.json({ success: true, data: list })));
}

/** Bare-object horse competition-history (mirrors the real controller). */
function history(horseId: number, wins: number, totalCompetitions: number) {
  return {
    horseId,
    horseName: `Horse ${horseId}`,
    statistics: {
      totalCompetitions,
      wins,
      top3Finishes: wins + 2,
      winRate: totalCompetitions > 0 ? Math.round((wins / totalCompetitions) * 10000) / 100 : 0,
      totalPrizeMoney: 2500,
      averagePlacement: 3.5,
      bestPlacement: wins > 0 ? 1 : 4,
    },
    competitions: [],
  };
}

function renderWithProviders() {
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

describe('MyStablePage — career stats wiring (Story 21S-4)', () => {
  beforeEach(() => {
    // Default: empty stable so the Hall-of-Fame per-horse history queries don't
    // fire. Individual tests override via server.use(...) and stubHorses(...).
    stubHorses([]);
  });

  it('shows stable stats from useUserCompetitionStats, not hardcoded zeros', async () => {
    server.use(
      http.get(STATS_PATH, () =>
        HttpResponse.json({
          userId: USER_ID,
          totalCompetitions: 17,
          totalWins: 5,
          totalTop3: 9,
          winRate: 29.41,
          totalPrizeMoney: 4200,
          bestPlacement: 1,
          mostSuccessfulDiscipline: 'Racing',
          recentCompetitions: [],
        })
      )
    );

    renderWithProviders();

    const statsGrid = await screen.findByTestId('stable-stats');
    // "Competitions" + "17" — value arrives over the wire after a tick.
    expect(within(statsGrid).getByText('Competitions')).toBeInTheDocument();
    expect(await within(statsGrid).findByText('17')).toBeInTheDocument();
    // "First Place Wins" + "5"
    expect(within(statsGrid).getByText('First Place Wins')).toBeInTheDocument();
    expect(within(statsGrid).getByText('5')).toBeInTheDocument();
  });

  it('shows zeros and no error notice when the stats query is loading/pending', async () => {
    // Never resolve the stats boundary → the real query stays pending
    // (isLoading: true, isError: false). The page must render zero fallbacks
    // and NO error notice.
    server.use(http.get(STATS_PATH, () => new Promise(() => {})));

    renderWithProviders();

    // Stats grid renders immediately with 0 fallback values (the page does not
    // gate the grid on the stats query).
    const statsGrid = await screen.findByTestId('stable-stats');
    expect(within(statsGrid).getByText('Competitions')).toBeInTheDocument();
    // No error notice should be shown during loading.
    expect(screen.queryByTestId('career-stats-error')).not.toBeInTheDocument();
  });

  it('shows career-stats-error notice when useUserCompetitionStats fails', async () => {
    // Real failure: the boundary 500s, the real query surfaces isError, and the
    // page renders the honest error notice.
    server.use(
      http.get(STATS_PATH, () =>
        HttpResponse.json({ status: 'error', message: 'Network error' }, { status: 500 })
      )
    );

    renderWithProviders();

    // The error notice must be visible with the correct testid.
    const errorNotice = await screen.findByTestId('career-stats-error');
    expect(errorNotice).toBeInTheDocument();
    expect(errorNotice).toHaveTextContent(/stats unavailable/i);
    // Stats grid is still rendered (not replaced) showing zero fallbacks.
    const statsGrid = await screen.findByTestId('stable-stats');
    expect(within(statsGrid).getByText('Competitions')).toBeInTheDocument();
  });

  it('populates Hall of Fame career.competitions + career.wins from useHorseCompetitionHistory', async () => {
    stubHorses([
      horse({
        id: 101,
        name: 'Old Champion',
        ageYears: 25,
        totalEarnings: 8000,
        breed: 'Thoroughbred',
      }),
    ]);
    server.use(
      http.get(STATS_PATH, () =>
        HttpResponse.json({
          userId: USER_ID,
          totalCompetitions: 12,
          totalWins: 3,
          totalTop3: 7,
          winRate: 25,
          totalPrizeMoney: 2500,
          bestPlacement: 1,
          mostSuccessfulDiscipline: 'Racing',
          recentCompetitions: [],
        })
      ),
      http.get(HISTORY_PATH, ({ params }) =>
        // Real per-horse history: 12 competitions, 3 wins for horse 101.
        HttpResponse.json(history(Number(params.id), 3, 12))
      )
    );

    const user = (await import('@testing-library/user-event')).default;
    renderWithProviders();

    // Switch to the Hall of Fame tab — MyStablePage uses CanonicalTabs (Radix
    // role="tab"), so match by accessible name.
    await user.setup().click(screen.getByRole('tab', { name: /hall of fame/i }));

    // The entry card should eventually render with real numbers.
    const entry = await screen.findByTestId('hof-entry-101');
    // competitions cell = 12, wins cell = 3 (arrive after the history query
    // resolves).
    expect(await within(entry).findByText('12')).toBeInTheDocument();
    expect(within(entry).getByText('3')).toBeInTheDocument();
  });
});
