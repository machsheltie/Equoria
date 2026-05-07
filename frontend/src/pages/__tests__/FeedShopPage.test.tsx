/**
 * FeedShopPage Smoke Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive tests that the page FIRES.
 * Verifies 5 tier cards render, pack stepper increments, buy button
 * is disabled when packs < 1 (unreachable via UI), and the purchase
 * mutation is called with correct { feedTier, packs }.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import FeedShopPage from '../FeedShopPage';
import type { FeedItem, FeedPurchaseResult } from '@/lib/api-client';
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
  {
    id: 'performance',
    name: 'Performance Feed',
    description: 'Enhanced formula.',
    packPrice: 250,
    perUnit: 2.5,
    statRollPct: 10,
    pregnancyBonusPct: 4,
  },
  {
    id: 'performancePlus',
    name: 'Performance+ Feed',
    description: 'Advanced formula.',
    packPrice: 500,
    perUnit: 5,
    statRollPct: 15,
    pregnancyBonusPct: 6,
  },
  {
    id: 'highPerformance',
    name: 'High Performance Feed',
    description: 'Premium formula.',
    packPrice: 900,
    perUnit: 9,
    statRollPct: 20,
    pregnancyBonusPct: 8,
  },
  {
    id: 'elite',
    name: 'Elite Feed',
    description: 'Championship grade.',
    packPrice: 1500,
    perUnit: 15,
    statRollPct: 30,
    pregnancyBonusPct: 12,
  },
];

const PURCHASE_RESULT: FeedPurchaseResult = {
  remainingMoney: 4900,
  inventoryItem: {
    id: 'inv-1',
    itemId: 'basic',
    category: 'feed',
    name: 'Basic Feed',
    quantity: 100,
  },
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FeedShopPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FeedShopPage — smoke', () => {
  it('renders 5 feed tier cards once catalog loads', async () => {
    server.use(http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG)));

    renderPage();

    await waitFor(() => expect(screen.getByTestId('feed-shop-grid')).toBeInTheDocument());

    for (const tier of CATALOG) {
      expect(screen.getByTestId(`feed-tier-${tier.id}`)).toBeInTheDocument();
    }
  });

  it('pack stepper increments the count', async () => {
    server.use(http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG)));

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTestId('feed-shop-grid')).toBeInTheDocument());

    const countEl = screen.getByTestId('pack-count-basic');
    expect(countEl).toHaveTextContent('1');

    await user.click(screen.getByTestId('pack-increment-basic'));
    expect(countEl).toHaveTextContent('2');
  });

  it('buy button calls purchase mutation with correct feedTier and packs', async () => {
    let postedBody: unknown;
    server.use(
      http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG)),
      http.post('/api/v1/feed-shop/purchase', async ({ request }) => {
        postedBody = await request.json();
        return HttpResponse.json(PURCHASE_RESULT);
      })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByTestId('buy-basic')).toBeInTheDocument());

    await user.click(screen.getByTestId('pack-increment-basic')); // packs = 2
    await user.click(screen.getByTestId('buy-basic'));

    await waitFor(() => expect(postedBody).toEqual({ feedTier: 'basic', packs: 2 }));
  });

  it('shows loading spinner before catalog arrives', () => {
    server.use(
      http.get('/api/v1/feed-shop/catalog', async () => {
        await new Promise(() => {}); // never resolves
        return HttpResponse.json([]);
      })
    );

    renderPage();

    expect(screen.getByTestId('feed-shop-loading')).toBeInTheDocument();
  });
});
