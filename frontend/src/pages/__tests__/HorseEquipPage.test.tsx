/**
 * HorseEquipPage Smoke Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive tests that the page FIRES.
 * Verifies loading/error states, tack/feed sections, and that the
 * equipped-feed-card shows the unequip-feed-button.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import HorseEquipPage from '@/pages/horses/HorseEquipPage';
import type { EquippableResponse, FeedItem } from '@/lib/api-client';
import React from 'react';

const CATALOG: FeedItem[] = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description: 'Standard nutrition.',
    packPrice: 100,
    perUnit: 1,
    statRollPct: 5,
    pregnancyBonusPct: 2,
  },
];

const EQUIPPABLE_WITH_EQUIPPED_FEED: EquippableResponse = {
  tack: [],
  feed: [
    { feedType: 'basic', name: 'Basic Feed', quantity: 42, isCurrentlyEquippedToThisHorse: true },
  ],
};

const EQUIPPABLE_EMPTY: EquippableResponse = {
  tack: [],
  feed: [],
};

function renderAt(horseId: number, equippableData: EquippableResponse) {
  server.use(
    http.get(`/api/v1/horses/${horseId}/equippable`, () => HttpResponse.json(equippableData)),
    http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG))
  );

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/horses/${horseId}/equip`]}>
        <Routes>
          <Route path="/horses/:id/equip" element={<HorseEquipPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseEquipPage — loading state', () => {
  it('shows loading spinner while equippable data loads', () => {
    server.use(
      http.get('/api/v1/horses/5/equippable', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json(EQUIPPABLE_EMPTY);
      }),
      http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG))
    );

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/horses/5/equip']}>
          <Routes>
            <Route path="/horses/:id/equip" element={<HorseEquipPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('horse-equip-loading')).toBeInTheDocument();
  });
});

describe('HorseEquipPage — tack and feed sections', () => {
  it('renders tack and feed sections after load', async () => {
    renderAt(5, EQUIPPABLE_EMPTY);

    await waitFor(() => expect(screen.getByTestId('tack-section')).toBeInTheDocument());
    expect(screen.getByTestId('feed-section')).toBeInTheDocument();
  });

  it('shows tack empty-state when no tack available', async () => {
    renderAt(5, EQUIPPABLE_EMPTY);

    await waitFor(() => expect(screen.getByTestId('tack-empty-state')).toBeInTheDocument());
  });

  it('shows no-feed empty-state when feed array is empty', async () => {
    renderAt(5, EQUIPPABLE_EMPTY);

    await waitFor(() => expect(screen.getByTestId('no-feed-empty-state')).toBeInTheDocument());
  });
});

describe('HorseEquipPage — equipped feed card', () => {
  it('renders equipped-feed-card with unequip-feed-button when a feed tier is equipped', async () => {
    renderAt(5, EQUIPPABLE_WITH_EQUIPPED_FEED);

    await waitFor(() => expect(screen.getByTestId('equipped-feed-card')).toBeInTheDocument());
    expect(screen.getByTestId('unequip-feed-button')).toBeInTheDocument();
  });
});
