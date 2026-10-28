/**
 * Horse XpProgressBar progress (Equoria-576c0 B13).
 *
 * Owner ruling C15: 1,000 Horse Points per stat allocation. The bar no longer
 * carries its own threshold: it reads `pointsPerStatPoint` and
 * `xpToNextStatPoint` from GET /api/v1/horses/:id/xp, so progress is
 * (pointsPerStatPoint - xpToNextStatPoint) / pointsPerStatPoint.
 * Old contract: the bar assumed 100 points and derived progress from
 * currentXP - availableStatPoints x 100, which was also wrong once points were
 * spent.
 *
 * Real component and React Query; the network boundary is stubbed with MSW.
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, it, expect } from 'vitest';
import { server } from '@/test/msw/server';
import { MemoryRouter } from '@/test/utils';
import { RewardToastProvider } from '@/components/feedback';
import XpProgressBar from '../XpProgressBar';

const HORSE_ID = 77;

function stubXp(data: Record<string, number | string>) {
  server.use(
    http.get('*/api/v1/horses/:horseId/xp', () =>
      HttpResponse.json({ success: true, data: { horseId: HORSE_ID, horseName: 'Comet', ...data } })
    )
  );
}

function renderBar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // A router: with stats ready the bar links to the Allocate Stats page (q223).
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <RewardToastProvider>
          <XpProgressBar horseId={HORSE_ID} />
        </RewardToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('XpProgressBar reads the allocation threshold from the server (C15)', () => {
  it('450 of 1,000 points toward the next allocation is 45%', async () => {
    stubXp({
      currentXP: 450,
      availableStatPoints: 4,
      nextStatPointAt: 1000,
      xpToNextStatPoint: 550,
      pointsPerStatPoint: 1000,
    });
    renderBar();
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '45');
    // Owner wording 2026-10-28 (Equoria-a0fim): "X / 1000 Points" (was "Horse Points").
    expect(screen.getByText('450 / 1000 Points')).toBeInTheDocument();
  });

  it('progress counts from the last threshold, not from the stat points still unspent', async () => {
    stubXp({
      currentXP: 1250,
      availableStatPoints: 0, // the earned allocation was already spent
      nextStatPointAt: 2000,
      xpToNextStatPoint: 750,
      pointsPerStatPoint: 1000,
    });
    renderBar();
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
  });
});
