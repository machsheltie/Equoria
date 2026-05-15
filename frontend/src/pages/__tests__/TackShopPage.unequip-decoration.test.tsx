/**
 * TackShopPage — Unequip Decoration Wiring (Equoria-n9n8)
 *
 * Verifies that the "My Horses" tab surfaces an Unequip button for
 * each decoration currently equipped on the selected horse, and that
 * clicking the button invokes useUnequipDecoration.mutate with the
 * { horseId, itemId } payload.
 *
 * docs/beta-route-truth-table.md /tack-shop row lists
 * POST /api/v1/tack-shop/unequip-decoration as a primary action;
 * before this fix no production component imported the hook.
 *
 * Hook signature (see frontend/src/hooks/api/useTackShop.ts):
 *   useUnequipDecoration() → useMutation<{ horseId; itemId }>
 *
 * Backend horse shape: horse.tack.decorations is an array of item IDs.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TackShopPage from '../TackShopPage';

vi.mock('@/hooks/api/useTackShop', () => ({
  useTackInventory: vi.fn(() => ({ data: { categories: {} }, isLoading: false, isError: false })),
  usePurchaseTackItem: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUnequipDecoration: vi.fn(),
}));

vi.mock('@/hooks/api/useHorses', () => ({
  useHorses: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { useHorses } = await import('@/hooks/api/useHorses');
const { useUnequipDecoration } = await import('@/hooks/api/useTackShop');

const horseWithDecorations = {
  id: 42,
  name: 'TestFixture-Decorated',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2021-01-01',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
  tack: {
    decorations: ['rose-garland-001', 'silver-bell-002'],
  },
};

describe('TackShopPage — unequip decoration (Equoria-n9n8)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    vi.mocked(useHorses).mockReturnValue({
      data: [horseWithDecorations],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useUnequipDecoration).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    } as any);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tack-shop']}>
          <TackShopPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('shows an Unequip button per decoration after selecting the horse', async () => {
    const user = userEvent.setup();
    renderPage();

    // Pick the horse from the picker. HorseCard renders the horse name.
    await user.click(screen.getByText(/TestFixture-Decorated/i));

    // After selection, two unequip buttons appear (one per decoration).
    const unequipButtons = await screen.findAllByRole('button', { name: /unequip/i });
    expect(unequipButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('invokes useUnequipDecoration.mutate with { horseId, itemId } on click', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useUnequipDecoration).mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    } as any);

    renderPage();

    await user.click(screen.getByText(/TestFixture-Decorated/i));

    const unequipButtons = await screen.findAllByRole('button', { name: /unequip/i });
    await user.click(unequipButtons[0]);

    // The page calls mutate(variables, { onSuccess, onError }) — assert
    // the variables (first arg) match expected payload regardless of
    // whether toast callbacks were passed.
    expect(mutate).toHaveBeenCalled();
    expect(mutate.mock.calls[0][0]).toEqual({
      horseId: 42,
      itemId: 'rose-garland-001',
    });
  });

  it('shows an empty-state message when the selected horse has no decorations', async () => {
    const user = userEvent.setup();
    vi.mocked(useHorses).mockReturnValue({
      data: [{ ...horseWithDecorations, tack: { decorations: [] } }],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    renderPage();

    await user.click(screen.getByText(/TestFixture-Decorated/i));

    // No unequip buttons visible
    expect(screen.queryByRole('button', { name: /unequip/i })).not.toBeInTheDocument();
    // An honest empty-state ("no decorations") is shown
    expect(screen.getByText(/no decorations/i)).toBeInTheDocument();
  });
});
