/**
 * CraftingPage — a craft in flight only locks the recipe being crafted
 * (Equoria-ib96u; FRONTEND_ASYNC_STATE_DOCTRINE §2).
 *
 * Boundary-level: the real hooks and page run; only the network is stubbed
 * (MSW). The defect: every RecipeCard received the shared mutation's isPending,
 * so crafting one item disabled every other recipe's Craft button.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import CraftingPage from '../CraftingPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const recipe = (id: string, name: string) => ({
  id,
  name,
  description: `${name} description`,
  tier: 0,
  cost: 10,
  materials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
  result: id,
  resultName: name,
  resultCategory: 'tack',
  bonus: '+1',
  numericBonus: 1,
  isCosmetic: false,
  locked: false,
  affordable: true,
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CraftingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CraftingPage — sibling recipes while one craft is in flight (Equoria-ib96u)', () => {
  it('locks only the recipe being crafted; the other recipe can still be started', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${base}/api/v1/crafting/materials`, () =>
        HttpResponse.json({
          success: true,
          data: {
            workshopTier: 0,
            materials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
          },
        })
      ),
      http.get(`${base}/api/v1/crafting/recipes`, () =>
        HttpResponse.json({
          success: true,
          data: {
            workshopTier: 0,
            recipes: [recipe('bridle', 'Bridle'), recipe('saddle', 'Saddle')],
          },
        })
      ),
      http.post(`${base}/api/v1/crafting/craft`, async () => {
        await held;
        return HttpResponse.json({ success: false, message: 'stop' }, { status: 400 });
      })
    );
    const user = userEvent.setup();
    renderPage();

    const [first] = await screen.findAllByRole('button', { name: 'Craft' });
    await user.click(first);
    await user.click(await screen.findByRole('button', { name: 'Confirm Craft' }));

    await waitFor(() => {
      const crafts = screen.getAllByRole('button', { name: 'Craft' });
      expect(crafts[0]).toBeDisabled();
    });
    expect(screen.getAllByRole('button', { name: 'Craft' })[1]).toBeEnabled();

    release();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Craft' })[0]).toBeEnabled());
  });
});
