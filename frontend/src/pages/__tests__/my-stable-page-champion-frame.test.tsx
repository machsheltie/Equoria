/**
 * MyStablePage — Hall-of-Fame champion GoldBorderFrame wiring (Equoria-8did5)
 *
 * Spec 11.3.13 + 11.5 Phase 3: GoldBorderFrame is the ornate gold-border
 * wrapper for featured/premium/championship content. It was orphaned (only
 * referenced by its own test). This test proves it is now wired to a REAL
 * backend-derived condition on the Hall of Fame surface:
 *
 *   - A retired horse with >=1 real competition win (career.wins, derived from
 *     useHorseCompetitionHistory → history.statistics.wins) IS a champion and
 *     the GoldBorderFrame renders around its card.
 *   - A retired horse with 0 wins is in the hall but does NOT get the frame.
 *
 * The win count is real backend data, not a hardcoded "featured" flag (21R).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyStablePage from '../MyStablePage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', username: 'tester' },
    isAuthenticated: true,
    isLoading: false,
    isEmailVerified: true,
    error: null,
    logout: vi.fn(),
    isLoggingOut: false,
    refetchProfile: vi.fn(),
    userRole: 'user',
    hasRole: () => false,
    hasAnyRole: () => false,
    isAdmin: false,
    isModerator: false,
  }),
}));

vi.mock('@/hooks/useAuth', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useAuth')>('@/hooks/useAuth');
  return {
    ...actual,
    useUpdateProfile: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const mockUseHorses = vi.fn();
vi.mock('@/hooks/api/useHorses', () => ({
  useHorses: () => mockUseHorses(),
}));

const mockUseUserCompetitionStats = vi.fn();
vi.mock('@/hooks/api/useUserCompetitionStats', () => ({
  useUserCompetitionStats: (...args: unknown[]) => mockUseUserCompetitionStats(...args),
  userCompetitionStatsQueryKeys: { all: ['user-competition-stats'] },
}));

const mockFetchHorseHistory = vi.fn();
vi.mock('@/lib/api/competitionResults', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/competitionResults')>(
    '@/lib/api/competitionResults'
  );
  return {
    ...actual,
    fetchHorseCompetitionHistory: (...args: unknown[]) => mockFetchHorseHistory(...args),
  };
});

function renderWithProviders() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/my-stable']}>
        <MyStablePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

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

const baseUserStats = {
  data: {
    userId: 'user-123',
    totalCompetitions: 20,
    totalWins: 4,
    totalTop3: 9,
    winRate: 20,
    totalPrizeMoney: 1000,
    totalXpGained: 0,
    bestPlacement: 1,
    mostSuccessfulDiscipline: 'Racing',
    recentCompetitions: [],
  },
  isLoading: false,
};

async function gotoHallOfFame() {
  const user = (await import('@testing-library/user-event')).default;
  await user.setup().click(screen.getByRole('tab', { name: /hall of fame/i }));
}

describe('MyStablePage — Hall-of-Fame champion GoldBorderFrame (Equoria-8did5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserCompetitionStats.mockReturnValue(baseUserStats);
  });

  it('renders the GoldBorderFrame around a retired horse with >=1 real career win', async () => {
    mockUseHorses.mockReturnValue({
      data: [{ id: 101, name: 'Champ', ageYears: 25, totalEarnings: 8000, breed: 'Thoroughbred' }],
      isLoading: false,
    });
    // Real backend signal: this horse actually won 3 competitions.
    mockFetchHorseHistory.mockResolvedValue(historyWithWins(101, 3));

    renderWithProviders();
    await gotoHallOfFame();

    const entry = await screen.findByTestId('hof-entry-101');
    expect(entry).toBeInTheDocument();
    // The champion frame wrapper must be present...
    const frameWrapper = screen.getByTestId('hof-champion-frame-101');
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
    mockUseHorses.mockReturnValue({
      data: [{ id: 202, name: 'NoWins', ageYears: 24, totalEarnings: 100, breed: 'Arabian' }],
      isLoading: false,
    });
    // Real backend signal: zero wins → not a champion.
    mockFetchHorseHistory.mockResolvedValue(historyWithWins(202, 0));

    renderWithProviders();
    await gotoHallOfFame();

    // The hall-of-fame card still renders (horse is still in the hall)...
    const entry = await screen.findByTestId('hof-entry-202');
    expect(entry).toBeInTheDocument();
    // ...but the champion frame wrapper is absent (no real wins).
    expect(screen.queryByTestId('hof-champion-frame-202')).not.toBeInTheDocument();
  });

  it('frames only the champion when mixed retired horses are present', async () => {
    mockUseHorses.mockReturnValue({
      data: [
        { id: 301, name: 'Winner', ageYears: 25, totalEarnings: 9000, breed: 'Thoroughbred' },
        { id: 302, name: 'Loser', ageYears: 25, totalEarnings: 50, breed: 'Pony' },
      ],
      isLoading: false,
    });
    mockFetchHorseHistory.mockImplementation((horseId: number) =>
      Promise.resolve(historyWithWins(horseId, horseId === 301 ? 5 : 0))
    );

    renderWithProviders();
    await gotoHallOfFame();

    await screen.findByTestId('hof-entry-301');
    await screen.findByTestId('hof-entry-302');
    expect(screen.getByTestId('hof-champion-frame-301')).toBeInTheDocument();
    expect(screen.queryByTestId('hof-champion-frame-302')).not.toBeInTheDocument();
  });
});
