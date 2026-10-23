/**
 * HorseDetailPage Feed-Button Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive tests that the check FIRES.
 * Verifies the three feed-button disabled-reason cases that gate the
 * action-feed button on HorseDetailPage:
 *   1. No feed equipped   → "No feed selected. Click Equip first."
 *   2. Already fed today  → "Fed today. Available again at midnight Eastern time."
 *      "Today" is the Eastern game day (owner ruling 2026-10-09), not UTC.
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

  it('shows "Fed today" when lastFedDate is on today\'s Eastern game day', async () => {
    // 10 PM Eastern on Oct 9 is already Oct 10 in UTC. A feed at 10 AM
    // Eastern the same day is "today" on the game clock (a UTC reading
    // would wrongly re-enable the button).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T02:00:00Z'));
    try {
      global.fetch = createFetchMock({
        ...BASE_HORSE,
        equippedFeedType: 'basic',
        lastFedDate: '2026-10-09T14:00:00Z',
        feedHealth: 'Excellent',
      });
      renderPage(5);

      await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

      const feedBtn = screen.getByTestId('action-feed');
      expect(feedBtn.getAttribute('title')).toBe(
        'Fed today. Available again at midnight Eastern time.'
      );
      expect(feedBtn).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  // Owner ruling 2026-10-23 (Equoria-qwz60): hunger is a fill bar. Below Excellent a
  // horse can be fed again the same Eastern game day (old contract: fed today = refused).
  it('keeps Feed enabled when the horse was fed today but its hunger is below Excellent', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T02:00:00Z'));
    try {
      global.fetch = createFetchMock({
        ...BASE_HORSE,
        equippedFeedType: 'basic',
        lastFedDate: '2026-10-09T14:00:00Z',
        feedHealth: 'Fair',
      });
      renderPage(5);

      await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

      const feedBtn = screen.getByTestId('action-feed');
      expect(feedBtn.getAttribute('title')).toBe('Feed this horse');
      expect(feedBtn).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
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
    // Two days back is never today's Eastern game day, DST included.
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString();
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
