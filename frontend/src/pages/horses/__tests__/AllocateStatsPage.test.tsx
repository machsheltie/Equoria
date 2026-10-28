/**
 * Allocate Stats is its own page (owner ruling q223, 2026-10-28;
 * Equoria-a0fim): /horses/:id/allocate-stats, linked from the horse page's
 * Points. The spend and refusal cases moved here from ProgressionTab.test
 * with the picker; their assertions are unchanged.
 *
 * Real page, hooks and apiClient (CSRF included); MSW only at the HTTP
 * boundary, in the backend's response shapes.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MemoryRouter } from '@/test/utils';
import AllocateStatsPage from '../AllocateStatsPage';

const horseId = 77;

function stubXp(data: { currentXP: number; availableStatPoints: number }, fail = false) {
  const nextStatPointAt = (Math.floor(data.currentXP / 1000) + 1) * 1000;
  server.use(
    http.get('*/api/v1/horses/:horseId/xp', () =>
      fail
        ? HttpResponse.json({ success: false }, { status: 500 })
        : HttpResponse.json({
            success: true,
            data: {
              horseId,
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/horses/${horseId}/allocate-stats`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/horses/:id/allocate-stats" element={<AllocateStatsPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Allocate Stats page (q223)', () => {
  it('names the horse, says how many stats are ready and links back to the horse', async () => {
    stubXp({ currentXP: 2350, availableStatPoints: 2 });
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Allocate Stats for Comet' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('stats-ready')).toHaveTextContent('2 stats are ready to allocate.');
    expect(screen.getByTestId('horse-points-count')).toHaveTextContent(
      '350 / 1000 Points toward the next stat'
    );
    expect(screen.getByRole('link', { name: 'Back to Comet' })).toHaveAttribute(
      'href',
      `/horses/${horseId}`
    );
  });

  it('spends one point on the chosen stat and refreshes the Points', async () => {
    stubXp({ currentXP: 1200, availableStatPoints: 1 });
    let posted: unknown = null;
    server.use(
      http.post('*/api/v1/horses/:horseId/allocate-stat', async ({ request }) => {
        posted = await request.json();
        stubXp({ currentXP: 1200, availableStatPoints: 0 });
        return HttpResponse.json({
          success: true,
          data: { statName: 'focus', newStatValue: 71, remainingStatPoints: 0 },
        });
      })
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByTestId('stats-ready')).toHaveTextContent(
      '1 stat is ready to allocate.'
    );
    await user.selectOptions(screen.getByLabelText('Stat'), 'focus');
    await user.click(screen.getByRole('button', { name: 'Allocate' }));

    expect(await screen.findByText('Focus is now 71.')).toBeInTheDocument();
    expect(posted).toEqual({ statName: 'focus' });
    await waitFor(() =>
      expect(screen.getByTestId('stats-ready')).toHaveTextContent('No stats are ready to allocate.')
    );
    expect(screen.queryByLabelText('Stat')).toBeNull();
  });

  it('a refused allocation is said at the control and the picker stays', async () => {
    stubXp({ currentXP: 1200, availableStatPoints: 1 });
    server.use(
      http.post('*/api/v1/horses/:horseId/allocate-stat', () =>
        HttpResponse.json({ success: false, error: 'No stat points available' }, { status: 400 })
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Allocate' }));
    expect(await within(screen.getByTestId('allocate-stats')).findByRole('alert')).toBeVisible();
    expect(screen.getByLabelText('Stat')).toBeInTheDocument();
  });

  it('a failed Points read shows an error whose Try Again reads again', async () => {
    stubXp({ currentXP: 0, availableStatPoints: 0 }, true);
    const user = userEvent.setup();
    renderPage();
    const error = await screen.findByTestId('allocate-points-error');
    stubXp({ currentXP: 1200, availableStatPoints: 1 });
    await user.click(within(error).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByTestId('stats-ready')).toHaveTextContent(
      '1 stat is ready to allocate.'
    );
  });
});
