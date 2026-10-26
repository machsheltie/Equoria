/**
 * TrainerList — a trainer's cost is its per-training fee (Equoria-3kegj)
 *
 * Owner ruling 2026-10-22: hiring a trainer is free; the only charge is the
 * trainer's advertised fee, taken once each time the player trains a horse
 * with it (one training per horse per week). The marketplace used to label the
 * fee "Weekly Rate … /wk", price the hire at four times it ("Upfront (4
 * weeks)") and disable hiring for a short balance.
 *
 * Boundary-level: the real hooks and api-client run; only the network is
 * stubbed (MSW).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MemoryRouter } from 'react-router';
import { MockAuthProvider } from '@/test/utils';
import TrainerList from '../TrainerList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/trainers/marketplace`;

// A fee above the mock player's 5,000-coin balance: affordability of the fee
// must not block a free hire.
const FEE = 6200;

const marketplace = {
  trainers: [
    {
      marketplaceId: 'mk-fee',
      firstName: 'Ada',
      lastName: 'Vane',
      skillLevel: 'expert',
      personality: 'focused',
      speciality: 'Dressage',
      sessionRate: FEE,
      bio: 'Patient with nervous horses.',
      availability: true,
    },
  ],
  lastRefresh: '2026-10-01T00:00:00Z',
  nextFreeRefresh: '2026-10-08T00:00:00Z',
  refreshCost: 50,
  canRefreshFree: false,
};

function renderList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MockAuthProvider>
          <TrainerList userId="user-1" />
        </MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TrainerList — per-training fee copy (Equoria-3kegj)', () => {
  it('the card shows the per-training fee, no weekly rate, and a free hire button', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace }))
    );
    renderList();

    const card = await screen.findByTestId('trainer-card-mk-fee');
    expect(within(card).getByText(/training fee/i)).toBeInTheDocument();
    expect(within(card).getByText(/6,200/)).toBeInTheDocument();
    expect(within(card).getByText(/per training/i)).toBeInTheDocument();
    expect(card).not.toHaveTextContent(/weekly rate|\/wk/i);

    const hire = within(card).getByTestId('hire-button-mk-fee');
    expect(hire).toBeEnabled();
    expect(hire).not.toHaveTextContent(/insufficient/i);
    expect(hire).not.toHaveTextContent(/24,800/); // never four times the fee
    expect(screen.queryByText(/upfront/i)).not.toBeInTheDocument();
  });

  it('the hire dialog says hiring is free and names the fee charged per training', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace }))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-fee'));
    const dialog = await screen.findByTestId('hire-modal');

    expect(dialog).toHaveTextContent(/hiring is free/i);
    expect(within(dialog).getByText(/training fee/i)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/6,200/);
    expect(dialog).not.toHaveTextContent(/upfront|4 weeks|weekly rate|24,800/i);
  });
});
