/**
 * TackShopPage — a shop only (owner ruling 2026-10-26, q78, Equoria-dslww).
 *
 * Old contract (retired with TackShopPage.unequip-decoration): My Horses / Shop
 * tabs; a purchase was bought FOR a selected horse and went straight onto it.
 * New ruling: the Tack Shop works like the Feed Shop, a place to buy things.
 * No Horses tab, no horse picker. Buying puts the tack in the inventory.
 *
 * Real page, real hooks, real apiClient; the HTTP boundary is stubbed by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import TackShopPage from '../TackShopPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const INVENTORY = `${base}/api/v1/tack-shop/inventory`;
const PURCHASE = `${base}/api/v1/tack-shop/purchase`;

const saddle = {
  id: 'dressage-saddle',
  category: 'saddle',
  name: 'Dressage Saddle',
  description: 'A saddle made for Dressage and no other discipline.',
  cost: 500,
  bonus: '+5 in Dressage shows',
  tier: 'quality',
  disciplines: ['Dressage'],
};

function stubCatalogue() {
  server.use(
    http.get(INVENTORY, () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [saddle],
          categories: { saddle: [saddle] },
          categoryDisplayNames: { saddle: 'Saddles & Harnesses' },
        },
      })
    )
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>
          <TackShopPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('TackShopPage (Equoria-dslww)', () => {
  it('has no Horses tab, no tabs at all and no horse picker', async () => {
    stubCatalogue();
    renderPage();
    await screen.findByTestId('tack-item-dressage-saddle');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/my horses/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/select a horse|purchasing for|change horse/i)
    ).not.toBeInTheDocument();
  });

  it('shows the catalogue price and an enabled Buy button without choosing a horse', async () => {
    stubCatalogue();
    renderPage();
    const card = await screen.findByTestId('tack-item-dressage-saddle');
    expect(within(card).getByText('500')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Buy' })).toBeEnabled();
  });

  it('buys with the item id alone and says the tack is in the inventory', async () => {
    stubCatalogue();
    let body: unknown;
    server.use(
      http.post(PURCHASE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: { item: saddle, cost: 500, remainingMoney: 1500 },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('tack-item-dressage-saddle');
    await user.click(within(card).getByRole('button', { name: 'Buy' }));
    expect(
      await screen.findByText(/Bought Dressage Saddle; it is in your inventory/)
    ).toBeInTheDocument();
    // No receipt line with the remaining balance (owner ruling 2026-10-26, Equoria-6xm6b).
    expect(screen.queryByText(/Remaining balance/i)).not.toBeInTheDocument();
    expect(body).toEqual({ itemId: 'dressage-saddle' });
  });

  // Old contract: a failed purchase popped a "Purchase failed" toast and printed
  // the server's own message in a banner above the catalogue. New ruling q173: the
  // failure shows under the Buy button that failed, in mapped words.
  it("a failed purchase shows under that item's Buy button, never the server text", async () => {
    stubCatalogue();
    server.use(
      http.post(PURCHASE, () =>
        HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT' }, { status: 500 })
      )
    );
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByTestId('tack-item-dressage-saddle');
    await user.click(within(card).getByRole('button', { name: 'Buy' }));

    const alert = await within(card).findByRole('alert');
    expect(alert).toHaveTextContent(/purchase failed/i);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});
