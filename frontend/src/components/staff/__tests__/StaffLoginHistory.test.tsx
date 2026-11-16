/**
 * StaffLoginHistory: a player's sign-ins and the accounts on the same address
 * (Equoria-puj1e.4, owner ruling q102). Real hooks over the real apiClient;
 * MSW stubs the HTTP boundary.
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

describe('StaffLoginHistory', () => {
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

  it('lists the sign-ins by numbered device and the accounts on the same address', async () => {
    stubPlayer();
    server.use(
      http.get(`${CONDUCT}/p-1/login-history`, () =>
        HttpResponse.json({
          player,
          sightings: [
            {
              ipAddress: '198.51.100.7',
              device: 2,
              firstSeenAt: '2026-10-18T12:00:00.000Z',
              lastSeenAt: '2026-10-20T12:00:00.000Z',
            },
          ],
          sameAddress: [
            {
              id: 'p-2',
              username: 'Bramble',
              role: 'moderator',
              sharedAddresses: ['198.51.100.7'],
              lastSeenAt: '2026-10-19T12:00:00.000Z',
            },
          ],
        })
      )
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} canSeeIdentity />);
    await findWillow();
    expect(await screen.findByText('Where they sign in from')).toBeInTheDocument();
    expect(screen.getByText(/on device 2, first seen/)).toBeInTheDocument();
    expect(screen.getByText('Bramble')).toBeInTheDocument();
    expect(screen.getByText(/Moderator.*on 198\.51\.100\.7, last seen/)).toBeInTheDocument();
  });

  it('says plainly when there are no sign-ins and no shared address', async () => {
    stubPlayer();
    server.use(
      http.get(`${CONDUCT}/p-1/login-history`, () =>
        HttpResponse.json({ player, sightings: [], sameAddress: [] })
      )
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} canSeeIdentity />);
    await findWillow();
    expect(await screen.findByText(/No sign-ins in the last 90 days/)).toBeInTheDocument();
    expect(
      screen.getByText(/No other account has signed in from their addresses/)
    ).toBeInTheDocument();
  });

  it('shows the server refusal instead of the history', async () => {
    stubPlayer();
    server.use(
      http.get(`${CONDUCT}/p-1/login-history`, () =>
        HttpResponse.json(
          { success: false, message: 'Staff capability required', code: 'staffCapabilityRequired' },
          { status: 403 }
        )
      )
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} canSeeIdentity />);
    await findWillow();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Where they sign in from')).not.toBeInTheDocument();
  });

  it('never asks for the history when the viewer lacks the capability', async () => {
    stubPlayer();
    let asked = false;
    server.use(
      http.get(`${CONDUCT}/p-1/login-history`, () => {
        asked = true;
        return HttpResponse.json({ player, sightings: [], sameAddress: [] });
      })
    );
    wrap(<StaffConduct onCheckinRequired={() => undefined} />);
    await findWillow();
    expect(await screen.findByText(/in good standing/i)).toBeInTheDocument();
    expect(asked).toBe(false);
    expect(screen.queryByText('Where they sign in from')).not.toBeInTheDocument();
  });
});
