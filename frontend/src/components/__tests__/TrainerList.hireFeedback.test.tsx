/**
 * TrainerList — hire + refresh failure feedback, and an honest load failure
 * (Equoria-ln49p, Equoria-oe9y8; FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3).
 *
 * Boundary-level: the REAL useTrainerMarketplace / useHireTrainer /
 * useRefreshTrainerMarketplace hooks run through the REAL api-client; only the
 * network is stubbed (MSW). The defects: a rejected hire (roster cap, funds)
 * and a rejected refresh left the screen exactly as it was, so the player saw
 * nothing; a failed marketplace load printed the raw server message.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
const REFRESH = `${base}/api/v1/trainers/marketplace/refresh`;

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

// A deliberately recognisable server body: it must never reach the screen.
const refusal = (status: number) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status });

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
describe('TrainerList — hire feedback (Equoria-ln49p)', () => {
  it('a refused hire says so on the clicked card, with no server text', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal(400))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const alert = await within(screen.getByTestId('trainer-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/roster/i);
    expect(alert).toHaveTextContent(/balance|funds/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    // No confirmation box, and the button is ready for another try.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('hire-button-mk-1')).toBeEnabled();
  });

  it('a server fault on hire shows the shared class copy, not server text', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal(500))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const alert = await within(screen.getByTestId('trainer-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a stale hire error is cleared by the next click', async () => {
    let calls = 0;
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => {
        calls += 1;
        return calls === 1
          ? refusal(500)
          : HttpResponse.json(
              { success: true, data: { trainer: { id: 1 }, cost: 0, assignment: { horseId: 1 } } },
              { status: 201 }
            );
      })
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    const card = screen.getByTestId('trainer-card-mk-1');
    await within(card).findByRole('alert');
    await user.click(screen.getByTestId('hire-button-mk-1'));

    await waitFor(() => expect(within(card).queryByRole('alert')).not.toBeInTheDocument());
    expect(calls).toBe(2);
  });
});

describe('TrainerList — refresh feedback (Equoria-oe9y8)', () => {
  it('a refused refresh is announced beside the refresh control', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(REFRESH, () => refusal(400))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('refresh-marketplace-button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/refresh/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    // The trainers already on show are untouched.
    expect(screen.getByTestId('trainer-card-mk-1')).toBeInTheDocument();
  });
});

describe('TrainerList — load failure copy', () => {
  it('a failed marketplace load shows class copy, never the server text', async () => {
    server.use(http.get(MARKETPLACE, () => refusal(500)));
    renderList();

    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry on a failed load refetches the marketplace (it does not spend a refresh)', async () => {
    let gets = 0;
    let refreshes = 0;
    server.use(
      http.get(MARKETPLACE, () => {
        gets += 1;
        return gets === 1 ? refusal(500) : HttpResponse.json({ success: true, data: marketplace });
      }),
      http.post(REFRESH, () => {
        refreshes += 1;
        return HttpResponse.json({ success: true, data: marketplace });
      })
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByRole('button', { name: /retry|try again/i }));

    expect(await screen.findByTestId('trainer-card-mk-1')).toBeInTheDocument();
    expect(refreshes).toBe(0);
  });
});
