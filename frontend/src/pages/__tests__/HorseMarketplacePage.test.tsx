/**
 * HorseMarketplacePage Tests (Equoria-ga4l)
 *
 * AC coverage:
 *   (1) page hydrates real userBalance from /auth/profile — no hardcoded 999_999
 *   (2) when balance < price, Insufficient-funds warning shows and Buy button is disabled
 *
 * Strategy: real MSW handlers for /api/v1/auth/profile and /api/v1/marketplace.
 * No vi.mock of api-client — uses the real fetch pipeline through MSW per
 * CLAUDE.md testing philosophy.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseMarketplacePage from '../HorseMarketplacePage';
import React from 'react';

const LISTING_FIXTURE = {
  id: 4242,
  horseId: 4242,
  name: 'TestFixture-ga4l-listing',
  breed: 'Thoroughbred',
  age: 4,
  sex: 'Mare',
  salePrice: 50_000,
  seller: 'TestFixture-ga4l-seller',
  imageUrl: null,
  stats: { speed: 50, stamina: 50, agility: 50 },
};

function makeProfileHandler(money: number) {
  return http.get('*/api/v1/auth/profile', () =>
    HttpResponse.json({
      status: 'success',
      data: {
        user: {
          id: 1,
          username: 'tester',
          email: 'tester@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
          money,
        },
      },
    })
  );
}

function makeMarketplaceHandler() {
  return http.get('*/api/v1/marketplace', () =>
    HttpResponse.json({
      success: true,
      data: {
        listings: [LISTING_FIXTURE],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    })
  );
}

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

describe('HorseMarketplacePage — real balance wiring (Equoria-ga4l)', () => {
  it('hydrates userBalance from profile and disables Buy when insufficient funds', async () => {
    // Profile balance well below listing price 50_000.
    server.use(makeProfileHandler(1000), makeMarketplaceHandler());

    const user = userEvent.setup();
    renderPage();

    // Wait for listing to appear
    const listingCard = await screen.findByText(/TestFixture-ga4l-listing/i);
    await user.click(listingCard);

    // The detail modal should show insufficient-funds warning because real balance (1000) < 50000
    await waitFor(() => {
      expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
    });

    // Buy Now button should be disabled
    const buyButton = screen.getByRole('button', { name: /buy now/i });
    expect(buyButton).toBeDisabled();
  });

  it('enables Buy when real balance covers listing price', async () => {
    // Profile balance well above listing price.
    server.use(makeProfileHandler(100_000), makeMarketplaceHandler());

    const user = userEvent.setup();
    renderPage();

    const listingCard = await screen.findByText(/TestFixture-ga4l-listing/i);
    await user.click(listingCard);

    // Wait for modal to render
    const buyButton = await screen.findByRole('button', { name: /buy now/i });

    // No insufficient-funds warning, button enabled
    expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument();
    expect(buyButton).not.toBeDisabled();
  });
});
