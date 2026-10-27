/**
 * StaffLinkedAccounts: accounts sharing a device, and busy addresses
 * (Equoria-x5n89, owner rulings q123-q126). Real hooks over the real apiClient;
 * MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffConduct from '../StaffConduct';
import { StaffFlaggedAddresses } from '../StaffLinkedAccounts';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CONDUCT = `${base}/api/v1/staff/conduct`;
const player = { id: 'p-1', username: 'Willow', role: 'user' };

describe('StaffLinkedAccounts', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrap = (node: React.ReactNode) =>
    render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);

  const stubPlayer = () =>
    server.use(
      http.post(`${CONDUCT}/lookup`, () => HttpResponse.json(player)),
      http.get(`${CONDUCT}/p-1`, () =>
        HttpResponse.json({ player, standing: { state: 'good' }, records: [] })
      )
    );

  const findWillow = async () => {
    await userEvent.type(screen.getByLabelText(/player to review/i), 'Willow');
    await userEvent.click(screen.getByRole('button', { name: /find player/i }));
  };

  it('lists the accounts on the same device under the player, staff roles named', async () => {
    stubPlayer();
    server.use(
      http.get(`${CONDUCT}/p-1/linked-accounts`, () =>
        HttpResponse.json({
          player,
          accounts: [
            {
              id: 'p-2',
              username: 'Bramble',
              role: 'moderator',
              sharedDevices: 2,
              lastSeenAt: '2026-10-20T12:00:00.000Z',
            },
          ],
        })
      )
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} canSeeLinked />);
    await findWillow();
    expect(await screen.findByText('Bramble')).toBeInTheDocument();
    expect(screen.getByText(/Moderator.*2 devices in common/)).toBeInTheDocument();
  });

  it('says so when no other account shares a device', async () => {
    stubPlayer();
    server.use(
      http.get(`${CONDUCT}/p-1/linked-accounts`, () => HttpResponse.json({ player, accounts: [] }))
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} canSeeLinked />);
    await findWillow();
    expect(
      await screen.findByText(/No other account has signed in from their devices/)
    ).toBeInTheDocument();
  });

  it('never asks for linked accounts when the viewer lacks the capability', async () => {
    stubPlayer();
    let asked = false;
    server.use(
      http.get(`${CONDUCT}/p-1/linked-accounts`, () => {
        asked = true;
        return HttpResponse.json({ player, accounts: [] });
      })
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} />);
    await findWillow();
    expect(await screen.findByText(/in good standing/i)).toBeInTheDocument();
    expect(asked).toBe(false);
    expect(screen.queryByText('Same device')).not.toBeInTheDocument();
  });

  it('lists busy addresses with their accounts', async () => {
    server.use(
      http.get(`${base}/api/v1/staff/flagged-addresses`, () =>
        HttpResponse.json({
          addresses: [
            {
              ipAddress: '203.0.113.9',
              accountCount: 5,
              accounts: [
                { id: 'a', username: 'Aspen', role: 'user' },
                { id: 'b', username: 'Birch', role: 'user' },
              ],
            },
          ],
        })
      )
    );
    wrap(<StaffFlaggedAddresses onCheckinRequired={() => undefined} />);
    expect(await screen.findByText('203.0.113.9')).toBeInTheDocument();
    expect(screen.getByText(/5 accounts/)).toBeInTheDocument();
    expect(screen.getByText('Aspen, Birch')).toBeInTheDocument();
  });

  it('says plainly when no address is busy', async () => {
    server.use(
      http.get(`${base}/api/v1/staff/flagged-addresses`, () => HttpResponse.json({ addresses: [] }))
    );
    wrap(<StaffFlaggedAddresses onCheckinRequired={() => undefined} />);
    expect(
      await screen.findByText(/No address has been seen with more than four/)
    ).toBeInTheDocument();
  });
});
