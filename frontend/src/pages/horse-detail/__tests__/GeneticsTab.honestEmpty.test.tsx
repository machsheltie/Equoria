/**
 * The Genetics tab tells the truth about a horse with no traits (Equoria-kjlub).
 *
 * A horse with ZERO traits rendered the green "All Traits Discovered!
 * Congratulations!" banner (a vacuous 0-of-0) directly above "No traits match
 * the current filters" even though no filter was set. Praise for finishing
 * nothing is fabricated; the emptiness was also blamed on filters.
 *
 * Real GeneticsTab and hooks; the API is answered by MSW.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import GeneticsTab from '../GeneticsTab';
import type { Horse } from '../HorseDetailPageTypes';
import { server } from '@/test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = {
  id: 77,
  name: 'TestFixture-Genetics',
  breed: 'Thoroughbred',
  age: 4,
  gender: 'Mare',
  dateOfBirth: '2022-01-01T00:00:00.000Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
} as unknown as Horse;

function stubTraits(visibleNames: string[], hiddenCount: number) {
  server.use(
    http.get(`${base}/api/v1/horses/77/epigenetic-insights`, () =>
      HttpResponse.json({ success: true, data: { traitAnalysis: { traits: visibleNames } } })
    ),
    http.get(`${base}/api/v1/horses/77/trait-timeline`, () =>
      HttpResponse.json({ success: true, data: { timeline: [] } })
    ),
    http.get(`${base}/api/v1/traits/horse/77`, () =>
      HttpResponse.json({
        success: true,
        data: {
          traits: {
            positive: visibleNames.map((name) => ({ name, definition: { type: 'positive' } })),
            negative: [],
            hiddenCount,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/traits/discovery-status/77`, () =>
      HttpResponse.json({
        success: true,
        data: { traitCounts: { visible: visibleNames.length, hidden: hiddenCount } },
      })
    )
  );
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GeneticsTab horse={horse} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GeneticsTab — honest states (Equoria-kjlub)', () => {
  it('does not congratulate a horse that has no traits, nor blame filters', async () => {
    stubTraits([], 0);
    renderTab();

    expect(await screen.findByText(/no traits discovered yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/all traits discovered/i)).toBeNull();
    expect(screen.queryByText(/congratulations/i)).toBeNull();
    expect(screen.queryByText(/no traits match the current filters/i)).toBeNull();
  });

  it('still celebrates when every trait the horse has is discovered', async () => {
    stubTraits(['resilient'], 0);
    renderTab();

    expect(await screen.findByText(/all traits discovered/i)).toBeInTheDocument();
    expect(screen.queryByText(/no traits discovered yet/i)).toBeNull();
  });

  it('only blames the filters when they exclude traits the horse really has', async () => {
    stubTraits(['resilient'], 0);
    const user = userEvent.setup();
    renderTab();
    await screen.findByText(/all traits discovered/i);
    expect(screen.queryByText(/no traits match the current filters/i)).toBeNull();

    // Rarity 'legendary' excludes the single common trait.
    await user.selectOptions(screen.getByLabelText(/rarity/i), 'legendary');
    expect(await screen.findByText(/no traits match the current filters/i)).toBeInTheDocument();
  });
});
