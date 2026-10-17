/**
 * The Ridden tab lists ridden shows only (Equoria-g3n8c).
 *
 * GET /api/v1/competition returns every open show, conformation included. The
 * Conformation tab filters `showType === 'conformation'` for itself, but the
 * Ridden tab handed the whole list to CompetitionList, so a conformation show
 * appeared as a ridden card. Entering it from there goes through the ridden
 * entry endpoint, which refuses conformation shows (400), so the player hit an
 * error on a show the tab should never have offered. The CI E2E entry flow
 * failed exactly that way: the first card was the seeded conformation show.
 *
 * Real component and hooks; the API is answered by MSW (no vi.mock of our
 * client, CLAUDE.md §3).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import React from 'react';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const show = (id: number, name: string, showType: 'ridden' | 'conformation') => ({
  id,
  name,
  discipline: 'Dressage',
  showType,
  date: '2026-10-30T12:00:00.000Z',
  runDate: '2026-10-30T12:00:00.000Z',
  closeDate: '2026-10-30T12:00:00.000Z',
  prizePool: 100,
  entryFee: 0,
  status: 'open',
});

function renderPage(initialEntry = '/competitions') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <CompetitionBrowserPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('CompetitionBrowserPage — Ridden tab show types (Equoria-g3n8c)', () => {
  it('offers ridden shows as cards and leaves the conformation show to its own tab', async () => {
    server.use(
      http.get(`${base}/api/v1/competition`, () =>
        HttpResponse.json({
          success: true,
          data: [
            show(1, 'Moonrise Conformation Class', 'conformation'),
            show(2, 'Silverbrook Dressage Cup', 'ridden'),
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderPage();

    const riddenPanel = await screen.findByTestId('ridden-tab-panel');
    expect(await within(riddenPanel).findByText('Silverbrook Dressage Cup')).toBeInTheDocument();
    expect(within(riddenPanel).queryByText('Moonrise Conformation Class')).toBeNull();
    expect(within(riddenPanel).getAllByTestId('competition-card')).toHaveLength(1);

    // The conformation show is still offered where it belongs.
    await user.click(screen.getByTestId('tab-conformation'));
    const conformationPanel = await screen.findByTestId('conformation-tab-panel');
    expect(
      await within(conformationPanel).findByRole('option', { name: /Moonrise Conformation Class/ })
    ).toBeInTheDocument();
  });
});
