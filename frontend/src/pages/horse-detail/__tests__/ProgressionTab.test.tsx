/**
 * The horse page's Progression section (Equoria-a0fim; owner request 2026-10-28).
 *
 * Points are bankable stat currency, not a level: an "X / 1000 Points" bar
 * toward the next stat, a plain line when banked points have earned stats, and
 * Allocate Stats. Discipline Scores: each discipline on its own line with its
 * score and level, from the server. The Horse Points history chart and Recent
 * Gains are gone, and so is Training History (owner ruling q217, 2026-10-28).
 *
 * Owner ruling q223 (2026-10-28): Allocate Stats is a separate page, linked
 * from here; the picker and its spend/refusal cases moved with it to
 * pages/horses/__tests__/AllocateStatsPage.test.tsx. Old contract: an
 * "Allocate Stats" button that opened the picker in place.
 *
 * Real ProgressionTab, hooks and apiClient (CSRF included); MSW only at the
 * HTTP boundary, in the backend's response shapes.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MemoryRouter } from '@/test/utils';
import ProgressionTab from '../ProgressionTab';
import type { Horse } from '../HorseDetailPageTypes';

const horseId = 77;
const horse = { id: horseId, name: 'Comet', disciplineScores: {} } as unknown as Horse;

function stubXp(data: { currentXP: number; availableStatPoints: number }) {
  const nextStatPointAt = (Math.floor(data.currentXP / 1000) + 1) * 1000;
  server.use(
    http.get('*/api/v1/horses/:horseId/xp', () =>
      HttpResponse.json({
        success: true,
        data: {
          horseId: horseId,
          horseName: 'Comet',
          ...data,
          nextStatPointAt,
          xpToNextStatPoint: nextStatPointAt - data.currentXP,
          pointsPerStatPoint: 1000,
        },
      })
    )
  );
}

const disciplines = [
  { discipline: 'Dressage', score: 98, level: 2 },
  { discipline: 'Show Jumping', score: 47, level: 1 },
];

function stubScores() {
  let calls = 0;
  server.use(
    http.get('*/api/v1/horses/:horseId/discipline-scores', () => {
      calls += 1;
      return HttpResponse.json({ success: true, data: { disciplines } });
    }),
    http.get('*/api/v1/horses/:horseId/training-history', () =>
      HttpResponse.json({ success: true, data: { trainingHistory: [] } })
    )
  );
  return () => calls;
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProgressionTab horse={horse} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Progression: Points toward the next stat (Equoria-a0fim)', () => {
  it('reads "X / 1000 Points" with no level and no Allocate Stats while no stat is ready', async () => {
    stubXp({ currentXP: 450, availableStatPoints: 0 });
    stubScores();
    renderTab();
    expect(await screen.findByTestId('horse-points-count')).toHaveTextContent('450 / 1000 Points');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
    expect(screen.queryByText(/Level \d+ progress|Level \d+ reached|to Level/)).toBeNull();
    expect(screen.queryByTestId('stats-ready')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Allocate Stats' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Allocate Stats' })).toBeNull();
  });

  it('banked points: counts from the last 1,000 and says how many stats are ready', async () => {
    stubXp({ currentXP: 2350, availableStatPoints: 2 });
    stubScores();
    renderTab();
    expect(await screen.findByTestId('horse-points-count')).toHaveTextContent('350 / 1000 Points');
    expect(screen.getByTestId('stats-ready')).toHaveTextContent('2 stats are ready to allocate.');
    expect(screen.getByRole('link', { name: 'Allocate Stats' })).toHaveAttribute(
      'href',
      `/horses/${horseId}/allocate-stats`
    );
    expect(screen.queryByLabelText('Stat')).toBeNull();
  });

  it('a failed Points read shows an error whose Try Again reads again', async () => {
    let fail = true;
    server.use(
      http.get('*/api/v1/horses/:horseId/xp', () =>
        fail
          ? HttpResponse.json({ success: false }, { status: 500 })
          : HttpResponse.json({
              success: true,
              data: {
                horseId: horseId,
                horseName: 'Comet',
                currentXP: 10,
                availableStatPoints: 0,
                nextStatPointAt: 1000,
                xpToNextStatPoint: 990,
                pointsPerStatPoint: 1000,
              },
            })
      )
    );
    stubScores();
    const user = userEvent.setup();
    renderTab();
    const error = await screen.findByTestId('horse-points-error');
    fail = false;
    await user.click(within(error).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByTestId('horse-points-count')).toHaveTextContent('10 / 1000 Points');
  });
});

describe('Progression: Discipline Scores (Equoria-a0fim)', () => {
  it('lists each discipline on its own line with its score and level', async () => {
    stubXp({ currentXP: 0, availableStatPoints: 0 });
    stubScores();
    renderTab();
    const dressage = await screen.findByTestId('discipline-score-Dressage');
    expect(dressage).toHaveTextContent('98');
    expect(dressage).toHaveTextContent('Level 2');
    expect(screen.getByText('Show Jumping')).toBeInTheDocument();
    expect(screen.getByTestId('discipline-score-Show Jumping')).toHaveTextContent('Level 1');
  });

  it('a failed read shows an error whose Try Again reads again, never an empty list', async () => {
    stubXp({ currentXP: 0, availableStatPoints: 0 });
    let fail = true;
    server.use(
      http.get('*/api/v1/horses/:horseId/discipline-scores', () =>
        fail
          ? HttpResponse.json({ success: false }, { status: 500 })
          : HttpResponse.json({ success: true, data: { disciplines } })
      ),
      http.get('*/api/v1/horses/:horseId/training-history', () =>
        HttpResponse.json({ success: true, data: { trainingHistory: [] } })
      )
    );
    const user = userEvent.setup();
    renderTab();
    const error = await screen.findByTestId('discipline-scores-error');
    expect(screen.queryByTestId('discipline-score-Dressage')).toBeNull();
    fail = false;
    await user.click(within(error).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByTestId('discipline-score-Dressage')).toHaveTextContent('98');
  });

  it('the Horse Points history chart and Recent Gains are gone (owner 2026-10-28)', async () => {
    stubXp({ currentXP: 0, availableStatPoints: 0 });
    stubScores();
    renderTab();
    await screen.findByTestId('discipline-score-Dressage');
    expect(screen.queryByText('Horse Points Progression')).toBeNull();
    expect(screen.queryByText('Recent Gains')).toBeNull();
  });

  // Owner ruling q217 (2026-10-28): Last Trained / Last Groomed stay in Horse
  // Details; the Training History section on Progression is removed.
  it('has no Training History section', async () => {
    stubXp({ currentXP: 0, availableStatPoints: 0 });
    stubScores();
    renderTab();
    await screen.findByTestId('discipline-score-Dressage');
    expect(screen.queryByTestId('score-progression-section')).toBeNull();
    expect(screen.queryByText(/training history/i)).toBeNull();
  });
});
