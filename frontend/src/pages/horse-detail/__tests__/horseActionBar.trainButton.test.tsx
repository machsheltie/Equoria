/**
 * HorseActionBar — the main Train button reads "Train Horse <price>" when the horse has
 * a trainer assigned (Equoria-1poxi, owner ruling q14 2026-10-23). The price is the
 * trainer's per-session fee in the game's coin formatting. With no trainer the label is
 * "Assign Trainer" instead: owner ruling 2026-10-26 (q81) makes a trainer required to
 * train, so the bar offers the way to get one. (Old contract: the plain "Train" label.)
 * Real providers and hooks; only the network is stubbed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseActionBar from '../HorseActionBar';
import type { Horse } from '../HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ASSIGNMENTS = `${base}/api/v1/trainers/assignments`;

const horse = {
  id: 1,
  name: 'TestFixture-TrainButtonHorse',
  forSale: false,
  lastFedDate: null,
  equippedFeedType: 'oats',
  feedHealth: 'good',
} as unknown as Horse;

const assignment = (overrides = {}) => ({
  id: 5,
  trainerId: 10,
  horseId: 1,
  horseName: 'Thunder',
  trainerName: 'Alice Thornton',
  trainerPersonality: 'focused',
  trainerSessionRate: 1250,
  startDate: '2026-02-01T00:00:00Z',
  isActive: true,
  ...overrides,
});

function renderBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HorseActionBar
          horse={horse}
          onAssignRider={() => {}}
          onListForSale={() => {}}
          refetch={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseActionBar Train button (Equoria-1poxi)', () => {
  it('reads "Train Horse <price>" in coin formatting when a trainer is assigned', async () => {
    server.use(
      http.get(ASSIGNMENTS, () => HttpResponse.json({ success: true, data: [assignment()] }))
    );
    renderBar();

    const train = screen.getByTestId('action-train');
    await waitFor(() => expect(train).toHaveTextContent(/Train Horse\s*1,250/));
  });

  it('offers "Assign Trainer" in place of Train with no trainer assigned', async () => {
    server.use(http.get(ASSIGNMENTS, () => HttpResponse.json({ success: true, data: [] })));
    renderBar();

    const train = screen.getByTestId('action-train');
    await waitFor(() => expect(train).toHaveTextContent(/^Assign Trainer$/));
    expect(train).not.toHaveTextContent(/Train Horse/);
  });

  it('ignores a trainer assigned to a different horse', async () => {
    server.use(
      http.get(ASSIGNMENTS, () =>
        HttpResponse.json({ success: true, data: [assignment({ horseId: 99 })] })
      )
    );
    renderBar();

    const train = screen.getByTestId('action-train');
    await waitFor(() => expect(train).toHaveTextContent(/^Assign Trainer$/));
    expect(train).not.toHaveTextContent(/Train Horse/);
  });
});
