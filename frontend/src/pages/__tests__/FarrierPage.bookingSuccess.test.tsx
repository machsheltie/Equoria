/**
 * Regression test for Equoria-bvddn.27 (farrier booking slice).
 *
 * apiClient.ts unwraps the backend `{ success, data }` envelope (returns
 * `data.data`). The backend booking endpoint
 * (backend/modules/economy/farrier/controllers/farrierController.mjs) answers:
 *   { success: true, message: '...', data: { horse, service, cost, remainingMoney } }
 * so FarrierPage's onSuccess callback (FarrierPage.tsx:306) actually receives
 * the UNWRAPPED `{ horse, service, cost, remainingMoney }` object. The old
 * code read `result.data.service.name` / `result.data.horse.name` /
 * `result.data.remainingMoney`, which threw a TypeError on the real
 * (already-unwrapped) response. Per CLAUDE.md's TanStack v5 semantics, a
 * throwing onSuccess callback puts the mutation into the ERROR state — so the
 * horse was charged server-side but the page showed "Booking failed" instead
 * of the success confirmation.
 *
 * Renders the REAL page (no mocked api-client) against an MSW handler that
 * mirrors the real backend envelope for POST /api/v1/farrier/book-service,
 * and asserts the actual success confirmation renders (not the error banner).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import FarrierPage from '../FarrierPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function farrierServicesHandler() {
  return http.get(`${base}/api/v1/farrier/services`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'trim',
          name: 'Hoof Trim',
          description: 'Routine hoof trimming.',
          cost: 150,
          duration: '30 min',
          icon: null,
        },
      ],
    })
  );
}

// Exact shape returned by farrierController.mjs bookService on success.
function farrierBookServiceHandler() {
  return http.post(`${base}/api/v1/farrier/book-service`, () =>
    HttpResponse.json({
      success: true,
      message: 'Hoof Trim booked successfully',
      data: {
        horse: {
          id: 1,
          name: 'Starlight',
          hoofCondition: 'good',
          lastFarrierDate: '2026-09-28T00:00:00.000Z',
          lastShod: null,
        },
        service: {
          id: 'trim',
          name: 'Hoof Trim',
          description: 'Routine hoof trimming.',
          duration: '30 min',
          cost: 150,
          hoofConditionOutcome: 'good',
          includesShoing: false,
        },
        cost: 150,
        remainingMoney: 850,
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

describe('FarrierPage booking success (Equoria-bvddn.27)', () => {
  beforeEach(() => {
    server.use(farrierServicesHandler(), farrierBookServiceHandler());
  });

  it('shows the success confirmation (not the error banner) after a real backend-shaped booking response', async () => {
    const user = userEvent.setup();
    renderPage();

    // Select a horse (My Horses tab, default MSW horse list has id 1).
    await screen.findByTestId('horses-hoof-tab');
    await user.click(await screen.findByTestId('horse-card-1'));

    // Jump to Services.
    const viewServices = await screen.findByRole('button', { name: /view services/i });
    await user.click(viewServices);
    const servicesTab = await screen.findByTestId('farrier-services-tab');

    // Book the trim service.
    const trimCard = within(servicesTab).getByTestId('farrier-service-trim');
    await user.click(within(trimCard).getByRole('button', { name: /book/i }));

    // Before the fix: onSuccess threw reading result.data.X on the unwrapped
    // response, the mutation went to isError, and this banner never appeared —
    // instead "Booking failed:" (role="alert") rendered despite the horse
    // having been charged server-side.
    expect(
      await screen.findByText(/Hoof Trim booked for Starlight\. Remaining balance: 850 coins\./i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
