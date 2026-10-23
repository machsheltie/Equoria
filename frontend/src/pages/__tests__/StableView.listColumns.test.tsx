/**
 * StableView list view columns (Equoria-9spb2, owner ruling 2026-10-23)
 *
 * A horse has no level, so the list has no Level column. The Cooldown column
 * and the Shod chip read what GET /horses now sends (trainingCooldown,
 * lastShod). Real StableView, real hooks and API client; MSW only at the HTTP
 * boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import React from 'react';
import { server } from '@/test/msw/server';
import StableView from '../StableView';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function horseRow(overrides: Record<string, unknown>) {
  return {
    id: 7,
    name: 'Ember Glow',
    breed: 'Thoroughbred',
    sex: 'Mare',
    age: 6,
    ageYears: 6,
    dateOfBirth: '2020-01-01T00:00:00Z',
    healthStatus: 'Good',
    displayedHealth: 'Good',
    lastFedDate: new Date().toISOString(),
    speed: 70,
    stamina: 60,
    ...overrides,
  };
}

function renderListView() {
  localStorage.setItem('stableViewMode', 'list');
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <StableView />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StableView — list view columns (Equoria-9spb2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has no Level column header', async () => {
    renderListView();
    await screen.findByText('Storm Runner');
    // The list header names Horse, Top Stat, Status and Cooldown only.
    expect(screen.getByText('Top Stat')).toBeInTheDocument();
    // (The page's own player-level figure elsewhere is not a list column.)
    const header = screen.getByText('Top Stat').parentElement as HTMLElement;
    expect(within(header).queryByText('Level')).not.toBeInTheDocument();
  });

  it('reads the real Cooldown and Shod values the list now sends', async () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [horseRow({ trainingCooldown: future, lastShod: new Date().toISOString() })],
        })
      )
    );
    const user = userEvent.setup();
    renderListView();
    await screen.findByText('Ember Glow');
    await user.click(screen.getByRole('button', { name: /list view/i }));

    expect(await screen.findByText('On cooldown')).toBeInTheDocument();
    expect(screen.getByText('Cooldown')).toBeInTheDocument();
  });
});
