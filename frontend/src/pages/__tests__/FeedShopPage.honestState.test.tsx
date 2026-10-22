/**
 * FeedShopPage — honest empty catalog and unknown price (Equoria-6p78r, qqhwh)
 *
 * A successful fetch of an EMPTY catalog rendered a bare grid: a blank shop
 * with no explanation. Empty is a state that must be named (doctrine §1). A
 * tier whose price is absent must show "—", not a fabricated 0-coin price.
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import FeedShopPage from '../FeedShopPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FeedShopPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FeedShopPage honest states (Equoria-6p78r)', () => {
  it('names an empty catalog instead of rendering a blank grid', async () => {
    server.use(http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json([])));

    renderPage();

    expect(await screen.findByTestId('empty-state-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('feed-shop-grid')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the grid (and no empty state) when the catalog has tiers', async () => {
    server.use(
      http.get('/api/v1/feed-shop/catalog', () =>
        HttpResponse.json([
          {
            id: 'basic',
            name: 'Basic Feed',
            description: 'Standard nutrition.',
            packPrice: 100,
            perUnit: 1,
            statRollPct: 5,
            pregnancyBonusPct: 2,
          },
        ])
      )
    );

    renderPage();

    expect(await screen.findByTestId('feed-shop-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-unavailable')).not.toBeInTheDocument();
  });
});

describe('FeedShopPage unknown price (Equoria-qqhwh)', () => {
  it('shows "—", not a 0-coin price, for a tier with no price', async () => {
    server.use(
      http.get('/api/v1/feed-shop/catalog', () =>
        HttpResponse.json([
          {
            id: 'basic',
            name: 'Basic Feed',
            description: 'Standard nutrition.',
            perUnit: 1,
            statRollPct: 5,
            pregnancyBonusPct: 2,
          },
        ])
      )
    );

    renderPage();

    const card = await screen.findByTestId('feed-tier-basic');
    expect(within(card).getAllByLabelText(/unknown amount/i).length).toBeGreaterThanOrEqual(2);
  });
});
