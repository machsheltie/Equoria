/**
 * GroomList — a paid marketplace refresh is one click with the fee on the
 * button (Equoria-1qf9n).
 *
 * Owner rulings: "just a game: no receipts", no confirm pages, fee on the
 * button, one click (2026-10-26); one-click hire (q230, 2026-10-28). Old
 * contract: a PAID refresh opened a "Refresh Marketplace" confirmation dialog
 * (refresh-confirmation-dialog) with Cancel and Confirm Refresh, and only
 * Confirm sent the POST. Ruling: the button reads its fee and one click sends
 * POST /groom-marketplace/refresh {force:true}; a free refresh still sends
 * {force:false}.
 *
 * Boundary-level: the real useGroomMarketplace / useRefreshMarketplace hooks
 * and api-client run; only the network is stubbed (MSW).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import GroomList from '../GroomList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/groom-marketplace`;
const REFRESH = `${base}/api/v1/groom-marketplace/refresh`;

const marketplace = (paid: boolean) => ({
  grooms: [
    {
      marketplaceId: 'groom-1',
      firstName: 'Sarah',
      lastName: 'Johnson',
      specialty: 'foalCare',
      skillLevel: 'expert',
      personality: 'gentle',
      experience: 8,
      sessionRate: 100,
      bio: 'Experienced foal care specialist.',
      availability: true,
    },
  ],
  lastRefresh: new Date().toISOString(),
  nextFreeRefresh: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  feePerHorsePerWeek: 70,
  maxHorsesPerGroom: 10,
  refreshCost: paid ? 50 : 0,
  canRefreshFree: !paid,
  refreshCount: paid ? 1 : 0,
});

function serve(paid: boolean) {
  const posts: unknown[] = [];
  server.use(
    http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace(paid) })),
    http.post(REFRESH, async ({ request }) => {
      posts.push(((await request.json()) as { force?: unknown }).force);
      return HttpResponse.json({ success: true, data: marketplace(true) });
    })
  );
  return posts;
}

function renderList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ money: 5000 }}>
        <GroomList userId="user-1" />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('GroomList — marketplace refresh', () => {
  it('a paid refresh names its fee on the button and refreshes in one click, with no dialog', async () => {
    const posts = serve(true);
    const user = userEvent.setup();
    renderList();

    const button = await screen.findByRole('button', { name: /^refresh \(50 coins\)$/i });
    await user.click(button);

    await waitFor(() => expect(posts).toEqual([true]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refresh-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('a free refresh still refreshes in one click without spending', async () => {
    const posts = serve(false);
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: /free refresh/i }));

    await waitFor(() => expect(posts).toEqual([false]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
