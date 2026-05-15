/**
 * InventoryPage tack subtitle + no-badge tests (Equoria-qyjc)
 *
 * Locks the All-Purpose-Tack AC: "Given inventory page, when user has
 * All Purpose Saddle qty 1, then subtitle '1 in inventory', no x1 badge."
 *
 * Specifically guards:
 *  - InventoryPage.tsx:108  subtitle text for tack vs feed
 *  - InventoryPage.tsx:120  meta=undefined for tack (no quantity badge)
 *
 * OPTIMAL_FIX_DISCIPLINE §2 sentinel: also asserts feed STILL renders
 * "N units in stock" so a refactor that flipped the conditional would
 * fail at least one case.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';

const mockUseInventory = vi.fn();
const mockUseFeedCatalog = vi.fn();

vi.mock('@/hooks/api/useInventory', () => ({
  useInventory: () => mockUseInventory(),
  useUnequipItem: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useFeedCatalog', () => ({
  useFeedCatalog: () => mockUseFeedCatalog(),
}));

import InventoryPage from '../InventoryPage';

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
  vi.clearAllMocks();
  // Default: empty inventory + empty feed catalog. Individual tests override.
  mockUseInventory.mockReturnValue({
    items: [],
    total: 0,
    isLoading: false,
    error: null,
  });
  mockUseFeedCatalog.mockReturnValue({ data: [] });
});

describe('InventoryPage — tack subtitle + no-badge (Equoria-qyjc)', () => {
  it('tack card shows "1 in inventory" subtitle and NO "x1" quantity badge', () => {
    mockUseInventory.mockReturnValue({
      items: [
        {
          id: 'inv-1',
          itemId: 'all-purpose-saddle',
          category: 'saddle' as const,
          name: 'All Purpose Saddle',
          bonus: '+5% to all disciplines',
          quantity: 1,
          equippedToHorseId: null,
          equippedToHorseName: null,
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InventoryPage />
      </Wrapper>
    );

    const card = screen.getByTestId('inventory-item-inv-1');
    expect(card).toBeInTheDocument();

    // Subtitle: "1 in inventory" — quantity in subtitle, NOT a badge.
    expect(within(card).getByText('1 in inventory')).toBeInTheDocument();

    // No "x N" badge anywhere on the tack card. Guards InventoryPage.tsx:120.
    // The regex catches both "x1", "x 1", "×1", "× 1" forms.
    const cardText = card.textContent ?? '';
    expect(cardText).not.toMatch(/[x×]\s*1\b/);

    // And no "units in stock" copy leaked from the feed branch.
    expect(within(card).queryByText(/units in stock/)).not.toBeInTheDocument();
  });

  it('tack card with quantity > 1 still uses "N in inventory" — no x-badge', () => {
    // Sentinel against a regression that re-introduced the badge for
    // quantity > 1 only (cheap-fix that left the qty=1 case correct).
    mockUseInventory.mockReturnValue({
      items: [
        {
          id: 'inv-2',
          itemId: 'dressage-saddle',
          category: 'saddle' as const,
          name: 'Dressage Saddle',
          quantity: 3,
          equippedToHorseId: null,
          equippedToHorseName: null,
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InventoryPage />
      </Wrapper>
    );

    const card = screen.getByTestId('inventory-item-inv-2');
    expect(within(card).getByText('3 in inventory')).toBeInTheDocument();
    expect(card.textContent ?? '').not.toMatch(/[x×]\s*3\b/);
  });

  it('feed card still renders "N units in stock" subtitle (regression guard)', () => {
    mockUseInventory.mockReturnValue({
      items: [
        {
          id: 'inv-feed-1',
          itemId: 'basic',
          category: 'feed' as const,
          name: 'Basic Feed',
          quantity: 12,
          equippedToHorseId: null,
          equippedToHorseName: null,
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
    });
    mockUseFeedCatalog.mockReturnValue({
      data: [
        {
          id: 'basic',
          name: 'Basic Feed',
          statRollPct: 5,
          pregnancyBonusPct: 0,
          description: 'A basic feed mix.',
        },
      ],
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InventoryPage />
      </Wrapper>
    );

    const card = screen.getByTestId('inventory-item-inv-feed-1');
    expect(within(card).getByText('12 units in stock')).toBeInTheDocument();
    // Feed must NOT render the tack subtitle.
    expect(within(card).queryByText(/in inventory$/)).not.toBeInTheDocument();
  });
});
