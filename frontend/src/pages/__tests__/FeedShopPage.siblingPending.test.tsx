/**
 * FeedShopPage — pending state belongs to the tier that was bought
 * (Equoria-ib96u; FRONTEND_ASYNC_STATE_DOCTRINE §2).
 *
 * Boundary-level: the real hooks and page run; only the network is stubbed
 * (MSW). The defect: one shared mutation's isPending disabled and spun every
 * tier's Buy button, so buying Basic made Elite look like it was working too.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import FeedShopPage from '../FeedShopPage';
import type { FeedItem } from '@/lib/api-client';

const CATALOG: FeedItem[] = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description: 'Standard nutrition.',
    packPrice: 100,
    perUnit: 1,
    statRollPct: 5,
    pregnancyBonusPct: 2,
  },
  {
    id: 'elite',
    name: 'Elite Feed',
    description: 'Championship grade.',
    packPrice: 1500,
    perUnit: 15,
    statRollPct: 30,
    pregnancyBonusPct: 12,
  },
];

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

describe('FeedShopPage — sibling buttons while one purchase is in flight (Equoria-ib96u)', () => {
  it('marks only the bought tier as pending; the other tiers stay usable', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('/api/v1/feed-shop/catalog', () => HttpResponse.json(CATALOG)),
      http.post('/api/v1/feed-shop/purchase', async () => {
        await held;
        return HttpResponse.json({
          remainingMoney: 4900,
          inventoryItem: {
            id: 'i',
            itemId: 'basic',
            category: 'feed',
            name: 'Basic',
            quantity: 100,
          },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('buy-basic'));

    await waitFor(() =>
      expect(screen.getByTestId('buy-basic')).toHaveAttribute('aria-busy', 'true')
    );
    const other = screen.getByTestId('buy-elite');
    expect(other).toBeEnabled();
    expect(other).not.toHaveAttribute('aria-busy');

    release();
    await waitFor(() => expect(screen.getByTestId('buy-basic')).not.toHaveAttribute('aria-busy'));
  });
});
