/**
 * MarketplaceHubPage Tests (Equoria-m1ck)
 *
 * AC: covers both LocationCard hrefs render correctly:
 *   - Horse Trader → /marketplace/horse-trader
 *   - Horse Marketplace → /marketplace/horses
 *
 * Also verifies the Horse Trader card description displays the live breed
 * count from useBreeds() (Equoria-5c5j follow-on coverage).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import MarketplaceHubPage from '../MarketplaceHubPage';
import React from 'react';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MarketplaceHubPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MarketplaceHubPage — hub locations', () => {
  it('renders both LocationCards with correct hrefs', async () => {
    renderPage();

    // The page sets data-testid="marketplace-hub-page" on the root
    expect(await screen.findByTestId('marketplace-hub-page')).toBeInTheDocument();

    // Horse Trader card — name + link target
    const horseTraderLink = screen.getByRole('link', { name: /horse trader/i });
    expect(horseTraderLink).toHaveAttribute('href', '/marketplace/horse-trader');

    // Horse Marketplace card — name + link target
    const horseMarketplaceLink = screen.getByRole('link', { name: /horse marketplace/i });
    expect(horseMarketplaceLink).toHaveAttribute('href', '/marketplace/horses');
  });

  it('shows live breed count from useBreeds in the Horse Trader description', async () => {
    // Override the default 3-breed handler with a richer set so we can assert
    // a specific count is reflected in the description string.
    server.use(
      http.get('*/api/v1/breeds', () =>
        HttpResponse.json({
          success: true,
          data: [
            { id: 1, name: 'Thoroughbred' },
            { id: 2, name: 'Arabian' },
            { id: 3, name: 'Warmblood' },
            { id: 4, name: 'Quarter Horse' },
            { id: 5, name: 'Friesian' },
          ],
          count: 5,
        })
      )
    );

    renderPage();

    // Wait for the breeds query to resolve and the card to update
    await waitFor(() => {
      expect(screen.getByText(/5 breeds available/i)).toBeInTheDocument();
    });

    // And the legacy hardcoded "320 breeds" string never appears
    expect(screen.queryByText(/320 breeds/i)).not.toBeInTheDocument();
  });
});
