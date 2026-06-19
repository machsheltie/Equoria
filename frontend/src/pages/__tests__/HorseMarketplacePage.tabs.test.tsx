/**
 * HorseMarketplacePage My Listings / Sale History tab tests (Equoria-o5hub.30)
 *
 * The existing HorseMarketplacePage.test.tsx covers the Browse tab's real-balance
 * Buy gate. The My Listings and Sale History panels (Story 21-5) were untested.
 * This adds tab-switch coverage for both, rendering their real panels with real
 * useMyListings / useSaleHistory through per-test MSW handlers at the network
 * boundary (no vi.mock of our API client — CLAUDE.md §3).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import HorseMarketplacePage from '../HorseMarketplacePage';

function profileHandler() {
  return http.get('*/api/v1/auth/profile', () =>
    HttpResponse.json({
      status: 'success',
      data: { user: { id: 1, username: 'tester', email: 't@e.com', role: 'user', money: 10_000 } },
    })
  );
}

function browseHandler() {
  return http.get('*/api/v1/marketplace', () =>
    HttpResponse.json({
      success: true,
      data: { listings: [], pagination: { page: 1, totalPages: 1, total: 0 } },
    })
  );
}

function myListingsHandler(listings: unknown[]) {
  return http.get('*/api/v1/marketplace/my-listings', () =>
    HttpResponse.json({ success: true, data: listings })
  );
}

function historyHandler(history: unknown[]) {
  return http.get('*/api/v1/marketplace/history', () =>
    HttpResponse.json({ success: true, data: history })
  );
}

const MY_LISTING = {
  id: 9001,
  horseId: 9001,
  name: 'TestFixture-Stardust',
  breed: 'Arabian',
  age: 5,
  sex: 'Mare',
  salePrice: 25_000,
  imageUrl: null,
};

const HISTORY_ENTRY = {
  id: 7001,
  horseName: 'TestFixture-Nimbus',
  type: 'sold' as const,
  counterparty: 'TestFixture-Buyer',
  salePrice: 33_000,
  soldAt: '2026-04-01T12:00:00Z',
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HorseMarketplacePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseMarketplacePage — My Listings / Sale History tabs (Equoria-o5hub.30)', () => {
  beforeEach(() => {
    server.use(profileHandler(), browseHandler());
  });

  it('defaults to the Browse tab', async () => {
    renderPage();
    expect(await screen.findByTestId('tab-browse')).toBeInTheDocument();
    // Browse panel toolbar is present; My Listings / History panels are not yet.
    expect(screen.getByLabelText(/filter by breed/i)).toBeInTheDocument();
  });

  it("My Listings tab renders the seller's active listings with a Delist action", async () => {
    server.use(myListingsHandler([MY_LISTING]));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-my-listings'));

    expect(await screen.findByText(/TestFixture-Stardust/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delist/i })).toBeInTheDocument();
  });

  it('My Listings tab shows an honest empty state when there are no listings', async () => {
    server.use(myListingsHandler([]));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-my-listings'));

    expect(await screen.findByText(/no active listings/i)).toBeInTheDocument();
  });

  it('Sale History tab renders completed transactions', async () => {
    server.use(historyHandler([HISTORY_ENTRY]));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-history'));

    expect(await screen.findByText(/TestFixture-Nimbus/i)).toBeInTheDocument();
    // The 'sold' entry describes the counterparty.
    expect(screen.getByText(/sold to TestFixture-Buyer/i)).toBeInTheDocument();
  });

  it('Sale History tab shows an honest empty state when there is no history', async () => {
    server.use(historyHandler([]));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-history'));

    expect(await screen.findByText(/no sale history/i)).toBeInTheDocument();
  });
});
