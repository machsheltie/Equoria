/**
 * HorseEquipPage TACK_IMAGES conditional render tests (Equoria-r3sj)
 *
 * Locks the All-Purpose-Tack AC: "Given equip page, when user owns
 * All Purpose Saddle, then card shows allpurposesaddle.png; all other
 * tack without an image entry still shows Wrench."
 *
 * Guards HorseEquipPage.tsx:
 *   - line 47-51 (TACK_IMAGES dict)
 *   - line 184-196 (TACK_IMAGES[item.itemId] ? <img/> : <Wrench/>)
 *   - line 190 (img class 'w-20 h-20 object-contain')
 *
 * PATTERN_LIBRARY.md within() scoping is used because the page renders
 * multiple tack-item-* testids.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter, Routes, Route, MockAuthProvider } from '@/test/utils';

const mockUseEquippable = vi.fn();
const mockUseFeedCatalog = vi.fn();

vi.mock('@/hooks/api/useEquippable', () => ({
  useEquippable: () => mockUseEquippable(),
}));

vi.mock('@/hooks/api/useEquipFeed', () => ({
  useEquipFeed: () => ({ mutate: vi.fn(), isPending: false }),
  useUnequipFeed: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useInventory', () => ({
  useEquipItem: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
  useUnequipItem: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
}));

vi.mock('@/hooks/api/useFeedShop', () => ({
  useFeedCatalog: () => mockUseFeedCatalog(),
}));

import HorseEquipPage from '../HorseEquipPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/horses/5/equip']}>
          <Routes>
            <Route path="/horses/:id/equip" element={<HorseEquipPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseFeedCatalog.mockReturnValue({ data: [] });
});

describe('HorseEquipPage — TACK_IMAGES conditional render (Equoria-r3sj)', () => {
  it('all-purpose-saddle renders <img src=/images/tack/allpurposesaddle.png> with correct classes', () => {
    mockUseEquippable.mockReturnValue({
      data: {
        tack: [
          {
            id: 'inv-aps',
            itemId: 'all-purpose-saddle',
            category: 'saddle',
            name: 'All Purpose Saddle',
            bonus: '+5% all disciplines',
            quantity: 1,
            equippedToHorseId: null,
            equippedToHorseName: null,
          },
        ],
        feed: [],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    const card = screen.getByTestId('tack-item-inv-aps');
    expect(card).toBeInTheDocument();

    const img = within(card).getByRole('img');
    expect(img).toHaveAttribute('src', '/images/tack/allpurposesaddle.png');
    expect(img).toHaveAttribute('alt', 'All Purpose Saddle');
    // Locks the img class — refactors that drop w-20/h-20/object-contain
    // will fail this assertion.
    expect(img.className).toContain('w-20');
    expect(img.className).toContain('h-20');
    expect(img.className).toContain('object-contain');

    // No Wrench fallback when an image is present. lucide Wrench renders as
    // an inline <svg class="lucide-wrench …"> so we assert via
    // queryByClassName via querySelector.
    expect(card.querySelector('svg.lucide-wrench')).toBeNull();
  });

  it('item NOT in TACK_IMAGES renders Wrench icon fallback (NO <img>)', () => {
    mockUseEquippable.mockReturnValue({
      data: {
        tack: [
          {
            id: 'inv-apb',
            itemId: 'all-purpose-bridle',
            category: 'bridle',
            name: 'All Purpose Bridle',
            bonus: undefined,
            quantity: 1,
            equippedToHorseId: null,
            equippedToHorseName: null,
          },
        ],
        feed: [],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    const card = screen.getByTestId('tack-item-inv-apb');
    // No image — Wrench fallback path executed.
    expect(within(card).queryByRole('img')).toBeNull();
    // Wrench svg is rendered (lucide-react adds lucide-wrench class).
    expect(card.querySelector('svg.lucide-wrench')).not.toBeNull();
  });

  it('renders both image-tack and wrench-tack side-by-side in the same list', () => {
    // Mixed case — guarantees the conditional discriminates on item.itemId,
    // not on list position or first-item-only.
    mockUseEquippable.mockReturnValue({
      data: {
        tack: [
          {
            id: 'inv-aps',
            itemId: 'all-purpose-saddle',
            category: 'saddle',
            name: 'All Purpose Saddle',
            quantity: 1,
            equippedToHorseId: null,
            equippedToHorseName: null,
          },
          {
            id: 'inv-apb',
            itemId: 'all-purpose-bridle',
            category: 'bridle',
            name: 'All Purpose Bridle',
            quantity: 1,
            equippedToHorseId: null,
            equippedToHorseName: null,
          },
          {
            id: 'inv-ds',
            itemId: 'dressage-saddle',
            category: 'saddle',
            name: 'Dressage Saddle',
            quantity: 2,
            equippedToHorseId: null,
            equippedToHorseName: null,
          },
        ],
        feed: [],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    // All-purpose saddle → img
    const apsCard = screen.getByTestId('tack-item-inv-aps');
    expect(within(apsCard).getByRole('img')).toHaveAttribute(
      'src',
      '/images/tack/allpurposesaddle.png'
    );

    // All-purpose bridle → Wrench fallback
    const apbCard = screen.getByTestId('tack-item-inv-apb');
    expect(within(apbCard).queryByRole('img')).toBeNull();
    expect(apbCard.querySelector('svg.lucide-wrench')).not.toBeNull();

    // Dressage saddle → img (different image)
    const dsCard = screen.getByTestId('tack-item-inv-ds');
    expect(within(dsCard).getByRole('img')).toHaveAttribute(
      'src',
      '/images/tack/dressage-saddle.png'
    );
  });
});
