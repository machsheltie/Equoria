/**
 * TrainerList — the hire dialog names the exact refusal (Equoria-dosig)
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
const HIRE = `${base}/api/v1/trainers/marketplace/hire`;

const marketplace = {
  trainers: [
    {
      marketplaceId: 'mk-1',
      firstName: 'Ada',
      lastName: 'Vane',
      skillLevel: 'expert',
      personality: 'focused',
      speciality: 'Dressage',
      sessionRate: 100,
      bio: 'Patient with nervous horses.',
      availability: true,
    },
  ],
  lastRefresh: '2026-10-01T00:00:00Z',
  nextFreeRefresh: '2026-10-08T00:00:00Z',
  refreshCost: 50,
  canRefreshFree: false,
};

const refusal = (code: string) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak', code }, { status: 400 });

function renderList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MockAuthProvider>
          {/* Equoria-1poxi: the listing is opened for a horse, so the hire assigns to it. */}
          <TrainerList userId="user-1" horseId={1} />
        </MockAuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Owner ruling 2026-10-28 (q230): hiring is one click, no confirmation box, so a
// refusal shows on the clicked card.
describe('TrainerList — refusal codes (Equoria-dosig)', () => {
  it('a full roster is named as a full roster, not as a short balance', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal('rosterCapReached'))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const alert = await within(screen.getByTestId('trainer-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/trainer roster is full/i);
    // Players dismiss trainers; the advice no longer says "Retire" (Equoria-6xm6b).
    expect(alert).toHaveTextContent(/Dismiss a trainer/);
    expect(alert).not.toHaveTextContent(/retire/i);
    expect(alert).not.toHaveTextContent(/balance|funds/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a short balance is named as a short balance, not as a full roster', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal('insufficientFunds'))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const alert = await within(screen.getByTestId('trainer-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/balance/i);
    expect(alert).not.toHaveTextContent(/roster/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});
