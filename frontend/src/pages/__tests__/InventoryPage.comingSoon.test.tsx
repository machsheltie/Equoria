/**
 * InventoryPage: tack that does not score yet reads "Coming soon" and shows no
 * effect text; a saddle shows what it scores (owner ruling 2026-10-23,
 * Equoria-cv3if). Real hooks over the MSW network boundary, as in
 * InventoryPage.test.tsx.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

/**
 * Stub the inventory network boundary. Mirrors the real controller envelope:
 * `{ success, message, data: { items, total } }`. `apiClient.get` unwraps
 * `.data`, so `useInventory` receives `{ items, total }`.
 */
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

/**
 * Stub the feed-catalog boundary. Mirrors the real controller envelope:
 * `{ success, message, data: FEED_CATALOG }` where FEED_CATALOG is a BARE
 * array. `apiClient.get` unwraps `.data`, so the hook's query gets `FeedItem[]`.
 */
function stubFeedCatalog(catalog: FeedItem[]) {
  server.use(
    http.get(feedCatalogPath, () =>
      HttpResponse.json({
        success: true,
        message: 'Feed catalog retrieved successfully',
        data: catalog,
      })
    )
  );
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Default: empty inventory + empty feed catalog. Individual tests override
  // by calling stubInventory(...) / stubFeedCatalog(...) again (last-registered
  // handler wins in MSW). Both endpoints MUST be stubbed because the global
  // setup runs with onUnhandledRequest: 'error'.
  stubInventory([]);
  stubFeedCatalog([]);
});

describe('InventoryPage Coming soon (Equoria-cv3if)', () => {
  it('shows Coming soon for non-scoring tack and the label for a saddle', async () => {
    stubInventory([
      {
        id: 'inv-halter',
        itemId: 'show-halter',
        category: 'halter',
        name: 'Show Halter',
        comingSoon: true,
        quantity: 1,
        equippedToHorseId: null,
        equippedToHorseName: null,
      },
      {
        id: 'inv-saddle',
        itemId: 'dressage-saddle',
        category: 'saddle',
        name: 'Dressage Saddle',
        bonus: '+5 in Dressage shows',
        quantity: 1,
        equippedToHorseId: null,
        equippedToHorseName: null,
      },
    ]);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InventoryPage />
      </Wrapper>
    );

    const halter = await screen.findByTestId('inventory-item-inv-halter');
    expect(within(halter).getByText('Coming soon')).toBeInTheDocument();
    expect(halter.textContent ?? '').not.toMatch(/\+\d/);

    const saddle = await screen.findByTestId('inventory-item-inv-saddle');
    expect(within(saddle).getByText('+5 in Dressage shows')).toBeInTheDocument();
    expect(within(saddle).queryByText('Coming soon')).not.toBeInTheDocument();
  });
});
