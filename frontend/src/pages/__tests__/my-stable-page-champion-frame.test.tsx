/**
 * MyStablePage — Hall-of-Fame champion GoldBorderFrame wiring (Equoria-8did5)
 * (boundary; converted under Equoria-fefh2.12)
 *
 * Spec 11.3.13 + 11.5 Phase 3: GoldBorderFrame is the ornate gold-border
 * wrapper for featured/premium/championship content. This test proves it is
 * wired to a REAL backend-derived condition on the Hall of Fame surface:
 *
 *   - A retired horse with >=1 real competition win (career.wins, derived from
 *     useHorseCompetitionHistory → history.statistics.wins) IS a champion and
 *     the GoldBorderFrame renders around its card.
 *   - A retired horse with 0 wins is in the hall but does NOT get the frame.
 *
 * The win count is real backend data, not a hardcoded "featured" flag (21R).
 *
 * Boundary-level conversion: the 5 app-own mocks (AuthContext / useAuth /
 * useHorses / useUserCompetitionStats / competitionResults) are replaced by the
 * REAL AuthContext (`MockAuthProvider`), the REAL hooks + api fn, and inline
 * MSW `server.use(http.get(...))` boundary stubs.
 *
 * Verified real wire shapes (read from the backend controllers, not guessed):
 *   - GET /api/v1/horses → { success, message, data: [...] } envelope
 *     (horseRoutes.mjs router.get('/')). `horsesApi.list` appends `?t=<ts>`, so
 *     the handler path ignores the query string; `fetchWithAuth` unwraps `.data`.
 *   - GET /api/v1/horses/:id/competition-history → BARE object
 *     (horseOverviewController.mjs#getHorseCompetitionHistory).
 *   - GET /api/v1/users/:userId/competition-stats → BARE object
 *     (userController.mjs#getUserCompetitionStats). The mock user's id is the
 *     UUID string 'user-123' → /api/v1/users/user-123/competition-stats.
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
 * Default user-level stats — the page always queries this endpoint (it drives
 * the stable-stats grid). Bare object, mirroring the real controller.
 */
const baseUserStats = {
  userId: USER_ID,
  totalCompetitions: 20,
  totalWins: 4,
  totalTop3: 9,
  winRate: 20,
  totalPrizeMoney: 1000,
  bestPlacement: 1,
  mostSuccessfulDiscipline: 'Racing',
  recentCompetitions: [],
};

/**
 * Build a horse-list envelope entry. Only the fields MyStablePage reads are
 * populated (id, name, breed, ageYears >= 21 to count as retired,
 * totalEarnings).
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
function historyWithWins(horseId: number, wins: number) {
  return {
    horseId,
    horseName: `Horse ${horseId}`,
    statistics: {
      totalCompetitions: 20,
      wins,
      top3Finishes: wins + 2,
      winRate: wins * 5,
      totalPrizeMoney: 1000,
      averagePlacement: 3.2,
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

async function gotoHallOfFame() {
  const user = (await import('@testing-library/user-event')).default;
  await user.setup().click(screen.getByRole('tab', { name: /hall of fame/i }));
}

describe('MyStablePage — Hall-of-Fame champion GoldBorderFrame (Equoria-8did5)', () => {
  beforeEach(() => {
    // The stable-stats query always fires; default it so unrelated tabs render.
    server.use(http.get(STATS_PATH, () => HttpResponse.json(baseUserStats)));
  });

  it('renders the GoldBorderFrame around a retired horse with >=1 real career win', async () => {
    stubHorses([
      horse({ id: 101, name: 'Champ', ageYears: 25, totalEarnings: 8000, breed: 'Thoroughbred' }),
    ]);
    // Real backend signal: this horse actually won 3 competitions.
    server.use(http.get(HISTORY_PATH, () => HttpResponse.json(historyWithWins(101, 3))));

    renderWithProviders();
    await gotoHallOfFame();

    const entry = await screen.findByTestId('hof-entry-101');
    expect(entry).toBeInTheDocument();
    // The champion frame wrapper must be present (renders once the history
    // query resolves with wins > 0).
    const frameWrapper = await screen.findByTestId('hof-champion-frame-101');
    expect(frameWrapper).toBeInTheDocument();
    // ...and it must actually contain the card (frame applied, not just imported)
    expect(within(frameWrapper).getByTestId('hof-entry-101')).toBeInTheDocument();
    // ...and the GoldBorderFrame's 4 decorative corners are rendered.
    // NOTE: query by the corner-specific .gold-corner-animate class, NOT a
    // broad [aria-hidden="true"] selector. The card wrapped by the frame has
    // its own legitimately aria-hidden decorative icon (the horse emoji span
    // in MyStablePage's HOF card), so a broad aria-hidden count is 5, not 4.
    // The frame itself still renders exactly 4 corners — asserting on the
    // corner class proves the frame markup without coupling to the card's
    // internal a11y decorations.
    const corners = frameWrapper.querySelectorAll('.gold-corner-animate');
    expect(corners).toHaveLength(4);
  });

  it('does NOT render the GoldBorderFrame for a retired horse with 0 career wins', async () => {
    stubHorses([
      horse({ id: 202, name: 'NoWins', ageYears: 24, totalEarnings: 100, breed: 'Arabian' }),
    ]);
    // Real backend signal: zero wins → not a champion.
    server.use(http.get(HISTORY_PATH, () => HttpResponse.json(historyWithWins(202, 0))));

    renderWithProviders();
    await gotoHallOfFame();

    // The hall-of-fame card still renders (horse is still in the hall)...
    const entry = await screen.findByTestId('hof-entry-202');
    expect(entry).toBeInTheDocument();
    // ...but the champion frame wrapper is absent (no real wins).
    expect(screen.queryByTestId('hof-champion-frame-202')).not.toBeInTheDocument();
  });

  it('frames only the champion when mixed retired horses are present', async () => {
    stubHorses([
      horse({ id: 301, name: 'Winner', ageYears: 25, totalEarnings: 9000, breed: 'Thoroughbred' }),
      horse({ id: 302, name: 'Loser', ageYears: 25, totalEarnings: 50, breed: 'Pony' }),
    ]);
    server.use(
      http.get(HISTORY_PATH, ({ params }) => {
        const id = Number(params.id);
        return HttpResponse.json(historyWithWins(id, id === 301 ? 5 : 0));
      })
    );

    renderWithProviders();
    await gotoHallOfFame();

    await screen.findByTestId('hof-entry-301');
    await screen.findByTestId('hof-entry-302');
    expect(await screen.findByTestId('hof-champion-frame-301')).toBeInTheDocument();
    expect(screen.queryByTestId('hof-champion-frame-302')).not.toBeInTheDocument();
  });
});
