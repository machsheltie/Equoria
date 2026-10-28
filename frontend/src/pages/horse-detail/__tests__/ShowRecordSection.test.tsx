/**
 * The horse main page's Show Record (Equoria-b4msy; owner request 2026-10-28):
 * Points (the horse's cumulative Horse Points), Wins / Places / Shows (1st,
 * 2nd and 3rd place finishes) and Winnings (prize money of its results).
 *
 * Real OverviewTab + ShowRecordSection, hooks and apiClient; MSW only at the
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
import OverviewTab from '../OverviewTab';
import type { Horse } from '../HorseDetailPageTypes';

const horseId = 41;
const horse = {
  id: horseId,
  name: 'TestFixture-Comet',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Mare',
  dateOfBirth: '2021-01-01T00:00:00Z',
  healthStatus: 'Excellent',
  stats: {},
  disciplineScores: {},
  traits: [],
  displayedHealth: 'Good',
  feedHealth: 'Good',
} as unknown as Horse;

const statistics = {
  totalCompetitions: 12,
  wins: 4,
  secondPlaces: 3,
  thirdPlaces: 1,
  top3Finishes: 8,
  winRate: 33.33,
  totalPrizeMoney: 12500,
  averagePlacement: 2.5,
  bestPlacement: 1,
};

function stubXp(currentXP: number) {
  server.use(
    http.get('*/api/v1/horses/:horseId/xp', () =>
      HttpResponse.json({
        success: true,
        data: {
          horseId,
          horseName: 'Comet',
          currentXP,
          availableStatPoints: 2,
          nextStatPointAt: 3000,
          xpToNextStatPoint: 650,
          pointsPerStatPoint: 1000,
        },
      })
    )
  );
}

function stubRecord(fail = () => false) {
  server.use(
    http.get('*/api/v1/horses/:horseId/competition-history', () =>
      fail()
        ? HttpResponse.json({ success: false }, { status: 500 })
        : HttpResponse.json({
            horseId,
            horseName: 'Comet',
            statistics,
            competitions: [],
            pageInfo: { nextCursor: null, hasMore: false },
          })
    )
  );
}

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OverviewTab horse={horse} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('Show Record on the horse main page (Equoria-b4msy)', () => {
  it('shows cumulative Points, Wins / Places / Shows and Winnings', async () => {
    stubXp(2350);
    stubRecord();
    renderTab();
    const record = await screen.findByTestId('show-record');
    expect(within(record).getByText('Points')).toBeInTheDocument();
    expect(await within(record).findByTestId('record-points')).toHaveTextContent('2,350');
    expect(await within(record).findByTestId('record-placings')).toHaveTextContent('4 / 3 / 1');
    expect(within(record).getByText('Wins / Places / Shows')).toBeInTheDocument();
    expect(within(record).getByTestId('record-winnings')).toHaveTextContent('12,500');
  });

  it('while loading and after a failed read the values are an em dash, never a zero, and Try Again reads again', async () => {
    stubXp(0);
    let fail = true;
    stubRecord(() => fail);
    const user = userEvent.setup();
    renderTab();
    const error = await screen.findByTestId('record-results-error');
    expect(screen.getByTestId('record-placings')).toHaveTextContent('—');
    expect(screen.getByTestId('record-winnings')).toHaveTextContent('—');
    fail = false;
    await user.click(within(error).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('4 / 3 / 1')).toBeInTheDocument();
    expect(screen.queryByTestId('record-results-error')).toBeNull();
  });

  it('a horse that has never shown reads 0 / 0 / 0 from a successful read', async () => {
    stubXp(0);
    server.use(
      http.get('*/api/v1/horses/:horseId/competition-history', () =>
        HttpResponse.json({
          horseId,
          horseName: 'Comet',
          statistics: {
            ...statistics,
            totalCompetitions: 0,
            wins: 0,
            secondPlaces: 0,
            thirdPlaces: 0,
            top3Finishes: 0,
            totalPrizeMoney: 0,
          },
          competitions: [],
          pageInfo: { nextCursor: null, hasMore: false },
        })
      )
    );
    renderTab();
    expect(await screen.findByText('0 / 0 / 0')).toBeInTheDocument();
    expect(screen.getByTestId('record-points')).toHaveTextContent('0');
  });
});
