/**
 * RiderDiscoveryPanel — a hired rider's discoveries come from the real discovery read
 * (Equoria-xlw03, audit STAFF-08). Before, the dashboard always passed an empty
 * placeholder profile and the panel printed a "competitions to the next reveal" hint;
 * owner rulings 2026-10-28 (q160) removed the hint and reveal by level.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import RiderDiscoveryPanel from '../RiderDiscoveryPanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function renderPanel(riderId: number) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RiderDiscoveryPanel riderId={riderId} />
    </QueryClientProvider>
  );
}

const novice = {
  riderId: 41,
  starLevel: 'novice',
  stars: 2,
  levelLabel: 'Novice',
  personality: 'daring',
  totalItems: 12,
  revealedCount: 3,
  categories: [
    {
      label: 'Horse traits',
      total: 4,
      revealed: [{ label: 'Eager Learner', sign: 'positive', note: 'Strength' }],
    },
    {
      label: 'Disciplines',
      total: 4,
      revealed: [{ label: 'Show Jumping', sign: 'negative', note: 'Weakness' }],
    },
    {
      label: 'Temperaments',
      total: 2,
      revealed: [{ label: 'Calm', sign: 'positive', note: 'Strength' }],
    },
    { label: 'Favorite breeds', total: 2, revealed: [] },
  ],
};

describe('RiderDiscoveryPanel (Equoria-xlw03)', () => {
  it("shows the rider's revealed items from the discovery read, and no next-reveal hint", async () => {
    server.use(
      http.get(`${base}/api/v1/riders/41/discovery`, () =>
        HttpResponse.json({ success: true, message: 'ok', data: novice })
      )
    );
    renderPanel(41);

    const panel = await screen.findByTestId('rider-discovery-panel');
    expect(within(panel).getByText('3 / 12 revealed')).toBeInTheDocument();
    expect(within(panel).getByText('Eager Learner')).toBeInTheDocument();
    expect(within(panel).getByText('Show Jumping')).toBeInTheDocument();
    expect(within(panel).getByText('Calm')).toBeInTheDocument();
    expect(within(panel).getAllByText('Not yet discovered')).toHaveLength(9);
    expect(within(panel).queryByText(/more competition/i)).not.toBeInTheDocument();
  });

  it('shows an error line when the discovery read fails', async () => {
    server.use(
      http.get(`${base}/api/v1/riders/42/discovery`, () =>
        HttpResponse.json({ success: false, message: 'nope' }, { status: 500 })
      )
    );
    renderPanel(42);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('rider-discovery-panel')).not.toBeInTheDocument();
  });
});
