/**
 * BreedingPairSelection — honest compatibility states (Equoria-m54lr)
 *
 * Page-level sentinel suite for the fabricated-compatibility defect: the page
 * used to read fields that do not exist on the breeding-compatibility response
 * (resp.overallScore || 75, resp.temperamentCompatibility || 80, …) behind an
 * `as unknown as` cast, so hardcoded 75/80/70/75 scores plus canned
 * recommendation strings rendered on EVERY pair before the player committed
 * coins.
 *
 * Doctrine: .claude/rules/FRONTEND_ASYNC_STATE_DOCTRINE.md §1 (four-state) +
 * §4 (honest values — no plausible-literal fallbacks; a real 0 renders as 0).
 *
 * MSW at the fetch boundary (same seam as the sibling story-6-1 suite — no
 * api-client module mocks). The breeding flow's real-backend coverage is the
 * Playwright E2E follow-up; this hermetic suite pins the per-state rendering
 * an E2E run is too coarse to assert cheaply.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// The canned recommendation strings the old code fabricated — these must
// never render again, from any state.
const CANNED_RECOMMENDATIONS = [
  'Compatible temperaments for stable offspring',
  'Good genetic diversity reduces inbreeding risk',
  'Strong trait synergy for athletic abilities',
];

const mockHorses = [
  {
    id: 1,
    name: 'Thunder',
    age: 5,
    ageYears: 5,
    sex: 'Stallion',
    breed: 'Thoroughbred',
    breedName: 'Thoroughbred',
    healthStatus: 'Healthy',
    dateOfBirth: '2019-01-01',
    level: 10,
    stats: { speed: 85, stamina: 80, agility: 75, strength: 78, intelligence: 70, health: 90 },
    disciplineScores: {},
    traits: [],
  },
  {
    id: 2,
    name: 'Lightning',
    age: 4,
    ageYears: 4,
    sex: 'Mare',
    breed: 'Arabian',
    breedName: 'Arabian',
    healthStatus: 'Healthy',
    dateOfBirth: '2020-01-01',
    level: 8,
    stats: { speed: 80, stamina: 85, agility: 82, strength: 70, intelligence: 75, health: 88 },
    disciplineScores: {},
    traits: [],
  },
];

// REAL assessBreedingPairCompatibility shape with distinctive values,
// including a REAL zero (geneticCompatibility) that the old `||` fallbacks
// would have eaten.
const realCompatibility = {
  overallScore: 42,
  geneticCompatibility: 0,
  diversityImpact: 55,
  inbreedingRisk: 0.125,
  expectedTraits: {
    expectedStats: { speed: 60, stamina: 62, agility: 58, intelligence: 55 },
    likelyTraits: [],
    diversityPotential: 'medium',
  },
  recommendation: 'fair',
};

describe('BreedingPairSelection — honest compatibility states (Equoria-m54lr)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: mockHorses })
      )
    );
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <RewardToastProvider>
            <MemoryRouter>
              <BreedingPairSelection userId="test-user-123" />
            </MemoryRouter>
          </RewardToastProvider>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  /** Select the pair and open the confirmation modal. */
  const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() => {
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText('Select Thunder'));
    await user.click(screen.getByLabelText('Select Lightning'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initiate Breeding/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
    });
  };

  it('renders an honest loading state while the analysis is pending — never fabricated scores', async () => {
    const user = userEvent.setup();
    // Never-resolving compatibility keeps the query pending.
    server.use(
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () => new Promise(() => {}))
    );

    renderComponent();
    await openModal(user);

    // Loading state announces itself; no score of any kind renders.
    const modal = screen.getByTestId('breeding-confirmation-modal');
    expect(within(modal).getByLabelText('Analyzing compatibility')).toBeInTheDocument();
    expect(within(modal).queryByText(/\/100/)).not.toBeInTheDocument();
    for (const canned of CANNED_RECOMMENDATIONS) {
      expect(screen.queryByText(canned)).not.toBeInTheDocument();
    }
  });

  it('renders the REAL endpoint values verbatim — including a real 0', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({ success: true, data: realCompatibility })
      )
    );

    renderComponent();
    await openModal(user);

    const modal = screen.getByTestId('breeding-confirmation-modal');
    await waitFor(() => {
      expect(within(modal).getByText('42/100')).toBeInTheDocument();
    });
    // A real 0 renders as 0 — the `|| 75` class of fallback would have eaten it.
    expect(within(modal).getByText('0')).toBeInTheDocument();
    expect(within(modal).getByText('55')).toBeInTheDocument();
    expect(within(modal).getByText('12.5%')).toBeInTheDocument();
    expect(within(modal).getByText('fair')).toBeInTheDocument();

    // Sentinel: none of the historical fabrications render.
    expect(screen.queryByText('75/100')).not.toBeInTheDocument();
    for (const canned of CANNED_RECOMMENDATIONS) {
      expect(screen.queryByText(canned)).not.toBeInTheDocument();
    }
  });

  it('renders an honest error state with a WIRED retry — and recovers to real data', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({ success: false, error: 'boom' }, { status: 500 })
      )
    );

    renderComponent();
    await openModal(user);

    const modal = screen.getByTestId('breeding-confirmation-modal');
    await waitFor(() => {
      expect(within(modal).getByText('Compatibility analysis unavailable')).toBeInTheDocument();
    });
    // Error must NOT fall through to fabricated scores or canned strings.
    expect(within(modal).queryByText(/\/100/)).not.toBeInTheDocument();
    for (const canned of CANNED_RECOMMENDATIONS) {
      expect(screen.queryByText(canned)).not.toBeInTheDocument();
    }

    // Retry is refetch, wired for real: once the endpoint recovers, clicking
    // Try Again replaces the error state with the real values.
    server.use(
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({ success: true, data: realCompatibility })
      )
    );
    await user.click(within(modal).getByRole('button', { name: /Try Again/i }));

    await waitFor(() => {
      expect(within(modal).getByText('42/100')).toBeInTheDocument();
    });
    expect(within(modal).queryByText('Compatibility analysis unavailable')).not.toBeInTheDocument();
  });
});
