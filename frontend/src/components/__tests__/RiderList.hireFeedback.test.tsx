/**
 * RiderList — hire + refresh failure feedback, and an honest load failure
 * (Equoria-ln49p, Equoria-oe9y8; FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3).
 *
 * Boundary-level: the REAL useRiderMarketplace / useHireRider /
 * useRefreshRiderMarketplace hooks run through the REAL api-client; only the
 * network is stubbed (MSW). The defects: a rejected hire (roster cap, funds)
 * and a rejected refresh left the screen exactly as it was, so the player saw
 * nothing; a failed marketplace load printed the raw server message.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import RiderList from '../RiderList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/riders/marketplace`;
const HIRE = `${base}/api/v1/riders/marketplace/hire`;
const REFRESH = `${base}/api/v1/riders/marketplace/refresh`;

const marketplace = {
  riders: [
    {
      marketplaceId: 'mk-1',
      firstName: 'Ada',
      lastName: 'Vane',
      skillLevel: 'experienced',
      personality: 'methodical',
      experience: 300,
      weeklyRate: 100,
      knownAffinities: [],
      bio: 'Steady in the saddle.',
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
      <MockAuthProvider>
        <RiderList userId="user-1" />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('RiderList — hire feedback (Equoria-ln49p)', () => {
  it('a refused hire keeps the dialog open and says so inside it, with no server text', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal(400))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    const dialog = await screen.findByTestId('hire-modal');
    await user.click(within(dialog).getByTestId('confirm-hire-button'));

    const alert = await within(await screen.findByTestId('hire-modal')).findByRole('alert');
    expect(alert).toHaveTextContent(/roster/i);
    expect(alert).toHaveTextContent(/balance|funds/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    // The dialog stays open on the same rider so the player can cancel or retry.
    expect(within(screen.getByTestId('hire-modal')).getByText(/Ada/)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-hire-button')).toBeEnabled();
  });

  it('a server fault on hire shows the shared class copy, not server text', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal(500))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    await user.click(await screen.findByTestId('confirm-hire-button'));

    const alert = await within(await screen.findByTestId('hire-modal')).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a stale hire error is cleared when the dialog is opened again', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal(500))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));
    await user.click(await screen.findByTestId('confirm-hire-button'));
    await within(await screen.findByTestId('hire-modal')).findByRole('alert');
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const dialog = await screen.findByTestId('hire-modal');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RiderList — refresh feedback (Equoria-oe9y8)', () => {
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
    // The riders already on show are untouched.
    expect(screen.getByTestId('rider-card-mk-1')).toBeInTheDocument();
  });
});

describe('RiderList — load failure copy', () => {
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

    expect(await screen.findByTestId('rider-card-mk-1')).toBeInTheDocument();
    expect(refreshes).toBe(0);
  });
});
