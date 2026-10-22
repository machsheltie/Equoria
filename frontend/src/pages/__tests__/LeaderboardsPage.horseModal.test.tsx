/**
 * Leaderboard horse modal never invents a figure (Equoria-k7plw;
 * FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Boundary-level: the REAL leaderboard and horse-profile hooks run through the
 * REAL api-client; only the network is stubbed (MSW). The defect: a leaderboard
 * row that carries no win rate was shown in the modal as "Win Rate 0%" (and the
 * owner's stable size was filled with 0). Unknown is an em dash; a real zero is
 * still a zero.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import LeaderboardsPage from '../LeaderboardsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function stubBoard(secondaryStats: Record<string, number>) {
  server.use(
    http.get(`${base}/api/v1/leaderboards/horse-performance`, () =>
      HttpResponse.json({
        success: true,
        data: {
          category: 'horse-performance',
          period: 'all-time',
          totalEntries: 1,
          currentPage: 1,
          totalPages: 1,
          entries: [
            {
              rank: 1,
              horseId: 101,
              horseName: 'Horse 1',
              ownerId: 'owner-1',
              ownerName: 'Ada',
              primaryStat: 90,
              secondaryStats,
              isCurrentUser: false,
            },
          ],
          lastUpdated: '2026-10-22T00:00:00Z',
        },
      })
    )
  );
}

async function openHorseModal() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/leaderboards?category=horse-performance']}>
          <LeaderboardsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
  await user.click(await screen.findByTestId('leaderboard-entry'));
  const modal = await screen.findByTestId('horse-detail-modal');
  // The card renders once the horse profile has loaded.
  await within(modal).findByTestId('competition-history-section');
  return modal;
}

const winRateCard = (modal: HTMLElement) =>
  within(modal).getByText('Win Rate').parentElement as HTMLElement;

describe('LeaderboardsPage horse modal (Equoria-k7plw)', () => {
  it('shows an unavailable marker, not 0%, when the row has no win rate', async () => {
    stubBoard({ level: 5, totalCompetitions: 10, wins: 2 });
    const modal = await openHorseModal();

    expect(winRateCard(modal)).toHaveTextContent('—');
    expect(winRateCard(modal)).not.toHaveTextContent('%');
  });

  it('shows a real win rate when the row carries one', async () => {
    stubBoard({ level: 5, totalCompetitions: 10, wins: 2, winRate: 20 });
    const modal = await openHorseModal();

    expect(winRateCard(modal)).toHaveTextContent('20%');
  });

  it('keeps a genuine 0% win rate as 0%', async () => {
    stubBoard({ level: 5, totalCompetitions: 10, wins: 0, winRate: 0 });
    const modal = await openHorseModal();

    expect(winRateCard(modal)).toHaveTextContent('0%');
  });
});

const totalCard = (modal: HTMLElement) =>
  within(modal).getByText('Total Competitions').parentElement as HTMLElement;

describe('LeaderboardsPage horse modal — total competitions (Equoria-alnmo)', () => {
  it('shows an unavailable marker, not the win count, when the row has no total', async () => {
    stubBoard({ level: 5, wins: 2, winRate: 20 });
    const modal = await openHorseModal();

    expect(totalCard(modal)).toHaveTextContent('—');
    expect(totalCard(modal)).not.toHaveTextContent(/\d/);
  });

  it('shows the real total when the row carries one', async () => {
    stubBoard({ level: 5, totalCompetitions: 10, wins: 2 });
    const modal = await openHorseModal();

    expect(totalCard(modal)).toHaveTextContent('10');
  });

  it('keeps a genuine zero total as 0', async () => {
    stubBoard({ level: 5, totalCompetitions: 0, wins: 0 });
    const modal = await openHorseModal();

    expect(totalCard(modal)).toHaveTextContent('0');
  });
});
