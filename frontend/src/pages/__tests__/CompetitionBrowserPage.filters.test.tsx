/**
 * The Ridden tab's discipline / date / entry-fee filters change the list
 * (Equoria-oey96.12).
 *
 * The filter state used to flow only into the controlled inputs: the list was
 * handed the raw competitions, so choosing a filter did nothing. Entry fees were
 * also labelled in dollars although the game's currency is coins, and the
 * "closing in the next 24 hours" option did not exist.
 *
 * Real page, hooks and apiClient; the API is answered by MSW. Time is fixed
 * with fake Date only (timers stay real so React Query and MSW still run).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const NOW = new Date('2026-10-22T15:00:00.000Z'); // 11:00 Eastern

function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * 3_600_000).toISOString();
}

function show(
  id: number,
  name: string,
  discipline: string,
  entryFee: number,
  closesInHours: number
) {
  return {
    id,
    name,
    discipline,
    showType: 'ridden',
    runDate: hoursFromNow(closesInHours),
    closeDate: hoursFromNow(closesInHours),
    prizePool: 100,
    entryFee,
    status: 'open',
  };
}

const SHOWS = [
  show(1, 'Silverbrook Dressage Cup', 'Dressage', 0, 5),
  show(2, 'Highmeadow Jumping Classic', 'Show Jumping', 250, 30),
  show(3, 'Lantern Hill Reining', 'Reining', 800, 24 * 5),
];

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

async function visibleNames(): Promise<string[]> {
  const panel = await screen.findByTestId('ridden-tab-panel');
  await within(panel).findByText('Silverbrook Dressage Cup');
  return within(panel)
    .queryAllByTestId('competition-card')
    .map((card) => card.textContent ?? '');
}

describe('CompetitionBrowserPage — filters apply to the list (Equoria-oey96.12)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    server.use(
      http.get(`${base}/api/v1/competition`, () =>
        HttpResponse.json({ success: true, data: SHOWS })
      )
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows every open show before any filter is chosen', async () => {
    renderPage();
    expect(await visibleNames()).toHaveLength(3);
  });

  it('the discipline filter narrows the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await visibleNames();
    await user.selectOptions(screen.getByTestId('filter-discipline'), 'show-jumping');
    const cards = await within(screen.getByTestId('ridden-tab-panel')).findAllByTestId(
      'competition-card'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Highmeadow Jumping Classic');
  });

  it('the entry-fee filter narrows the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await visibleNames();
    await user.click(screen.getByTestId('filter-fee-over500'));
    const cards = await within(screen.getByTestId('ridden-tab-panel')).findAllByTestId(
      'competition-card'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Lantern Hill Reining');
  });

  it('offers "closing in the next 24 hours" and applies it to the close time', async () => {
    const user = userEvent.setup();
    renderPage();
    await visibleNames();
    await user.click(screen.getByTestId('filter-date-closing'));
    const cards = await within(screen.getByTestId('ridden-tab-panel')).findAllByTestId(
      'competition-card'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Silverbrook Dressage Cup');
  });

  // Equoria-esz55: bible vol 13 [LOCKED] lists Prize among the five filters.
  it('the prize filter narrows the list', async () => {
    // The prize is always 10x the entry fee (owner ruling 2026-10-23).
    server.use(
      http.get(`${base}/api/v1/competition`, () =>
        HttpResponse.json({
          success: true,
          data: SHOWS.map((s) => ({ ...s, prizePool: s.entryFee * 10 })),
        })
      )
    );
    const user = userEvent.setup();
    renderPage();
    await visibleNames();
    await user.click(screen.getByTestId('filter-prize-range'));
    const cards = await within(screen.getByTestId('ridden-tab-panel')).findAllByTestId(
      'competition-card'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Highmeadow Jumping Classic');
  });

  it('labels entry fees in coins, never dollars', async () => {
    renderPage();
    await visibleNames();
    const feeGroup = screen.getByRole('group', { name: /entry fee filters/i });
    expect(feeGroup.textContent).not.toContain('$');
  });

  it('says so when the filters match nothing, and Clear Filters restores the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await visibleNames();
    await user.selectOptions(screen.getByTestId('filter-discipline'), 'dressage');
    await user.click(screen.getByTestId('filter-fee-over500'));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    await user.click(screen.getByTestId('filter-clear'));
    expect(await visibleNames()).toHaveLength(3);
  });
});
