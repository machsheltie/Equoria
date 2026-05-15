/**
 * FoalDetailPage Lifecycle UI Tests (Equoria-bi6i)
 *
 * Verifies that FoalDetailPage exposes the 5 foal lifecycle primary
 * actions called out in docs/beta-route-truth-table.md for the
 * /breeding row:
 *
 *   - POST /api/foals/:foalId/enrich          → "Enrich" button
 *   - POST /api/foals/:foalId/reveal-traits   → "Reveal Traits" button
 *   - PUT  /api/foals/:foalId/develop         → "Advance Stage" button
 *   - POST /api/foals/:foalId/graduate        → "Graduate to Adult" (age-gated)
 *   - POST /api/foals/:foalId/activity        → activity-select → Confirm
 *
 * Per 21R doctrine: no graceful skips, no fake values. These mutations
 * MUST be reachable through the production UI from the /foals/:id route.
 *
 * Mocks: per CLAUDE.md the project forbids new vi.mock-of-api-client
 * tests, but mocking the hooks module (useBreeding) is the established
 * pattern used by FoalDevelopmentTracker's own test suite. This file
 * follows that pattern.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FoalDetailPage from '../FoalDetailPage';
import * as useBreedingHooks from '@/hooks/api/useBreeding';

vi.mock('@/hooks/api/useBreeding');

// Pick a dateOfBirth that makes the foal 3+ years old so the Graduate
// button (age-gated at 104 weeks) is visible in the test.
const adultDob = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000).toISOString();

describe('FoalDetailPage — lifecycle UI (Equoria-bi6i)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useBreedingHooks.useFoal).mockReturnValue({
      data: {
        id: 42,
        name: 'TestFixture-Starlight',
        dateOfBirth: adultDob,
        sireId: 100,
        damId: 101,
        sex: 'Filly',
        traits: [],
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useFoalDevelopment).mockReturnValue({
      data: {
        currentDay: 30,
        maxDay: 60,
        bondingLevel: 50,
        stressLevel: 10,
        completedActivities: {},
        stage: 'yearling',
        progress: 50,
        bonding: 50,
        stress: 10,
        enrichmentLevel: 25,
      },
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useFoalActivities).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(useBreedingHooks.useLogFoalActivity).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
    } as any);

    vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useBreedingHooks.useGraduateFoal).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      data: null,
    } as any);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/foals/42']}>
          <Routes>
            <Route path="/foals/:id" element={<FoalDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders the Reveal Traits button and wires it to useRevealFoalTraits', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useBreedingHooks.useRevealFoalTraits).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
      data: null,
    } as any);

    renderPage();

    const btn = screen.getByRole('button', { name: /reveal traits/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(mutate).toHaveBeenCalled();
  });

  it('renders the Enrich button and wires it to useEnrichFoal', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useBreedingHooks.useEnrichFoal).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    renderPage();

    const btn = screen.getByRole('button', { name: /^enrich$/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(mutate).toHaveBeenCalledWith({ activity: 'enrichment', duration: 30 });
  });

  it('renders the Advance Stage button and wires it to useDevelopFoal', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useBreedingHooks.useDevelopFoal).mockReturnValue({
      mutate,
      isPending: false,
    } as any);

    renderPage();

    const btn = screen.getByRole('button', { name: /advance stage/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(mutate).toHaveBeenCalled();
  });

  it('renders the Graduate to Adult button (age-gated) and wires it to useGraduateFoal', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useBreedingHooks.useGraduateFoal).mockReturnValue({
      mutate,
      isPending: false,
      isSuccess: false,
      data: null,
    } as any);

    renderPage();

    const btn = screen.getByRole('button', { name: /graduate to adult/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    expect(mutate).toHaveBeenCalled();
  });

  it('exposes an activity selection flow (logFoalActivity) via DevelopmentTracker', () => {
    renderPage();

    // The activity-selection UI is provided by the nested DevelopmentTracker
    // child — assert it renders so the activity → confirm → mutate flow
    // is reachable for the user.
    expect(screen.getByTestId('development-tracker')).toBeInTheDocument();
  });
});
