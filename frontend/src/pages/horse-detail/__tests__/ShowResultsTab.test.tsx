/**
 * ShowResultsTab (Equoria-q4uem.10 A6; owner rulings C18-A, R7, R5).
 *
 * The horse's show record on its detail page: every show it was entered in,
 * upcoming first, then past shows newest first (the server's order). Columns
 * per R7: date (Eastern calendar), show, competition type, placement (podium
 * metals + ordinal text; "Upcoming" before a show runs), Horse Points,
 * winnings (a ribbon for conformation), and the owner's stat gain. Unknown
 * values show "—", never 0. No score breakdown (R5) and no "XP" anywhere.
 *
 * Real component + React Query; the network boundary is MSW on the real route
 * shape: GET /api/v1/competition/results/horse/:horseId?page&limit ->
 * { success, data: rows[], pagination }.
 */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { server } from '@/test/msw/server';
import ShowResultsTab from '../ShowResultsTab';

const HORSE_ID = 42;
const ROUTE = '*/api/v1/competition/results/horse/:horseId';

type Row = Record<string, unknown>;

function pagination(page: number, totalPages: number, total: number) {
  return {
    currentPage: page,
    pageSize: 50,
    totalRecords: total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function row(overrides: Row): Row {
  return {
    showId: 1,
    showName: 'Moonlit Dressage Classic',
    competitionType: { showType: 'ridden', discipline: 'Dressage' },
    status: 'completed',
    date: '2026-10-10T16:00:00.000Z',
    placement: null,
    horsePointsAwarded: null,
    winnings: null,
    statGain: null,
    conformationAward: null,
    ...overrides,
  };
}

const RECORD: Row[] = [
  row({
    showId: 9,
    showName: 'Harvest Moon Steeplechase',
    competitionType: { showType: 'ridden', discipline: 'Steeplechase' },
    status: 'upcoming',
    date: '2026-10-24T16:00:00.000Z',
  }),
  row({
    showId: 8,
    showName: 'Lantern Cup',
    placement: 1,
    horsePointsAwarded: 10,
    winnings: 500,
    statGain: { stat: 'intelligence', gain: 1 },
    // 03:30 UTC on Oct 17 is still Oct 16 on the Eastern game calendar.
    date: '2026-10-17T03:30:00.000Z',
  }),
  row({
    showId: 7,
    showName: 'Starfall Breed Show',
    competitionType: { showType: 'conformation', discipline: 'Dressage' },
    placement: 2,
    horsePointsAwarded: 5,
    conformationAward: { ribbon: 'Red', titlePoints: 7 },
  }),
  row({ showId: 6, showName: 'Old Lane Hunter Trial', placement: 3, horsePointsAwarded: 3 }),
  row({ showId: 5, showName: 'Quiet Meadow Open', placement: 7 }),
];

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ShowResultsTab horseId={HORSE_ID} />
    </QueryClientProvider>
  );
}

function rowFor(showName: string) {
  return screen.getByText(showName).closest('li') as HTMLElement;
}

/** The value text of each field of one entry, in column order. */
function cellsOf(entry: HTMLElement) {
  return Array.from(entry.querySelectorAll('.show-ledger__value')).map((c) =>
    c.textContent?.trim()
  );
}

/** A named list of entries, found without table markup. */
async function findLedger() {
  return screen.findByRole('list');
}

describe('ShowResultsTab', () => {
  it('shows a loading state, then the record as a list of entries', async () => {
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) })
      )
    );
    renderTab();
    expect(screen.getByText(/loading show results/i)).toBeInTheDocument();

    const ledger = await findLedger();
    // Server order is kept: upcoming first, then newest first.
    const names = within(ledger)
      .getAllByRole('listitem')
      .map((li) => cellsOf(li)[1]);
    expect(names).toEqual([
      'Harvest Moon Steeplechase',
      'Lantern Cup',
      'Starfall Breed Show',
      'Old Lane Hunter Trial',
      'Quiet Meadow Open',
    ]);
    // Every entry labels each of its fields for assistive tech.
    const labels = Array.from(
      within(ledger).getAllByRole('listitem')[0].querySelectorAll('.show-ledger__label')
    ).map((l) => l.textContent);
    expect(labels).toEqual([
      'Date',
      'Show',
      'Type',
      'Placement',
      'Horse Points',
      'Winnings',
      'Stat gained',
    ]);
  });

  it('stacks on a phone: no table, no sideways scroller, a phone layout in the stylesheet', async () => {
    window.innerWidth = 390;
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) })
      )
    );
    const { container } = renderTab();
    await findLedger();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(container.querySelector('.show-ledger__scroller')).toBeNull();
    // jsdom applies no layout, so the stacking itself is pinned in the source:
    // a max-width 767px block that re-areas each entry and never scrolls.
    const css = fs.readFileSync(path.resolve(__dirname, '../ShowResultsTab.css'), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
    expect(phone).toContain('grid-template-areas');
    expect(phone).toContain("'show show'");
    expect(css).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    expect(css).not.toContain('position: sticky');
  });

  it('renders each column as the owner should read it', async () => {
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) })
      )
    );
    renderTab();
    await findLedger();

    const cells = (name: string) => cellsOf(rowFor(name));

    // Upcoming: placement says so; nothing else is known yet.
    expect(cells('Harvest Moon Steeplechase')).toEqual([
      'Oct 24, 2026',
      'Harvest Moon Steeplechase',
      'Steeplechase',
      'Upcoming',
      '—',
      '—',
      '—',
    ]);
    // Eastern calendar date; 1st with Horse Points, coins and the stat gain.
    expect(cells('Lantern Cup')).toEqual([
      'Oct 16, 2026',
      'Lantern Cup',
      'Dressage',
      '1st',
      '10',
      '500',
      '+1 Intelligence',
    ]);
    // Conformation: its own type and the ribbon in place of coins.
    expect(cells('Starfall Breed Show')).toEqual([
      'Oct 10, 2026',
      'Starfall Breed Show',
      'Conformation',
      '2nd',
      '5',
      'Red ribbon',
      '—',
    ]);
    // Unknown values are "—", never 0.
    expect(cells('Quiet Meadow Open')).toEqual([
      'Oct 10, 2026',
      'Quiet Meadow Open',
      'Dressage',
      '7th',
      '—',
      '—',
      '—',
    ]);
  });

  it('marks the podium with metal and ordinal text, never colour alone', async () => {
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) })
      )
    );
    renderTab();
    await findLedger();
    expect(within(rowFor('Lantern Cup')).getByText('1st')).toHaveAttribute('data-podium', 'gold');
    expect(within(rowFor('Starfall Breed Show')).getByText('2nd')).toHaveAttribute(
      'data-podium',
      'silver'
    );
    expect(within(rowFor('Old Lane Hunter Trial')).getByText('3rd')).toHaveAttribute(
      'data-podium',
      'bronze'
    );
    expect(within(rowFor('Quiet Meadow Open')).getByText('7th')).not.toHaveAttribute('data-podium');
  });

  it('never shows "XP" or a score breakdown', async () => {
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) })
      )
    );
    const { container } = renderTab();
    await findLedger();
    expect(container.textContent).not.toMatch(/\bXP\b/);
    expect(container.textContent).not.toMatch(/score/i);
  });

  it('shows the empty state only after a successful empty response', async () => {
    server.use(
      http.get(ROUTE, () =>
        HttpResponse.json({ success: true, data: [], pagination: pagination(1, 0, 0) })
      )
    );
    renderTab();
    expect(await screen.findByText('No shows entered yet')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that refetches for real', async () => {
    let calls = 0;
    server.use(
      http.get(ROUTE, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
          : HttpResponse.json({ success: true, data: RECORD, pagination: pagination(1, 1, 5) });
      })
    );
    renderTab();
    const retry = await screen.findByRole('button', { name: /try again/i });
    expect(screen.queryByText('No shows entered yet')).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(await findLedger()).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('pages 50 at a time with Previous and Next', async () => {
    const requested: string[] = [];
    server.use(
      http.get(ROUTE, ({ request }) => {
        const url = new URL(request.url);
        requested.push(`${url.searchParams.get('page')}/${url.searchParams.get('limit')}`);
        const page = Number(url.searchParams.get('page'));
        return HttpResponse.json({
          success: true,
          data: [row({ showId: page, showName: `Page ${page} show` })],
          pagination: pagination(page, 2, 51),
        });
      })
    );
    renderTab();
    await screen.findByText('Page 1 show');
    const previous = screen.getByRole('button', { name: /previous/i });
    const next = screen.getByRole('button', { name: /next/i });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);
    await screen.findByText('Page 2 show');
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeDisabled());
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();
    expect(requested).toEqual(['1/50', '2/50']);
  });
});
