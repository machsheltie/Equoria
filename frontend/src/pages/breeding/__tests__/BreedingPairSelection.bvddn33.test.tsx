/**
 * BreedingPairSelection — cache invalidation after a successful breed
 * (Equoria-bvddn.33)
 *
 * The page used to invalidate ['horses', userId] on breed success. No query
 * anywhere is cached under that key: the page's own horse-list query (and
 * every horse-mutation hook in the app) reads/writes ['horses'], and a
 * horse's own detail page reads ['horses', id]. So after breeding, the dam's
 * fresh pregnancy state never reached the cache the rest of the app reads —
 * the dam looked un-bred for up to the list's 30s staleTime, and her detail
 * page (if already cached) never refreshed at all.
 *
 * This suite seeds the real QueryClient the same way the rest of the app
 * would (the list query active via this page, a dam detail entry
 * pre-cached as if the player had already visited her page), drives a real
 * breed through MSW, and asserts the ACTUAL cache entries a fixed
 * implementation must touch: the shared ['horses'] list (refetched, since
 * it is active) and the dam's ['horses', damId] detail entry (marked
 * invalidated). Fails on pre-fix code because pre-fix invalidates a key
 * neither entry lives under.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';
import { horseQueryKeys } from '@/hooks/api/useHorses';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});

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

describe('BreedingPairSelection cache invalidation after breed (Equoria-bvddn.33)', () => {
  let queryClient: QueryClient;
  let horsesListFetchCount: number;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    horsesListFetchCount = 0;

    server.use(
      http.get(`${base}/api/v1/horses`, () => {
        horsesListFetchCount += 1;
        return HttpResponse.json({ success: true, data: mockHorses });
      }),
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({
          success: true,
          data: {
            overallScore: 80,
            geneticCompatibility: 80,
            diversityImpact: 70,
            inbreedingRisk: 0.02,
            expectedTraits: {
              expectedStats: { speed: 80, stamina: 80, agility: 80, intelligence: 70 },
              likelyTraits: [],
              diversityPotential: 'high',
            },
            recommendation: 'good',
          },
        })
      ),
      http.post(`${base}/api/v1/horses/foals`, () =>
        HttpResponse.json({
          success: true,
          message: 'Breeding successful! Your mare is now in foal.',
          data: {
            pregnancyStarted: true,
            damId: 2,
            sireId: 1,
            foalDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        })
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

  it('invalidates the shared horses list and the dam detail cache — not a key nothing reads', async () => {
    const user = userEvent.setup();

    // Simulate the dam's detail page already being cached, the way it would
    // be if the player had visited Lightning's page before breeding her.
    queryClient.setQueryData(horseQueryKeys.detail(2), {
      id: 2,
      name: 'Lightning',
      inFoalSinceDate: null,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });
    expect(horsesListFetchCount).toBe(1);

    await user.click(screen.getByLabelText('Select Thunder'));
    await user.click(screen.getByLabelText('Select Lightning'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initiate Breeding/i })).not.toBeDisabled();
    });
    await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Confirm Breeding' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Confirm Breeding/i }));

    await waitFor(() => {
      expect(screen.getByText(/Your mare is now in foal/i)).toBeInTheDocument();
    });

    // The page's own horse-list query is active (mounted) — a correct
    // invalidation of the SAME key it reads (['horses']) triggers an
    // automatic refetch. Pre-fix, the invalidated key ['horses', userId]
    // never matches this query, so no second fetch happens.
    await waitFor(() => {
      expect(horsesListFetchCount).toBe(2);
    });

    // The dam's pre-cached detail entry must be marked invalidated so her
    // next visit refetches instead of showing a stale pre-pregnancy horse.
    // Pre-fix, no invalidation ever targets ['horses', 2].
    const damDetailState = queryClient.getQueryState(horseQueryKeys.detail(2));
    expect(damDetailState?.isInvalidated).toBe(true);
  });
});
