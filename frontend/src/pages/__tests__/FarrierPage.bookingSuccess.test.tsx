/**
 * FarrierPage shoeing flow (Equoria-bvddn.27 regression, rewritten for the
 * one-action farrier, owner ruling 2026-10-23, Equoria-zmqzf).
 *
 * OLD CONTRACT: a My Horses tab plus a Services tab with four bookable
 * services (Hoof Trim, Standard / Corrective Shoeing, Emergency Care). NEW
 * RULING: one "Shoe horse — 50 coins" action, once a week.
 *
 * apiClient.ts unwraps the backend `{ success, data }` envelope, so the
 * mutation's onSuccess receives the UNWRAPPED `{ horse, statGained, cost,
 * remainingMoney }` (the earlier bug read `result.data.X` and a throwing
 * onSuccess put a charged booking into the error state).
 *
 * Renders the REAL page against MSW handlers that mirror the real backend
 * envelope for POST /api/v1/farrier/shoe-horse.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import FarrierPage from '../FarrierPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Exact shape returned by farrierController.mjs shoeHorse on success.
function shoeHorseHandler() {
  return http.post(`${base}/api/v1/farrier/shoe-horse`, () =>
    HttpResponse.json({
      success: true,
      message: 'Starlight has been shod',
      data: {
        horse: { id: 1, name: 'Starlight', lastShod: '2026-10-23T14:00:00.000Z' },
        statGained: 'speed',
        cost: 50,
        remainingMoney: 950,
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
        <FarrierPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FarrierPage shoeing (Equoria-zmqzf)', () => {
  beforeEach(() => {
    server.use(shoeHorseHandler());
  });

  it('offers only one action, "Shoe horse — 50 coins", and no old service names', async () => {
    renderPage();
    await screen.findByTestId('farrier-horses');

    expect(screen.getByRole('button', { name: /shoe horse/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shoe horse/i })).toHaveTextContent(/50/);
    expect(screen.queryByText(/hoof trim/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/corrective/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/emergency/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps the action disabled until a horse is chosen', async () => {
    renderPage();
    await screen.findByTestId('horse-card-1');
    expect(screen.getByRole('button', { name: /shoe horse/i })).toBeDisabled();
  });

  it('shows the success confirmation (not the error banner) after a real backend-shaped response', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('horse-card-1'));
    await user.click(screen.getByRole('button', { name: /shoe horse/i }));

    expect(
      await screen.findByText(
        /Starlight has been shod and gained \+1 Speed\. Remaining balance: 950 coins\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tells the player when the horse was already shod this week (409)', async () => {
    server.use(
      http.post(`${base}/api/v1/farrier/shoe-horse`, () =>
        HttpResponse.json(
          { success: false, message: 'Starlight has already been shod this week', data: null },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('horse-card-1'));
    await user.click(screen.getByRole('button', { name: /shoe horse/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Shoeing failed: That horse has already been shod this week.'
    );
  });
});
