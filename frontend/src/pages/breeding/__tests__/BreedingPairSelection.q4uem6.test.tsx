/**
 * BreedingPairSelection — one canonical shape in the shared ['horses'] cache
 * (Equoria-q4uem.6)
 *
 * The page reads the horse list under horseQueryKeys.all (['horses']), the
 * same key useHorses() caches the raw GET /api/v1/horses DTO (HorseSummary[])
 * under. The page used to store its own projected objects in that entry from
 * its queryFn, so whichever reader filled the entry first decided the shape
 * the other one got back while it was fresh:
 *   - a raw list already cached by another screen reached the breeding
 *     selectors without `breedName` ("Unknown Breed") and without the
 *     ageYears projection, and with horses of unrecognised sex included;
 *   - after this page fetched, every other reader of ['horses'] received
 *     breeding projections (no `breed`, `ageYears`, `stats`, ...).
 * The fix keeps the raw DTO in the cache and derives the breeding view with
 * `select: toBreedingHorses`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';
import { horseQueryKeys } from '@/hooks/api/useHorses';
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

/** Raw list DTOs, shaped like backend/modules/horses/routes/horseRoutes.mjs GET /. */
const rawList: HorseSummary[] = [
  {
    id: 11,
    name: 'TestFixture-Comet',
    breed: { id: 1, name: 'Thoroughbred' },
    age: 9,
    ageYears: 6,
    gender: '',
    sex: 'Stallion',
    dateOfBirth: '2019-01-01',
    healthStatus: 'Excellent',
    stats: STATS,
    disciplineScores: {},
  },
  {
    id: 12,
    name: 'TestFixture-Willow',
    breed: { id: 2, name: 'Arabian' },
    age: 8,
    ageYears: 5,
    gender: '',
    sex: 'Mare',
    dateOfBirth: '2020-01-01',
    healthStatus: 'Excellent',
    stats: STATS,
    disciplineScores: {},
  },
];

describe('BreedingPairSelection shared horse-list cache (Equoria-q4uem.6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(
      http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: rawList }))
    );
  });

  const renderPage = () =>
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

  it('derives breed name and game-year age from a raw list another screen already cached', async () => {
    // As useHorses() leaves it after the stable screen loaded (fresh).
    queryClient.setQueryData(horseQueryKeys.all, rawList);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TestFixture-Willow')).toBeInTheDocument();
    });
    expect(screen.getByText('Thoroughbred • 6 years old')).toBeInTheDocument();
    expect(screen.getByText('Arabian • 5 years old')).toBeInTheDocument();
  });

  it('leaves the raw list DTO in the shared cache for every other reader', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('TestFixture-Willow')).toBeInTheDocument();
    });
    expect(queryClient.getQueryData(horseQueryKeys.all)).toEqual(rawList);
  });
});
