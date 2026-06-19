/**
 * CompetitionResultsModal behavioral test (Equoria-o5hub.34)
 *
 * The page-level test (CompetitionResultsPage.test.tsx) vi.mock()s this modal,
 * so its real rendering — sortable columns, user-row highlighting, prize
 * aggregation — had no coverage. This test exercises the REAL component.
 *
 * Data injection uses the documented `_testResults` seam (Equoria-55bo.3), NOT a
 * vi.mock of useCompetitionResults: passing `_testResults` switches the modal to
 * the explicit test-injection branch and disables the production fetch
 * (`useCompetitionResults(null)`), which is the component's own contract for
 * tests. The only network boundary that still fires is `useHorseLevelInfo` for
 * the first user horse (GET /horses/:id/xp); we satisfy it through MSW (the real
 * fetch pipeline) rather than mocking the hook — consistent with CLAUDE.md §3.
 *
 * Assertions target user-visible behavior:
 *   - sort headers reorder the visible rows (default rank, then score desc, name)
 *   - the current user's horse row gets the button affordance (highlight)
 *   - the prize-distribution + per-row prizes render the real aggregated values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import CompetitionResultsModal, { type CompetitionResults } from '../CompetitionResultsModal';

const RESULTS: CompetitionResults = {
  competitionId: 555,
  competitionName: 'TestFixture-Spring Classic',
  discipline: 'Dressage',
  date: '2026-03-15T10:00:00Z',
  totalParticipants: 3,
  prizePool: 6000,
  prizeDistribution: { first: 3000, second: 1800, third: 1200 },
  results: [
    {
      rank: 2,
      horseId: 101,
      horseName: 'Zephyr',
      ownerId: 'owner-a',
      ownerName: 'Alice',
      finalScore: 88.2,
      prizeWon: 1800,
      isCurrentUser: false,
    },
    {
      rank: 1,
      horseId: 102,
      horseName: 'Comet',
      ownerId: 'owner-me',
      ownerName: 'You',
      finalScore: 95.6,
      prizeWon: 3000,
      isCurrentUser: true,
    },
    {
      rank: 3,
      horseId: 103,
      horseName: 'Apple',
      ownerId: 'owner-b',
      ownerName: 'Bob',
      finalScore: 80.1,
      prizeWon: 1200,
      isCurrentUser: false,
    },
  ],
};

/** Satisfy useHorseLevelInfo's GET /horses/:id/xp so MSW does not 'error' it. */
function stubXpHandler() {
  return http.get('*/api/v1/horses/:horseId/xp', () =>
    HttpResponse.json({
      success: true,
      data: {
        horseId: 102,
        currentLevel: 5,
        currentXP: 120,
        availableStatPoints: 5,
        nextStatPointAt: 200,
        xpToNextStatPoint: 80,
        totalEarnedXP: 1200,
        progressPercent: 60,
      },
    })
  );
}

function renderModal(results: CompetitionResults | null = RESULTS) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CompetitionResultsModal
          isOpen
          onClose={() => {}}
          competitionId={results?.competitionId ?? 555}
          _testResults={results}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Read the visible horse-name cells in DOM order from the results table. */
function visibleHorseOrder(): string[] {
  const table = screen.getByTestId('results-table');
  return within(table)
    .getAllByTestId('horse-name')
    .map((el) => el.textContent?.trim() ?? '');
}

describe('CompetitionResultsModal — behavior (Equoria-o5hub.34)', () => {
  beforeEach(() => {
    server.use(stubXpHandler());
  });

  it('defaults to rank ascending (best horse first)', async () => {
    renderModal();
    await screen.findByTestId('results-table');
    // rank 1 = Comet, rank 2 = Zephyr, rank 3 = Apple.
    expect(visibleHorseOrder()).toEqual(['Comet', 'Zephyr', 'Apple']);
  });

  it('sorting by Score defaults to descending (highest score first)', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByTestId('results-table');

    await user.click(screen.getByTestId('sort-by-score'));

    // Comet 95.6 > Zephyr 88.2 > Apple 80.1 — descending is the score default.
    await waitFor(() => {
      expect(visibleHorseOrder()).toEqual(['Comet', 'Zephyr', 'Apple']);
    });

    // Clicking again toggles to ascending (lowest score first).
    await user.click(screen.getByTestId('sort-by-score'));
    await waitFor(() => {
      expect(visibleHorseOrder()).toEqual(['Apple', 'Zephyr', 'Comet']);
    });
  });

  it('sorting by Horse name orders alphabetically (ascending)', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByTestId('results-table');

    await user.click(screen.getByTestId('sort-by-horse'));

    await waitFor(() => {
      expect(visibleHorseOrder()).toEqual(['Apple', 'Comet', 'Zephyr']);
    });
  });

  it('highlights the current user row with the interactive button affordance', async () => {
    renderModal();
    await screen.findByTestId('results-table');

    // The user's horse (Comet, id 102) row is a clickable button with an
    // accessible "View performance" label; the others are plain rows.
    const userRow = screen.getByTestId('result-row-102');
    expect(userRow).toHaveAttribute('role', 'button');
    expect(userRow).toHaveAttribute('aria-label', expect.stringContaining('Comet'));

    const otherRow = screen.getByTestId('result-row-101');
    expect(otherRow).not.toHaveAttribute('role', 'button');
  });

  it('renders the real prize-pool distribution and per-row prize aggregation', async () => {
    renderModal();
    await screen.findByTestId('results-table');

    // Prize distribution block reflects the injected 50/30/20 split of 6000.
    const dist = screen.getByTestId('prize-distribution');
    expect(within(dist).getByText('Prize Pool:').parentElement).toHaveTextContent('6,000');
    expect(within(within(dist).getByTestId('prize-1st')).getByText('3,000')).toBeInTheDocument();
    expect(within(within(dist).getByTestId('prize-2nd')).getByText('1,800')).toBeInTheDocument();
    expect(within(within(dist).getByTestId('prize-3rd')).getByText('1,200')).toBeInTheDocument();

    // Per-row prize values map to each finisher's winnings.
    const table = screen.getByTestId('results-table');
    const cometRow = within(table).getByTestId('result-row-102');
    expect(within(cometRow).getByTestId('prize-value')).toHaveTextContent('3,000');
  });

  it('aggregates the current user prizes into the prize summary card (top-3 user finishes)', async () => {
    renderModal();
    const card = await screen.findByTestId('prize-summary-card');

    // Comet (current user) placed 1st → the user prize summary surfaces and the
    // aggregated total reflects the real 3,000-coin win (proves the modal
    // computed userPrizes from the injected results, not a placeholder).
    expect(within(card).getByTestId('total-prize-money')).toHaveTextContent('3,000');
    // The per-horse breakdown reveals the winning horse name once expanded.
    const user = userEvent.setup();
    await user.click(within(card).getByTestId('expand-toggle'));
    await waitFor(() => {
      const entry = within(card).getByTestId('horse-prize-entry');
      expect(entry).toHaveTextContent('Comet');
      expect(entry).toHaveTextContent(/1st Place/i);
    });
  });

  it('does NOT show the prize summary card when the user placed outside the top 3', async () => {
    // Demote the current user (Comet) below 3rd; no other user finishers.
    renderModal({
      ...RESULTS,
      results: RESULTS.results.map((r) => (r.horseId === 102 ? { ...r, rank: 8, prizeWon: 0 } : r)),
    });
    await screen.findByTestId('results-table');
    expect(screen.queryByTestId('prize-summary-card')).not.toBeInTheDocument();
  });

  it('shows the empty state honestly when there are zero results', async () => {
    renderModal({ ...RESULTS, results: [], totalParticipants: 0 });
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('results-table')).not.toBeInTheDocument();
  });
});
