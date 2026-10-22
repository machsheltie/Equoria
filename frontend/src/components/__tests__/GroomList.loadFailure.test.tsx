/**
 * GroomList — an honest load failure (Equoria-ym11z; FRONTEND_ASYNC_STATE_DOCTRINE §1/§4).
 *
 * Boundary-level: the real useGroomMarketplace hook and api-client run; only the
 * network is stubbed (MSW). The defects: a failed marketplace load printed the
 * server's own message, and the error's Retry button called handleRefresh, which
 * fires the (possibly PAID) refresh mutation instead of re-reading the list.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import GroomList from '../GroomList';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MARKETPLACE = `${base}/api/v1/groom-marketplace`;
const REFRESH = `${base}/api/v1/groom-marketplace/refresh`;

const marketplace = {
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
  // A PAID refresh: spending coins from a Retry button would be the worst case.
  refreshCost: 50,
  canRefreshFree: false,
  refreshCount: 1,
};

const refusal = (status: number) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status });

function renderList() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ money: 5000 }}>
        <GroomList userId="user-1" />
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('GroomList — load failure', () => {
  it('a failed marketplace load shows class copy, never the server text', async () => {
    server.use(http.get(MARKETPLACE, () => refusal(500)));
    renderList();

    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('retry on a failed load refetches the marketplace and never asks to spend a refresh', async () => {
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

    expect(await screen.findByText(/Sarah Johnson/)).toBeInTheDocument();
    expect(gets).toBe(2);
    expect(refreshes).toBe(0);
  });
});
