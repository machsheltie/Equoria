/**
 * InventoryPage — the Unequip button keeps its name while it is working
 * (Equoria-4yocc; FRONTEND_ASYNC_STATE_DOCTRINE section 5).
 *
 * While the request was in flight the button's only content was a spinner
 * icon, so a screen reader announced an unnamed button. It must stay named,
 * report aria-busy, and still be a real (disabled) button.
 *
 * Real page, hooks and apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import InventoryPage from '../InventoryPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

describe('InventoryPage unequip button while pending (Equoria-4yocc)', () => {
  it('stays named and announces busy instead of becoming a bare spinner', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${base}/api/v1/inventory`, () =>
        HttpResponse.json({
          success: true,
          message: 'ok',
          data: {
            items: [
              {
                id: 'inv-1',
                itemId: 'all-purpose-saddle',
                category: 'saddle',
                name: 'All Purpose Saddle',
                bonus: '+5% to all disciplines',
                quantity: 1,
                equippedToHorseId: 7,
                equippedToHorseName: 'Moonflower',
              },
            ],
            total: 1,
          },
        })
      ),
      http.get(`${base}/api/v1/feed-shop/catalog`, () =>
        HttpResponse.json({ success: true, message: 'ok', data: [] })
      ),
      http.post(`${base}/api/v1/inventory/unequip`, async () => {
        await held;
        return HttpResponse.json({ success: false, message: 'stop' }, { status: 400 });
      })
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <MockAuthProvider>
          <BrowserRouter>
            <InventoryPage />
          </BrowserRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: /unequip/i }));

    const busy = await screen.findByRole('button', { name: /unequip/i });
    await waitFor(() => expect(busy).toHaveAttribute('aria-busy', 'true'));
    expect(busy).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByRole('button', { name: /unequip/i })).toBeEnabled());
  });
});
