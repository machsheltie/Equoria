/**
 * BreedingPairSelection — offline ends in an honest error (Equoria-3jnsz)
 *
 * Owner ruling 2026-10-23 (Equoria-m00gp / Equoria-3jnsz, option a): when the
 * breeding compatibility screen's data cannot load because the network is gone,
 * the player sees an error with Try again — never loading that never resolves,
 * and never an empty horse list. TanStack's default networkMode 'online' PAUSES
 * an offline query instead (no data, no error): the confirmation summary sat on
 * "Analyzing compatibility" forever and the horse list fell through to empty
 * selectors.
 *
 * Real hooks, real React Query, real api clients; only the HTTP transport is
 * stubbed by MSW (same seam as the sibling m54lr suite). onlineManager is the
 * real TanStack online signal the browser's offline event drives.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '../../../test/msw/server';
import { MockAuthProvider } from '../../../test/utils';
import BreedingPairSelection from '../BreedingPairSelection';
import { RewardToastProvider } from '@/components/feedback';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = (id: number, name: string, sex: 'Stallion' | 'Mare') => ({
  id,
  name,
  age: 5,
  ageYears: 5,
  sex,
  breed: 'Thoroughbred',
  breedName: 'Thoroughbred',
  healthStatus: 'Healthy',
  dateOfBirth: '2019-01-01',
  level: 10,
  stats: { speed: 80, stamina: 80, agility: 80, strength: 80, intelligence: 80, health: 80 },
  disciplineScores: {},
  traits: [],
});

const mockHorses = [horse(1, 'Thunder', 'Stallion'), horse(2, 'Lightning', 'Mare')];

const offline = () => HttpResponse.error();

describe('BreedingPairSelection — offline shows an honest error (Equoria-3jnsz)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
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

  it('an offline horse-list read ends in the error with Try again, not empty selectors', async () => {
    server.use(http.get(`${base}/api/v1/horses`, offline));
    onlineManager.setOnline(false);

    renderComponent();

    expect(await screen.findByText('Failed to load horses')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Sire (Stallion)')).not.toBeInTheDocument();

    // Back online, Try again re-reads the list and the horses appear.
    onlineManager.setOnline(true);
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: mockHorses })
      )
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Thunder')).toBeInTheDocument();
  });

  it('offline compatibility reads end in errors with Try again, never endless analysis', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({ success: true, data: mockHorses })
      ),
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, offline),
      http.post(`${base}/api/v1/breeding/genetic-probability`, offline),
      http.post(`${base}/api/v1/genetics/inbreeding-analysis`, offline),
      http.get(`${base}/api/v1/breeding/lineage-analysis/:stallionId/:mareId`, offline),
      http.post(`${base}/api/v1/horses/breeding/color-prediction`, offline)
    );
    const user = userEvent.setup();
    renderComponent();
    expect(await screen.findByText('Thunder')).toBeInTheDocument();

    // The network drops before the player picks the pair.
    onlineManager.setOnline(false);
    await user.click(screen.getByLabelText('Select Thunder'));
    await user.click(screen.getByLabelText('Select Lightning'));

    // The compatibility preview reports the failure with a retry.
    const preview = screen.getByTestId('compatibility-preview');
    expect(await within(preview).findByText('Compatibility unavailable')).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // The confirmation summary ends in its error with Try again.
    await user.click(screen.getByRole('button', { name: /Initiate Breeding/i }));
    const modal = await screen.findByTestId('breeding-confirmation-modal');
    expect(
      await within(modal).findByText('Compatibility analysis unavailable')
    ).toBeInTheDocument();
    expect(within(modal).queryByLabelText('Analyzing compatibility')).not.toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Back online, Try again re-runs the analysis and the real score arrives.
    onlineManager.setOnline(true);
    server.use(
      http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
        HttpResponse.json({
          success: true,
          data: {
            overallScore: 61,
            geneticCompatibility: 70,
            diversityImpact: 40,
            inbreedingRisk: 0.05,
            expectedTraits: {
              expectedStats: { speed: 60, stamina: 60, agility: 60, intelligence: 60 },
              likelyTraits: [],
              diversityPotential: 'medium',
            },
            recommendation: 'good',
          },
        })
      )
    );
    await user.click(within(modal).getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(within(modal).getByText('61/100')).toBeInTheDocument());
  });
});
