/**
 * ProfilePage "Competitions Won" shows wins, not entries (Equoria-4z3i9;
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§4).
 *
 * Boundary-level: the REAL profile / progress / competition-stats hooks run
 * through the REAL api-client; only the network is stubbed (MSW). The defect:
 * the card labelled "Competitions Won" was bound to totalCompetitions (entries),
 * so a player who entered 12 shows and won 2 read "12".
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ProfilePage from '../ProfilePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER_ID = 'user-7';

const progress = {
  userId: USER_ID,
  username: 'Rider',
  level: 3,
  xp: 250,
  xpToNextLevel: 50,
  xpForNextLevel: 300,
  xpForCurrentLevel: 200,
  progressPercentage: 50,
  totalEarnings: 1000,
  totalHorses: 4,
  totalCompetitions: 12,
  winRate: 16.67,
  breedingCount: 1,
};

function stub(statsResponse: () => Response) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({
        status: 'success',
        data: {
          user: {
            id: USER_ID,
            username: 'Rider',
            email: 'rider@example.com',
            firstName: 'Ada',
            lastName: 'Vane',
            role: 'user',
            money: 1000,
            level: 3,
            xp: 250,
          },
        },
      })
    ),
    http.get(`${base}/api/v1/users/${USER_ID}/progress`, () =>
      HttpResponse.json({ success: true, data: progress })
    ),
    http.get(`${base}/api/v1/users/${USER_ID}/competition-stats`, statsResponse)
  );
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ id: USER_ID }}>
        <MemoryRouter initialEntries={['/profile']}>
          <ProfilePage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('ProfilePage — Competitions Won (Equoria-4z3i9)', () => {
  it('shows the number of competitions WON, not the number entered', async () => {
    stub(() =>
      HttpResponse.json({
        success: true,
        data: {
          userId: USER_ID,
          totalCompetitions: 12,
          totalWins: 2,
          totalTop3: 5,
          winRate: 16.67,
        },
      })
    );
    renderPage();

    const won = await screen.findByLabelText('Competitions Won: 2');
    expect(won).toBeInTheDocument();
    expect(screen.queryByLabelText('Competitions Won: 12')).not.toBeInTheDocument();
  });

  it('keeps a genuine zero as zero', async () => {
    stub(() =>
      HttpResponse.json({
        success: true,
        data: { userId: USER_ID, totalCompetitions: 12, totalWins: 0, totalTop3: 0, winRate: 0 },
      })
    );
    renderPage();

    expect(await screen.findByLabelText('Competitions Won: 0')).toBeInTheDocument();
  });

  it('a failed wins fetch is an error with retry, never a believable number', async () => {
    let failing = true;
    stub(() =>
      failing
        ? HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status: 500 })
        : HttpResponse.json({
            success: true,
            data: {
              userId: USER_ID,
              totalCompetitions: 12,
              totalWins: 2,
              totalTop3: 5,
              winRate: 16.67,
            },
          })
    );
    const user = userEvent.setup();
    renderPage();

    const section = await screen.findByLabelText('Game statistics');
    const alert = await within(section).findByRole('alert');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Competitions Won:/)).not.toBeInTheDocument();
    // The other, unrelated statistics are untouched.
    expect(screen.getByLabelText('Horses Owned: 4')).toBeInTheDocument();

    failing = false;
    await user.click(within(section).getByRole('button', { name: /try again/i }));
    expect(await screen.findByLabelText('Competitions Won: 2')).toBeInTheDocument();
  });
});
