/**
 * RiderList — the hire dialog names the exact refusal (Equoria-dosig) and quotes
 * the real charge: ONE week's pay, never four (owner ruling 2026-10-22,
 * Equoria-yw6w1).
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
import { MockAuthProvider } from '@/test/utils';
import RiderList from '../RiderList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/riders/marketplace`;
const HIRE = `${base}/api/v1/riders/marketplace/hire`;

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
      bio: 'Steady in the saddle.',
    },
  ],
  lastRefresh: '2026-10-01T00:00:00Z',
  nextFreeRefresh: '2026-10-08T00:00:00Z',
  refreshCost: 50,
  canRefreshFree: false,
};

const refusal = (code: string) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak', code }, { status: 400 });

function renderList(money = 5000) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ money }}>
        <RiderList userId="user-1" />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

// Owner ruling 2026-10-28 (q230): hiring is one click, with the fee on the button and
// no confirmation box, so a refusal now shows on the card that was clicked.
describe('RiderList — refusal codes (Equoria-dosig)', () => {
  it('a full roster is named as a full roster, not as a short balance', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace })),
      http.post(HIRE, () => refusal('rosterCapReached'))
    );
    const user = userEvent.setup();
    renderList();

    await user.click(await screen.findByTestId('hire-button-mk-1'));

    const alert = await within(screen.getByTestId('rider-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/roster is full/i);
    // Players dismiss riders; they never retire them (Equoria-6xm6b).
    expect(alert).toHaveTextContent(/Dismiss a rider/);
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

    const alert = await within(screen.getByTestId('rider-card-mk-1')).findByRole('alert');
    expect(alert).toHaveTextContent(/balance/i);
    expect(alert).not.toHaveTextContent(/roster/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });
});

describe('RiderList — one week at a time (Equoria-yw6w1)', () => {
  it('a player who can pay one week (but not four) can hire, and is quoted one week', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace }))
    );
    renderList(150); // weeklyRate 100: affordable for one week, not for four

    const hireButton = await screen.findByTestId('hire-button-mk-1');
    expect(hireButton).toBeEnabled();
    expect(hireButton).not.toHaveTextContent(/insufficient/i);
    expect(hireButton).toHaveTextContent('100');

    // One click, one week: the button itself carries the one-week fee (q230).
    expect(hireButton).not.toHaveTextContent('400');
    expect(screen.getByTestId('rider-card-mk-1')).not.toHaveTextContent(
      /4 weeks|four weeks|4-week/i
    );
  });

  it('the low-balance note does not promise a four-week payment', async () => {
    server.use(
      http.get(MARKETPLACE, () => HttpResponse.json({ success: true, data: marketplace }))
    );
    renderList(150);

    await screen.findByTestId('hire-button-mk-1');
    expect(screen.getByText(/low balance/i)).toBeInTheDocument();
    expect(screen.queryByText(/4-week|4 weeks|four weeks/i)).not.toBeInTheDocument();
  });
});
