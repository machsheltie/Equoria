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
 *   - no row offers a score breakdown or temperament line (owner ruling R5,
 *     Equoria-q4uem.10); unrecorded values show a dash, never 0
 *   - the prize-distribution + per-row prizes render the real aggregated values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import React from 'react';
import CompetitionResultsModal from '../CompetitionResultsModal';
import type { CompetitionResults, ParticipantResult } from '@/lib/api/competitionResults';

const RECORD = { horsePointsAwarded: null, statGain: null, conformationAward: null };

const RESULTS: CompetitionResults = {
  competitionId: 555,
  competitionName: 'TestFixture-Spring Classic',
  discipline: 'Dressage',
  showType: 'ridden',
  date: '2026-03-15T10:00:00Z',
  totalParticipants: 3,
  prizePool: 6000,
  prizeDistribution: { first: 3000, second: 1800, third: 1200 },
  results: [
    {
      rank: 2,
      horseId: 101,
      horseName: 'Zephyr',
      ownerName: 'Alice',
      finalScore: 88.2,
      prizeWon: 1800,
      isCurrentUser: false,
      ...RECORD,
    },
    {
      rank: 1,
      horseId: 102,
      horseName: 'Comet',
      ownerName: 'You',
      finalScore: 95.6,
      prizeWon: 3000,
      isCurrentUser: true,
      ...RECORD,
    },
    {
      rank: 3,
      horseId: 103,
      horseName: 'Apple',
      ownerName: 'Bob',
      finalScore: 80.1,
      prizeWon: 1200,
      isCurrentUser: false,
      ...RECORD,
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

  // Owner ruling R5 (2026-10-15): no score breakdown is shown to anyone. Old
  // contract: the user's row was a "View performance" button opening a breakdown.
  it('offers no score breakdown from any row, the player’s own included', async () => {
    renderModal();
    await screen.findByTestId('results-table');

    for (const id of [101, 102, 103]) {
      expect(screen.getByTestId(`result-row-${id}`)).not.toHaveAttribute('role', 'button');
    }
    expect(screen.queryByRole('button', { name: /view performance/i })).not.toBeInTheDocument();
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

  // Owner ruling R5: temperament's effect is part of the score, never itemised.
  // Old contract: a "Bold: +5% (ridden score)" chip under the horse name.
  it('shows no temperament line on any row', async () => {
    renderModal();
    await screen.findByTestId('results-table');

    expect(screen.queryByText(/temperament/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ridden score/i)).not.toBeInTheDocument();
  });

  it('shows a dash, not 0, for a podium place nobody took', async () => {
    renderModal({
      ...RESULTS,
      totalParticipants: 2,
      prizeDistribution: { first: 3000, second: 1800, third: null },
      results: RESULTS.results.filter((r) => r.rank !== 3),
    });
    const dist = await screen.findByTestId('prize-distribution');

    // Label, share, then the amount: a dash where a coin figure would be.
    expect(within(dist).getByTestId('prize-3rd')).toHaveTextContent(/^3rd20%—$/);
  });

  it('shows no prize pool and no prize amount for a conformation show', async () => {
    const ribbonRow: ParticipantResult = {
      ...RESULTS.results[1],
      prizeWon: null,
      conformationAward: { ribbon: 'Blue', titlePoints: 10 },
    };
    renderModal({
      ...RESULTS,
      discipline: 'conformation',
      showType: 'conformation',
      prizePool: null,
      prizeDistribution: null,
      totalParticipants: 1,
      results: [ribbonRow],
    });
    await screen.findByTestId('results-table');

    expect(screen.queryByTestId('prize-distribution')).not.toBeInTheDocument();
    expect(screen.getByTestId('prize-value')).toHaveTextContent('—');
    expect(screen.queryByTestId('prize-summary-card')).not.toBeInTheDocument();
  });
});
