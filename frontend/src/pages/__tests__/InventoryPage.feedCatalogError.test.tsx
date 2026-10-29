/**
 * InventoryPage — feed catalog failure is visible, never silent (Equoria-gejdf)
 *
 * The page enriches feed cards with the feed catalog (stat-roll %, pregnancy %,
 * description). When that request failed, the enrichment vanished with no word
 * to the player. The fix shows a small inline notice with a Try Again button
 * on any grid that holds feed, and the feed card keeps its authored name
 * (never the raw tier key).
 *
 * Boundary-level, like InventoryPage.test.tsx: the REAL `useInventory` and
 * `useFeedCatalog` hooks over the real `apiClient`, with the network stubbed by
 * MSW. Wire shapes match the backend controllers (see that file's header).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import type { InventoryItem, FeedItem } from '@/lib/api-client';
import InventoryPage from '../InventoryPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const inventoryPath = `${base}/api/v1/inventory`;
const feedCatalogPath = `${base}/api/v1/feed-shop/catalog`;

const feedItem: InventoryItem = {
  id: 'inv-feed-1',
  itemId: 'performancePlus',
  category: 'feed',
  name: 'Performance Plus Feed',
  quantity: 40,
  equippedToHorseId: null,
  equippedToHorseName: null,
};

const tackItem: InventoryItem = {
  id: 'inv-tack-1',
  itemId: 'dressage-saddle',
  category: 'saddle',
  name: 'Dressage Saddle',
  quantity: 1,
  equippedToHorseId: null,
  equippedToHorseName: null,
};

const catalog: FeedItem[] = [
  {
    id: 'performancePlus',
    name: 'Performance Plus Feed',
    description: 'A richer mix for horses in steady work.',
    packPrice: 300,
    perUnit: 3,
    statRollPct: 15,
    pregnancyBonusPct: 5,
  },
];

function stubInventory(items: InventoryItem[]) {
  server.use(
    http.get(inventoryPath, () =>
      HttpResponse.json({
        success: true,
        message: 'Inventory retrieved successfully',
        data: { items, total: items.length },
      })
    )
  );
}

function stubCatalogFailure() {
  server.use(
    http.get(feedCatalogPath, () =>
      HttpResponse.json({ success: false, message: 'Server error' }, { status: 500 })
    )
  );
}

function stubCatalog(items: FeedItem[]) {
  server.use(
    http.get(feedCatalogPath, () =>
      HttpResponse.json({ success: true, message: 'Feed catalog retrieved', data: items })
    )
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <InventoryPage />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  stubInventory([]);
  stubCatalog([]);
});

describe('InventoryPage — feed catalog failure (Equoria-gejdf)', () => {
  it('shows an inline notice with Try Again, keeps the authored feed name, and recovers on retry', async () => {
    stubInventory([feedItem]);
    stubCatalogFailure();

    renderPage();

    const card = await screen.findByTestId('inventory-item-inv-feed-1');
    const notice = await screen.findByTestId('feed-details-error');
    expect(within(notice).getByRole('alert')).toHaveTextContent(
      "Feed details couldn't load right now."
    );

    // The card keeps its authored name; the raw tier key never shows.
    expect(within(card).getByText('Performance Plus Feed')).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('performancePlus');

    // Retry refetches the catalog; once it loads the notice goes and the
    // stat line appears.
    stubCatalog(catalog);
    fireEvent.click(within(notice).getByRole('button', { name: 'Try Again' }));

    // Re-query the card: the grid may re-render with a fresh node.
    await waitFor(() =>
      expect(
        within(screen.getByTestId('inventory-item-inv-feed-1')).getByText('15%')
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId('feed-details-error')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('inventory-item-inv-feed-1')).getByText('+5%')
    ).toBeInTheDocument();
  });

  it('shows no notice when the inventory holds no feed', async () => {
    stubInventory([tackItem]);
    stubCatalogFailure();

    renderPage();

    await screen.findByTestId('inventory-item-inv-tack-1');
    // Let the failed catalog request settle before asserting absence.
    await waitFor(() => expect(screen.getByTestId('item-count')).toHaveTextContent('1 items'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('feed-details-error')).not.toBeInTheDocument();
  });

  it('shows no notice when the catalog loads', async () => {
    stubInventory([feedItem]);
    stubCatalog(catalog);

    renderPage();

    const card = await screen.findByTestId('inventory-item-inv-feed-1');
    await waitFor(() => expect(within(card).getByText('15%')).toBeInTheDocument());
    expect(screen.queryByTestId('feed-details-error')).not.toBeInTheDocument();
  });
});
