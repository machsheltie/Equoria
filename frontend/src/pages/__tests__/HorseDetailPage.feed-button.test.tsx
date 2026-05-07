/**
 * HorseDetailPage Feed-Button Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive tests that the check FIRES.
 * Verifies the three feed-button disabled-reason cases that gate the
 * action-feed button on HorseDetailPage:
 *   1. No feed equipped   → "No feed selected. Click Equip first."
 *   2. Already fed today  → "Fed today. Available again at UTC midnight."
 *   3. Horse is retired   → "Retired."
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../test/utils';
import HorseDetailPage from '../HorseDetailPage';
import React from 'react';

const originalFetch = global.fetch;

const BASE_HORSE = {
  id: 5,
  name: 'Comet',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Mare',
  sex: 'Mare',
  dateOfBirth: '2020-01-01',
  healthStatus: 'good',
  imageUrl: null,
  stats: {
    precision: 50,
    strength: 50,
    speed: 50,
    agility: 50,
    endurance: 50,
    intelligence: 50,
    stamina: 50,
    balance: 50,
    boldness: 50,
    flexibility: 50,
    obedience: 50,
    focus: 50,
  },
  disciplineScores: {},
  traits: [],
  description: null,
  forSale: false,
  salePrice: null,
  userId: '1',
  parentIds: null,
  tack: null,
  finalDisplayColor: null,
  inFoalSinceDate: null,
  pregnancySireId: null,
  pregnancyFeedingsByTier: {},
};

const createFetchMock = (horseData: Record<string, unknown>) =>
  vi.fn(((url: string) => {
    const urlStr = typeof url === 'string' ? url : String(url);
    if (urlStr.includes('/epigenetic-insights'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { traits: [] } }),
      } as Response);
    if (urlStr.includes('/trait-interactions'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { interactions: [] } }),
      } as Response);
    if (urlStr.includes('/trait-timeline'))
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { timeline: [] } }),
      } as Response);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: horseData }),
    } as Response);
  }) as typeof fetch);

function renderPage(horseId: number) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  window.history.pushState({}, 'Test', `/horses/${horseId}`);
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/horses/:id" element={<HorseDetailPage />} />
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('HorseDetailPage — feed button disabled-reason', () => {
  it('shows "No feed selected" when equippedFeedType is null', async () => {
    global.fetch = createFetchMock({
      ...BASE_HORSE,
      equippedFeedType: null,
      lastFedDate: null,
      feedHealth: null,
    });
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    const feedBtn = screen.getByTestId('action-feed');
    expect(feedBtn).toBeInTheDocument();
    expect(feedBtn.getAttribute('title')).toBe('No feed selected. Click Equip first.');
    expect(feedBtn).toBeDisabled();
  });

  it('shows "Fed today" when lastFedDate is today\'s UTC date', async () => {
    const today = new Date().toISOString().slice(0, 10);
    global.fetch = createFetchMock({
      ...BASE_HORSE,
      equippedFeedType: 'basic',
      lastFedDate: today,
      feedHealth: 'good',
    });
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    const feedBtn = screen.getByTestId('action-feed');
    expect(feedBtn.getAttribute('title')).toBe('Fed today. Available again at UTC midnight.');
    expect(feedBtn).toBeDisabled();
  });

  it('shows "Retired." when feedHealth is retired', async () => {
    global.fetch = createFetchMock({
      ...BASE_HORSE,
      equippedFeedType: 'basic',
      lastFedDate: null,
      feedHealth: 'retired',
    });
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    const feedBtn = screen.getByTestId('action-feed');
    expect(feedBtn.getAttribute('title')).toBe('Retired.');
    expect(feedBtn).toBeDisabled();
  });

  it('is enabled with "Feed this horse" title when feed is equipped and not yet fed today', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    global.fetch = createFetchMock({
      ...BASE_HORSE,
      equippedFeedType: 'basic',
      lastFedDate: yesterday,
      feedHealth: 'good',
    });
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    const feedBtn = screen.getByTestId('action-feed');
    expect(feedBtn.getAttribute('title')).toBe('Feed this horse');
    expect(feedBtn).not.toBeDisabled();
  });
});
