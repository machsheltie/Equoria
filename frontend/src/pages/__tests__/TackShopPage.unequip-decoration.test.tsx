/**
 * TackShopPage — Unequip Decoration Wiring (Equoria-n9n8;
 * converted to MSW boundary under Equoria-fefh2.12)
 *
 * Boundary-level: the page renders against the REAL `useHorses`,
 * `useUnequipDecoration`, and `useTackInventory` hooks (real React Query +
 * real `horsesApi` / `tackShopApi` over `apiClient`) with the network
 * boundary stubbed by MSW (`server.use(...)`). This is NOT a
 * `vi.mock('@/hooks/...')`. It exercises the real query key (`['horses']`),
 * the `{ success, data }` envelope unwrap done by `apiClient.get`, the
 * decoration-derived Unequip rendering, and — crucially — the real
 * `useUnequipDecoration` mutation hitting the wire end-to-end (CSRF round
 * trip included). Auth state comes from the REAL `AuthContext` via
 * `MockAuthProvider` (a real provider, not a module mock).
 *
 * Real wire shapes (verified from the backend controllers):
 *  - GET  /api/v1/horses                          → { success, data: HorseSummary[] }
 *    (the horses list serializer returns a bare array under `data`;
 *     `apiClient.get` unwraps `.data`, so `useHorses` receives the array.
 *     Each horse's `tack.decorations` is an array of item-id strings —
 *     backend/.../tackShopController.mjs stores decorations there.)
 *  - POST /api/v1/tack-shop/unequip-decoration    → { success, message,
 *      data: { horse: { id, name, tack }, removedItemId } }
 *    (backend/modules/economy/tackShop/controllers/tackShopController.mjs
 *     unequipDecoration: `data: { horse, removedItemId }`). The page's
 *     onSuccess callback only needs a 2xx — the body shape is asserted here
 *     to keep the mock faithful to the real envelope.
 *
 * docs/beta-route-truth-table.md /tack-shop row lists
 * POST /api/v1/tack-shop/unequip-decoration as a primary action.
 *
 * NOTE on the click→mutate assertion: the previous over-mocked test asserted
 * `mutate` was called with `{ horseId, itemId }` by stubbing the hook. Here
 * we assert the EQUIVALENT-but-stronger fact — the real mutation sends a POST
 * to the unequip endpoint whose request body is exactly `{ horseId, itemId }`.
 * This exercises the full hook → apiClient → wire path the stub never touched.
 *
 * The "Shop" tab content is NOT mounted while the "My Horses" tab is active
 * (Radix Tabs does not mount inactive panels), so `useTackInventory` never
 * fires and the inventory endpoint does not need stubbing — matching the
 * original test, which likewise only provided the horses data.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import type { HorseSummary } from '@/lib/api-client';
import TackShopPage from '../TackShopPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const HORSES_PATH = `${base}/api/v1/horses`;
const UNEQUIP_PATH = `${base}/api/v1/tack-shop/unequip-decoration`;

const horseWithDecorations: HorseSummary = {
  id: 42,
  name: 'TestFixture-Decorated',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2021-01-01',
  healthStatus: 'Excellent',
  stats: {
    speed: 0,
    stamina: 0,
    agility: 0,
    strength: 0,
    intelligence: 0,
    health: 0,
  } as HorseSummary['stats'],
  disciplineScores: {},
  tack: {
    decorations: ['rose-garland-001', 'silver-bell-002'],
  },
};

/**
 * Stub the horses-list boundary. Mirrors the real serializer envelope:
 * `{ success, data: HorseSummary[] }`. `apiClient.get` unwraps `.data`, so
 * `useHorses` receives the bare array. Matches BOTH the cache-busted
 * `/api/v1/horses?t=<ms>` request the client actually sends and the bare
 * path — MSW ignores the query string when matching a path without one.
 */
function stubHorses(horses: HorseSummary[]) {
  server.use(http.get(HORSES_PATH, () => HttpResponse.json({ success: true, data: horses })));
}

/**
 * Stub the unequip-decoration boundary with the real success envelope and
 * capture each request body so the test can assert the exact `{ horseId,
 * itemId }` payload the real hook sends over the wire.
 */
function stubUnequip(captured: Array<{ horseId: number; itemId: string }>) {
  server.use(
    http.post(UNEQUIP_PATH, async ({ request }) => {
      const body = (await request.json()) as { horseId: number; itemId: string };
      captured.push(body);
      return HttpResponse.json({
        success: true,
        message: 'Decoration removed successfully',
        data: {
          horse: {
            id: body.horseId,
            name: 'TestFixture-Decorated',
            tack: {
              decorations: ['rose-garland-001', 'silver-bell-002'].filter(
                (id) => id !== body.itemId
              ),
            },
          },
          removedItemId: body.itemId,
        },
      });
    })
  );
}

describe('TackShopPage — unequip decoration (Equoria-n9n8)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Default: a horse with two decorations. Individual tests override
    // (last-registered handler wins in MSW) when they need a different shape.
    stubHorses([horseWithDecorations]);
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <MemoryRouter initialEntries={['/tack-shop']}>
            <TackShopPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('shows an Unequip button per decoration after selecting the horse', async () => {
    const user = userEvent.setup();
    renderPage();

    // Pick the horse from the picker. HorseCard renders the horse name.
    // The horse list is fetched from the boundary, so wait for it to appear.
    await user.click(await screen.findByText(/TestFixture-Decorated/i));

    // After selection, two unequip buttons appear (one per decoration).
    const unequipButtons = await screen.findAllByRole('button', { name: /unequip/i });
    expect(unequipButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('sends a POST to the unequip endpoint with { horseId, itemId } on click', async () => {
    const user = userEvent.setup();
    const captured: Array<{ horseId: number; itemId: string }> = [];
    stubUnequip(captured);

    renderPage();

    await user.click(await screen.findByText(/TestFixture-Decorated/i));

    const unequipButtons = await screen.findAllByRole('button', { name: /unequip/i });
    await user.click(unequipButtons[0]);

    // The real hook → apiClient → wire path fires a POST whose body is exactly
    // the expected payload. (Stronger than the previous stub-mutate assertion:
    // it proves the request actually reaches the boundary in the right shape.)
    await waitFor(() => expect(captured[0]).toEqual({ horseId: 42, itemId: 'rose-garland-001' }));
  });

  it('shows an empty-state message when the selected horse has no decorations', async () => {
    const user = userEvent.setup();
    stubHorses([{ ...horseWithDecorations, tack: { decorations: [] } }]);

    renderPage();

    await user.click(await screen.findByText(/TestFixture-Decorated/i));

    // No unequip buttons visible
    expect(screen.queryByRole('button', { name: /unequip/i })).not.toBeInTheDocument();
    // An honest empty-state ("no decorations") is shown
    expect(await screen.findByText(/no decorations/i)).toBeInTheDocument();
  });
});
