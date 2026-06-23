/**
 * InventoryPage tack subtitle + no-badge tests (Equoria-qyjc;
 * converted to MSW boundary under Equoria-fefh2.12)
 *
 * Boundary-level: the page renders against the REAL `useInventory` /
 * `useUnequipItem` (from `@/hooks/api/useInventory`) and the REAL
 * `useFeedCatalog` (from `@/hooks/api/useFeedShop`) hooks — real React Query +
 * real `inventoryApi` / `feedShopApi` over `apiClient` — with the network
 * boundary stubbed by MSW (`server.use(...)`). This is NOT a
 * `vi.mock('@/hooks/...')`. It exercises the real query keys (`['inventory']`,
 * `['feed-shop','catalog']`), the `{ success, data }` envelope unwrap done by
 * `apiClient.get`, and the `data?.items ?? []` / `data ?? []` defaulting in the
 * hooks end-to-end. Auth state comes from the REAL `AuthContext` via
 * `MockAuthProvider` (a real provider, not a module mock).
 *
 * Real wire shapes (verified from the backend controllers):
 *  - GET /api/v1/inventory      → { success, message, data: { items, total } }
 *    (backend/modules/economy/inventory/controllers/inventoryController.mjs
 *     getInventory: `data: { items: enriched, total: enriched.length }`)
 *  - GET /api/v1/feed-shop/catalog → { success, message, data: FEED_CATALOG }
 *    (backend/modules/economy/feedShop/controllers/feedShopController.mjs
 *     getFeedCatalog: `data: FEED_CATALOG` — a BARE array of FeedItem)
 *  `apiClient.get` unwraps `.data`, so `useInventory` gets `{ items, total }`
 *  and `useFeedCatalog`'s query gets the `FeedItem[]` array directly.
 *
 * Locks the All-Purpose-Tack AC: "Given inventory page, when user has
 * All Purpose Saddle qty 1, then subtitle '1 in inventory', no x1 badge."
 *
 * Specifically guards:
 *  - InventoryPage.tsx:113  subtitle text for tack vs feed
 *  - InventoryPage.tsx:116  meta=undefined for tack (no quantity badge)
 *
 * OPTIMAL_FIX_DISCIPLINE §2 sentinel: also asserts feed STILL renders
 * "N units in stock" so a refactor that flipped the conditional would
 * fail at least one case.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import type { InventoryItem, FeedItem } from '@/lib/api-client';
import InventoryPage from '../InventoryPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const INVENTORY_PATH = `${base}/api/v1/inventory`;
const FEED_CATALOG_PATH = `${base}/api/v1/feed-shop/catalog`;

/**
 * Stub the inventory network boundary. Mirrors the real controller envelope:
 * `{ success, message, data: { items, total } }`. `apiClient.get` unwraps
 * `.data`, so `useInventory` receives `{ items, total }`.
 */
function stubInventory(items: InventoryItem[]) {
  server.use(
    http.get(INVENTORY_PATH, () =>
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
    http.get(FEED_CATALOG_PATH, () =>
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

describe('InventoryPage — tack subtitle + no-badge (Equoria-qyjc)', () => {
  it('tack card shows "1 in inventory" subtitle and NO "x1" quantity badge', async () => {
    stubInventory([
      {
        id: 'inv-1',
        itemId: 'all-purpose-saddle',
        category: 'saddle',
        name: 'All Purpose Saddle',
        bonus: '+5% to all disciplines',
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

    // Boundary fetch resolves asynchronously — wait for the card to appear.
    const card = await screen.findByTestId('inventory-item-inv-1');
    expect(card).toBeInTheDocument();

    // Subtitle: "1 in inventory" — quantity in subtitle, NOT a badge.
    expect(within(card).getByText('1 in inventory')).toBeInTheDocument();

    // No "x N" badge anywhere on the tack card. Guards InventoryPage.tsx:116.
    // The regex catches both "x1", "x 1", "×1", "× 1" forms.
    const cardText = card.textContent ?? '';
    expect(cardText).not.toMatch(/[x×]\s*1\b/);

    // And no "units in stock" copy leaked from the feed branch.
    expect(within(card).queryByText(/units in stock/)).not.toBeInTheDocument();
  });

  it('tack card with quantity > 1 still uses "N in inventory" — no x-badge', async () => {
    // Sentinel against a regression that re-introduced the badge for
    // quantity > 1 only (cheap-fix that left the qty=1 case correct).
    stubInventory([
      {
        id: 'inv-2',
        itemId: 'dressage-saddle',
        category: 'saddle',
        name: 'Dressage Saddle',
        quantity: 3,
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

    const card = await screen.findByTestId('inventory-item-inv-2');
    expect(within(card).getByText('3 in inventory')).toBeInTheDocument();
    expect(card.textContent ?? '').not.toMatch(/[x×]\s*3\b/);
  });

  it('feed card still renders "N units in stock" subtitle (regression guard)', async () => {
    stubInventory([
      {
        id: 'inv-feed-1',
        itemId: 'basic',
        category: 'feed',
        name: 'Basic Feed',
        quantity: 12,
        equippedToHorseId: null,
        equippedToHorseName: null,
      },
    ]);
    stubFeedCatalog([
      {
        id: 'basic',
        name: 'Basic Feed',
        description: 'A basic feed mix.',
        packPrice: 100,
        perUnit: 1.0,
        statRollPct: 5,
        pregnancyBonusPct: 0,
      },
    ]);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InventoryPage />
      </Wrapper>
    );

    const card = await screen.findByTestId('inventory-item-inv-feed-1');
    await waitFor(() => expect(within(card).getByText('12 units in stock')).toBeInTheDocument());
    // Feed must NOT render the tack subtitle.
    expect(within(card).queryByText(/in inventory$/)).not.toBeInTheDocument();
  });
});
