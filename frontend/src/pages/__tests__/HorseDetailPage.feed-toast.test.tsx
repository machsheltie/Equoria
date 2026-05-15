/**
 * HorseDetailPage Feed-Toast Suffix Tests (Equoria-ap38)
 *
 * Locks the merged-toast suffix logic at HorseDetailPage.tsx:805-811 — the
 * primary deliverable of spec-feed-stat-gain-notifications.md whose first AC
 * reads:
 *   "Given a horse fed with performance+ feed and statBoost fires, when feed
 *    completes, then a single toast reads
 *    'Fed [Name] with [Feed]. [N] units left. +1 [Stat]!'"
 *
 * Coverage:
 *   1. statBoost present  → toast text includes ' +1 [Stat]!' suffix, duration 5000ms
 *   2. statBoost null     → toast text has NO suffix, duration 3000ms
 *   3. Different stat name → capitalization handles arbitrary stats (sentinel
 *      against hardcoding 'Speed')
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2 sentinel: a regression that replaced the
 * statSuffix template with the wrong stat name, dropped the +1, or used the
 * 3000ms duration when statBoost is set would fail these assertions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../test/utils';
import React from 'react';

// Capture toast.success / toast.error / toast.info calls.
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

// Mock useFeedHorse to return a controllable mutate.
const mockMutate = vi.fn();
vi.mock('../../hooks/api/useFeedHorse', () => ({
  useFeedHorse: () => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  }),
}));

import HorseDetailPage from '../HorseDetailPage';

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
  equippedFeedType: 'performance',
  // yesterday so feed button is enabled
  lastFedDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  feedHealth: 'good',
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

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  toastInfo.mockClear();
  mockMutate.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('HorseDetailPage — feed toast statBoost suffix (Equoria-ap38)', () => {
  it('statBoost.stat=speed → toast text includes " +1 Speed!" suffix, 5000ms duration', async () => {
    global.fetch = createFetchMock(BASE_HORSE);
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    const feedBtn = screen.getByTestId('action-feed');
    expect(feedBtn).not.toBeDisabled();

    // Simulate the mutation response — a successful feed with a stat boost.
    mockMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        skipped: null,
        horse: { id: 5, name: 'Comet', lastFedDate: '2026-05-15', equippedFeedType: 'performance' },
        feed: { name: 'Performance Feed', tier: 'performance' },
        remainingUnits: 12,
        statBoost: { stat: 'speed', amount: 1 },
      });
    });

    fireEvent.click(feedBtn);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));

    const [text, opts] = toastSuccess.mock.calls[0] as [string, { duration?: number }];
    // Exact AC: 'Fed [Name] with [Feed]. [N] units left. +1 [Stat]!'
    expect(text).toBe('Fed Comet with Performance Feed. 12 units left. +1 Speed!');
    // Longer duration when stat boost happened so player notices.
    expect(opts?.duration).toBe(5000);
  });

  it('statBoost=null → toast has NO suffix, 3000ms duration', async () => {
    global.fetch = createFetchMock(BASE_HORSE);
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    mockMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        skipped: null,
        horse: { id: 5, name: 'Comet', lastFedDate: '2026-05-15', equippedFeedType: 'basic' },
        feed: { name: 'Basic Feed', tier: 'basic' },
        remainingUnits: 8,
        statBoost: null,
      });
    });

    fireEvent.click(screen.getByTestId('action-feed'));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));

    const [text, opts] = toastSuccess.mock.calls[0] as [string, { duration?: number }];
    // No suffix — must end with "units left." and NO " +1 Foo!" tail.
    expect(text).toBe('Fed Comet with Basic Feed. 8 units left.');
    expect(text).not.toMatch(/\+1/);
    expect(opts?.duration).toBe(3000);
  });

  it('arbitrary stat name capitalizes correctly (statBoost.stat=stamina → "Stamina")', async () => {
    // Sentinel against a regression that hardcodes the stat name to 'Speed'
    // or fails to capitalize the first letter.
    global.fetch = createFetchMock(BASE_HORSE);
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    mockMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        skipped: null,
        horse: { id: 5, name: 'Comet', lastFedDate: '2026-05-15', equippedFeedType: 'elite' },
        feed: { name: 'Elite Feed', tier: 'elite' },
        remainingUnits: 3,
        statBoost: { stat: 'stamina', amount: 1 },
      });
    });

    fireEvent.click(screen.getByTestId('action-feed'));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));

    const [text] = toastSuccess.mock.calls[0] as [string, unknown];
    expect(text).toBe('Fed Comet with Elite Feed. 3 units left. +1 Stamina!');
  });

  it('result.skipped === "retired" → toast.info, NOT toast.success', async () => {
    global.fetch = createFetchMock(BASE_HORSE);
    renderPage(5);

    await waitFor(() => expect(screen.getByText('Comet')).toBeInTheDocument());

    mockMutate.mockImplementation((_input, opts) => {
      opts?.onSuccess?.({
        skipped: 'retired',
        horse: { id: 5, name: 'Comet' },
      });
    });

    fireEvent.click(screen.getByTestId('action-feed'));

    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();

    const [text] = toastInfo.mock.calls[0] as [string];
    expect(text).toBe("Comet is retired and doesn't need to be fed.");
  });
});
