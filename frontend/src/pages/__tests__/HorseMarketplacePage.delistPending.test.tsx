/**
 * HorseMarketplacePage My Listings — delisting one horse only locks that row
 * (Equoria-ib96u; FRONTEND_ASYNC_STATE_DOCTRINE §2).
 *
 * Boundary-level: the real hooks and page run; only the network is stubbed
 * (MSW). The defect: every row's Delist button was disabled by the shared
 * mutation's isPending, so delisting one horse froze the whole list.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseMarketplacePage from '../HorseMarketplacePage';

const listing = (id: number, name: string) => ({
  id,
  horseId: id,
  name,
  breed: 'Arabian',
  age: 5,
  sex: 'Mare',
  salePrice: 25_000,
  imageUrl: null,
});

describe('HorseMarketplacePage — sibling Delist buttons (Equoria-ib96u)', () => {
  it('locks only the listing being delisted; the other row stays usable', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/api/v1/auth/profile', () =>
        HttpResponse.json({
          status: 'success',
          data: { user: { id: 1, username: 't', email: 't@e.com', role: 'user', money: 10_000 } },
        })
      ),
      http.get('*/api/v1/marketplace/search', () =>
        HttpResponse.json({
          success: true,
          data: { horses: [], pagination: { page: 1, totalPages: 1, total: 0 } },
        })
      ),
      http.get('*/api/v1/marketplace/my-listings', () =>
        HttpResponse.json({
          success: true,
          data: [listing(9001, 'Stardust'), listing(9002, 'Nimbus')],
        })
      ),
      http.delete('*/api/v1/marketplace/list/:horseId', async () => {
        await held;
        return HttpResponse.json({ success: false, message: 'stop' }, { status: 400 });
      })
    );
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <HorseMarketplacePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByTestId('tab-my-listings'));
    const [first] = await screen.findAllByRole('button', { name: /delist/i });
    await user.click(first);

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /delist/i })[0]).toBeDisabled()
    );
    expect(screen.getAllByRole('button', { name: /delist/i })[1]).toBeEnabled();

    release();
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /delist/i })[0]).toBeEnabled()
    );
  });
});
