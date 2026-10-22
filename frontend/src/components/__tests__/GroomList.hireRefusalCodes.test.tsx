/**
 * GroomList — a refused hire is shown inside the hire dialog and names the exact
 * refusal (Equoria-dosig). Before, the groom dialog said nothing at all about a
 * refusal (the failure only surfaced as a floating toast from the hook).
 *
 * Boundary-level: the real hooks and api-client run; only the network is
 * stubbed (MSW). The offer list comes in as a prop, as the component allows.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import GroomList from '../GroomList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const HIRE = `${base}/api/v1/groom-marketplace/hire`;

const marketplaceData = {
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
  refreshCost: 0,
  canRefreshFree: true,
  refreshCount: 0,
};

const refusal = (status: number, code?: string) =>
  HttpResponse.json(
    { success: false, message: 'RAW-SERVER-TEXT leak', ...(code ? { code } : {}) },
    { status }
  );

function renderList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ money: 5000 }}>
        <GroomList userId="user-1" marketplaceData={marketplaceData} />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

async function openDialogAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /hire sarah johnson/i }));
  const dialog = await screen.findByTestId('hire-modal');
  await user.click(within(dialog).getByRole('button', { name: /^hire groom$/i }));
  return within(await screen.findByTestId('hire-modal')).findByRole('alert');
}

describe('GroomList — refusal codes (Equoria-dosig)', () => {
  it('a full roster is named as a full roster, in the dialog, with no server text', async () => {
    server.use(http.post(HIRE, () => refusal(400, 'rosterCapReached')));
    const user = userEvent.setup();
    renderList();

    const alert = await openDialogAndConfirm(user);

    expect(alert).toHaveTextContent(/groom roster is full/i);
    expect(alert).not.toHaveTextContent(/balance|funds/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    // The dialog stays open on the same groom so the player can cancel or retry.
    expect(within(screen.getByTestId('hire-modal')).getByText(/Sarah/)).toBeInTheDocument();
  });

  it('a short balance is named as a short balance, not as a full roster', async () => {
    server.use(http.post(HIRE, () => refusal(400, 'insufficientFunds')));
    const user = userEvent.setup();
    renderList();

    const alert = await openDialogAndConfirm(user);

    expect(alert).toHaveTextContent(/balance/i);
    expect(alert).not.toHaveTextContent(/roster/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a 400 without a code still says the roster may be full or the balance short', async () => {
    server.use(http.post(HIRE, () => refusal(400)));
    const user = userEvent.setup();
    renderList();

    const alert = await openDialogAndConfirm(user);

    expect(alert).toHaveTextContent(/roster/i);
    expect(alert).toHaveTextContent(/balance/i);
  });

  it('a server fault shows the shared class copy, not server text', async () => {
    server.use(http.post(HIRE, () => refusal(500)));
    const user = userEvent.setup();
    renderList();

    const alert = await openDialogAndConfirm(user);

    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a stale refusal is cleared when the dialog is opened again', async () => {
    server.use(http.post(HIRE, () => refusal(500)));
    const user = userEvent.setup();
    renderList();

    await openDialogAndConfirm(user);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await user.click(await screen.findByRole('button', { name: /hire sarah johnson/i }));

    const dialog = await screen.findByTestId('hire-modal');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});
