/**
 * BreedingPairSelection — no invented fee; the mare's cooldown and pregnancy
 * come from the server (Equoria-q4uem.9, Equoria-8doyo).
 *
 * Owner rulings (Stacey): a stud fee is set by the stallion's owner and never
 * derived by the game (2026-10-02); it is charged only when a mare is bred to
 * ANOTHER player's stallion, and breeding your own pair is free (2026-10-12);
 * the stud fee is the only fee and the cooldown is a mare's, 7 days
 * (2026-10-16). This page breeds the player's own pair.
 *
 * Defects this pins:
 *   - the page showed a stud fee of 500 x sire level plus a flat 200
 *     "breeding fee" (5,000 + 200 = 5,200 coins for a level-10 stallion);
 *   - the GET /horses list sends breedingCooldownEndsAt and inFoal, but the
 *     breeding normalizer dropped them, so a mare on cooldown or in foal was
 *     offered as breedable.
 *
 * MSW at the network boundary; the real page, normalizer, selectors and
 * confirmation dialog.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';
import type { HorseSummary } from '@/lib/api/types';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});

const STATS: HorseSummary['stats'] = {
  precision: 50,
  strength: 50,
  speed: 50,
  agility: 50,
  endurance: 50,
  intelligence: 50,
  stamina: 50,
  balance: 50,
  boldness: 50,
  flexibility: 50,
  obedience: 50,
  focus: 50,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function listHorse(overrides: Partial<HorseSummary>): HorseSummary {
  return {
    id: 0,
    name: '',
    breed: { id: 1, name: 'Thoroughbred' },
    age: 6,
    ageYears: 6,
    gender: '',
    sex: 'Mare',
    dateOfBirth: '2019-01-01',
    healthStatus: 'Excellent',
    stats: STATS,
    disciplineScores: {},
    breedingCooldownEndsAt: null,
    inFoal: false,
    ...overrides,
  };
}

/** GET /api/v1/horses as horseRoutes.mjs emits it, breeding-state fields included. */
const rawList: HorseSummary[] = [
  // level is not sent by the list today; a level here must not price anything.
  listHorse({ id: 21, name: 'TestFixture-Comet', sex: 'Stallion', level: 10 }),
  listHorse({ id: 22, name: 'TestFixture-Willow' }),
  listHorse({
    id: 23,
    name: 'TestFixture-Resting',
    breedingCooldownEndsAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
  }),
  listHorse({
    id: 24,
    name: 'TestFixture-InFoal',
    inFoal: true,
    breedingCooldownEndsAt: new Date(Date.now() + 5 * DAY_MS).toISOString(),
  }),
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <RewardToastProvider>
          <MemoryRouter>
            <BreedingPairSelection userId="test-user-q4uem9" />
          </MemoryRouter>
        </RewardToastProvider>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('BreedingPairSelection — own pair is free; mare cooldown from the server (Equoria-q4uem.9)', () => {
  beforeEach(() => {
    server.use(
      http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: rawList }))
    );
  });

  it('shows no invented stud fee, breeding fee or total — an own pair is free', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() =>
      expect(screen.getByLabelText('Select TestFixture-Comet')).toBeInTheDocument()
    );
    await user.click(screen.getByLabelText('Select TestFixture-Comet'));
    await user.click(screen.getByLabelText('Select TestFixture-Willow'));

    expect(
      screen.getByText('None. Both horses are yours, and breeding your own pair is free.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Breeding Fee')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/5,000 coins/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/200 coins/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/5,200 coins/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Initiate Breeding' }));
    const dialog = await screen.findByTestId('breeding-confirmation-modal');
    expect(
      within(dialog).getByText('Both horses are yours, and breeding your own pair is free.')
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/deducted from your account/i)).not.toBeInTheDocument();
    // The cooldown is the mare's alone, never 30 days on both parents.
    expect(within(dialog).queryByText(/30-Day Breeding Cooldown/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Both parents/i)).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/TestFixture-Willow rests from breeding for one game year/)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/TestFixture-Comet has no cooldown/)).toBeInTheDocument();
  });

  it('a mare whose server cooldown has not ended cannot be chosen', async () => {
    renderPage();

    const resting = await screen.findByLabelText('Select TestFixture-Resting');
    expect(resting).toBeDisabled();
    expect(within(resting).getByText(/Cooldown \(\d+d remaining\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('Select TestFixture-Willow')).toBeEnabled();
  });

  it('a mare the server reports in foal cannot be chosen', async () => {
    renderPage();

    const inFoal = await screen.findByLabelText('Select TestFixture-InFoal');
    expect(inFoal).toBeDisabled();
    expect(within(inFoal).getByText('In foal')).toBeInTheDocument();
  });
});
