/**
 * StaffConduct: find a player, read their record, act with a reason (Equoria-w47x7)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffConduct from '../StaffConduct';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CONDUCT = `${base}/api/v1/staff/conduct`;

const player = { id: 'p-1', username: 'Willow', role: 'user' };

describe('StaffConduct', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderIt = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffConduct onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

  it('shows standing and record for a found player, and sends a freeze with its length and reason', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${CONDUCT}/lookup`, () => HttpResponse.json(player)),
      http.get(`${CONDUCT}/p-1`, () =>
        HttpResponse.json({
          player,
          standing: { state: 'good' },
          records: [
            {
              id: 1,
              kind: 'warning',
              reason: 'Rude in the forum',
              issuedByRole: 'moderator',
              freezeDays: null,
              endsAt: null,
              createdAt: '2026-10-20T12:00:00.000Z',
            },
          ],
        })
      ),
      http.post(`${CONDUCT}/p-1/freeze`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 'p-1' });
      })
    );
    const user = userEvent.setup();
    renderIt();

    await user.type(screen.getByLabelText(/Player to review/), 'Willow');
    await user.click(screen.getByRole('button', { name: 'Find player' }));

    expect(await screen.findByText(/In good standing/)).toBeInTheDocument();
    expect(screen.getByText(/Rude in the forum/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Action'), 'freeze');
    await user.selectOptions(screen.getByLabelText('For how long'), '3');
    await user.type(screen.getByLabelText(/Reason/), 'Spamming trade offers');
    await user.click(screen.getByRole('button', { name: 'Freeze' }));

    expect(await screen.findByText(/It is in the ledger/)).toBeInTheDocument();
    expect(sent).toEqual({ reason: 'Spamming trade offers', days: 3 });
  });

  it('warns about a shared connection when an IP ban is chosen, and offers lifts only to those who may', async () => {
    server.use(
      http.post(`${CONDUCT}/lookup`, () => HttpResponse.json(player)),
      http.get(`${CONDUCT}/p-1`, () =>
        HttpResponse.json({ player, standing: { state: 'good' }, records: [] })
      )
    );
    const user = userEvent.setup();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <StaffConduct onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );
    await user.type(screen.getByLabelText(/Player to review/), 'Willow');
    await user.click(screen.getByRole('button', { name: 'Find player' }));
    await screen.findByText(/In good standing/);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Action'), 'ban/ip');
    expect(screen.getByRole('note')).toHaveTextContent(/share this connection/);
    expect(screen.getByRole('note')).toHaveTextContent(/banning the device first/);
    expect(screen.queryByRole('option', { name: /Lift the freeze/ })).not.toBeInTheDocument();
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <StaffConduct onCheckinRequired={() => undefined} canLift />
      </QueryClientProvider>
    );
    await user.type(screen.getByLabelText(/Player to review/), 'Willow');
    await user.click(screen.getByRole('button', { name: 'Find player' }));
    await screen.findByText(/In good standing/);
    expect(screen.getByRole('option', { name: /Lift the freeze or ban/ })).toBeInTheDocument();
  });

  it('keeps the reason and shows the server refusal in its own words', async () => {
    server.use(
      http.post(`${CONDUCT}/lookup`, () => HttpResponse.json({ ...player, role: 'moderator' })),
      http.get(`${CONDUCT}/p-1`, () =>
        HttpResponse.json({
          player: { ...player, role: 'moderator' },
          standing: { state: 'good' },
          records: [],
        })
      ),
      http.post(`${CONDUCT}/p-1/warn`, () =>
        HttpResponse.json(
          { success: false, code: 'staffTargetStaff', message: 'internal wording' },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt();

    await user.type(screen.getByLabelText(/Player to review/), 'Willow');
    await user.click(screen.getByRole('button', { name: 'Find player' }));
    await screen.findByText(/In good standing/);
    await user.type(screen.getByLabelText(/Reason/), 'A note');
    await user.click(screen.getByRole('button', { name: 'Warn' }));

    expect(await screen.findByText('You cannot act on this account.')).toBeInTheDocument();
    expect(screen.queryByText('internal wording')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/)).toHaveValue('A note');
  });
});
