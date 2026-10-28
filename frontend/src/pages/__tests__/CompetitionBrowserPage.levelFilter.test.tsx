/**
 * The Ridden tab searches shows by level (Equoria-i33ow, owner request
 * 2026-10-28).
 *
 * Levels run 1 to 20. Choosing a level asks the server for the shows open to
 * that level (GET /api/v1/competition?level=N); All Levels and Clear Filters ask
 * for every open show again.
 *
 * Real page, hooks and apiClient; the API is answered by MSW, which answers the
 * level query the way the server does (a show is listed when its levelMin..levelMax
 * bracket holds the level).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const runDate = new Date(Date.now() + 5 * 24 * 3_600_000).toISOString();

function show(id: number, name: string, levelMin: number, levelMax: number) {
  return {
    id,
    name,
    discipline: 'Dressage',
    showType: 'ridden',
    runDate,
    closeDate: runDate,
    prizePool: 100,
    entryFee: 10,
    status: 'open',
    levelMin,
    levelMax,
  };
}

const SHOWS = [
  show(1, 'Silverbrook Novice Cup', 2, 2),
  show(2, 'Highmeadow Masters', 14, 14),
  show(3, 'Lantern Hill Open', 1, 999),
];

let requestedLevels: (string | null)[] = [];

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/competitions']}>
          <CompetitionBrowserPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

async function cardNames(): Promise<string[]> {
  const panel = await screen.findByTestId('ridden-tab-panel');
  return within(panel)
    .queryAllByTestId('competition-card')
    .map((card) => card.textContent ?? '');
}

describe('CompetitionBrowserPage — search by level (Equoria-i33ow)', () => {
  beforeEach(() => {
    requestedLevels = [];
    server.use(
      http.get(`${base}/api/v1/competition`, ({ request }) => {
        const level = new URL(request.url).searchParams.get('level');
        requestedLevels.push(level);
        const wanted = level === null ? null : Number(level);
        const data =
          wanted === null
            ? SHOWS
            : SHOWS.filter((s) => s.levelMin <= wanted && s.levelMax >= wanted);
        return HttpResponse.json({ success: true, data });
      })
    );
  });

  it('offers All Levels and every level from 1 to 20', async () => {
    renderPage();
    const select = await screen.findByTestId('filter-level');
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'All Levels',
      ...Array.from({ length: 20 }, (_, i) => `Level ${i + 1}`),
    ]);
  });

  it('choosing a level asks the server for that level and lists only its shows', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Highmeadow Masters');

    await user.selectOptions(screen.getByTestId('filter-level'), '14');

    await waitFor(async () => {
      const names = await cardNames();
      expect(names).toHaveLength(2);
    });
    const names = await cardNames();
    expect(names.some((n) => n.includes('Highmeadow Masters'))).toBe(true);
    expect(names.some((n) => n.includes('Lantern Hill Open'))).toBe(true);
    expect(names.some((n) => n.includes('Silverbrook Novice Cup'))).toBe(false);
    expect(requestedLevels).toContain('14');
  });

  it('Clear Filters returns to every open show', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Highmeadow Masters');
    await user.selectOptions(screen.getByTestId('filter-level'), '2');
    await waitFor(async () => expect(await cardNames()).toHaveLength(2));

    await user.click(screen.getByTestId('filter-clear'));

    await waitFor(async () => expect(await cardNames()).toHaveLength(3));
    expect(screen.getByTestId('filter-level')).toHaveValue('all');
  });
});
