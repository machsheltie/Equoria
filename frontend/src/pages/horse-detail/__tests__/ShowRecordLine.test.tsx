/**
 * The horse's show record (Equoria-b4msy): Win/Place/Show (1st, 2nd and 3rd
 * place finishes, q224), Winnings (prize money of its results) and Points (its
 * cumulative Horse Points).
 *
 * Owner ruling q225 (2026-10-28) changed where and how it reads: right under
 * the horse's name, before the stats, as one line
 * "Win/Place/Show: 4/3/1   Winnings: 12,500   Points: 2,350". Old contract: a
 * "Show Record" section below Care Team in the Overview tab, "4 / 3 / 1".
 *
 * Real ShowRecordLine / OverviewTab, hooks and apiClient; MSW only at the HTTP
 * boundary, in the backend's response shapes.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MemoryRouter } from '@/test/utils';
import OverviewTab from '../OverviewTab';
import OwnShowRecord from '../ShowRecordLine';
import HorseProfileCard from '../HorseProfileCard';
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

function renderInto(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </MemoryRouter>
  );
}

const renderTab = () => renderInto(<OwnShowRecord horseId={horseId} />);

describe('Show record line under the horse name (Equoria-b4msy, q225)', () => {
  it('reads Win/Place/Show, then Winnings, then Points', async () => {
    stubXp(2350);
    stubRecord();
    renderTab();
    const record = await screen.findByTestId('show-record');
    expect(await within(record).findByTestId('record-placings')).toHaveTextContent('4/3/1');
    expect(await within(record).findByTestId('record-points')).toHaveTextContent('2,350');
    expect(within(record).getByTestId('record-winnings')).toHaveTextContent('12,500');
    expect(
      within(record)
        .getAllByRole('term')
        .map((dt) => dt.textContent)
    ).toEqual(['Win/Place/Show:', 'Winnings:', 'Points:']);
  });

  it('sits right under the horse name, before the stats', async () => {
    stubXp(2350);
    stubRecord();
    renderInto(
      <HorseProfileCard
        horse={{ ...horse, stats: { speed: 60 } } as unknown as Horse}
        sireName={null}
        isEditing={false}
        editName=""
        onStartEdit={() => {}}
        onCancelEdit={() => {}}
        onChangeEditName={() => {}}
        refetch={() => {}}
      />
    );
    const name = screen.getByRole('heading', { level: 1 });
    const record = await screen.findByTestId('show-record');
    const firstStat = screen.getByText('speed');

    expect(name.compareDocumentPosition(record) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(
      record.compareDocumentPosition(firstStat) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('is no longer a Show Record section in the Overview tab', () => {
    stubXp(2350);
    stubRecord();
    renderInto(<OverviewTab horse={horse} />);
    expect(screen.queryByText('Show Record')).toBeNull();
    expect(screen.queryByTestId('show-record')).toBeNull();
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
    expect(await screen.findByText('4/3/1')).toBeInTheDocument();
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
    expect(await screen.findByText('0/0/0')).toBeInTheDocument();
    expect(screen.getByTestId('record-points')).toHaveTextContent('0');
  });
});
