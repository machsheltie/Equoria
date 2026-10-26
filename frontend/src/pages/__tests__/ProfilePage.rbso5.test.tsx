/**
 * ProfilePage — secondary-query failure is not a row of zeros (Equoria-rbso5)
 *
 * The Game Statistics cards read useUserProgress. When that request failed the
 * four cards silently rendered 0 / 0 / 0 / 0% — plausible, false values beside
 * real profile data. The failed SECTION must say so (with a retry) while the
 * primary profile content stays untouched (doctrine §1 multi-query rule).
 *
 * Real page + real hooks + real apiClient; MSW only at the HTTP boundary.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import ProfilePage from '../ProfilePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const USER = {
  id: 7,
  username: 'ProfileTester',
  email: 'profile@example.com',
  role: 'user',
  money: 12345,
  xp: 250,
  level: 3,
  bio: '',
};

const progressOk = {
  userId: '7',
  username: 'ProfileTester',
  level: 3,
  xp: 250,
  xpToNextLevel: 50,
  xpForNextLevel: 300,
  xpForCurrentLevel: 200,
  progressPercentage: 50,
  totalEarnings: 1000,
  totalHorses: 9,
  totalCompetitions: 14,
  winRate: 35,
  breedingCount: 4,
};

function stubBoundary(progress: () => Response | Promise<Response>) {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({ status: 'success', data: { user: USER } })
    ),
    http.get(`${base}/api/v1/users/:id/progress`, () => progress()),
    http.get(`${base}/api/v1/users/:id/activity`, () =>
      HttpResponse.json({ success: true, data: [] })
    )
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ProfilePage game statistics (Equoria-rbso5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a retryable error, not zeros, when the progress request fails', async () => {
    stubBoundary(() =>
      HttpResponse.json({ status: 'error', message: 'progress boom' }, { status: 500 })
    );

    renderPage();

    const section = await screen.findByRole('region', { name: /game statistics/i });
    expect(await within(section).findByRole('alert')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // No fabricated stat cards.
    expect(within(section).queryByText('Horses Owned')).not.toBeInTheDocument();
    expect(within(section).queryByText('0%')).not.toBeInTheDocument();
    // Raw server text never leaks.
    expect(screen.queryByText(/progress boom/i)).not.toBeInTheDocument();
    // Unrelated primary content is intact.
    expect(screen.getByText('profile@example.com')).toBeInTheDocument();
  });

  it('retry re-fetches and renders the real statistics', async () => {
    let calls = 0;
    stubBoundary(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 })
        : HttpResponse.json({ success: true, data: progressOk });
    });

    const user = userEvent.setup();
    renderPage();

    const section = await screen.findByRole('region', { name: /game statistics/i });
    await user.click(await within(section).findByRole('button', { name: /try again/i }));

    expect(await within(section).findByText('Horses Owned')).toBeInTheDocument();
    expect(within(section).getByText('9')).toBeInTheDocument();
    expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows no zero cards while the progress request is pending', async () => {
    stubBoundary(async () => {
      await delay(150);
      return HttpResponse.json({ success: true, data: progressOk });
    });

    renderPage();

    const section = await screen.findByRole('region', { name: /game statistics/i });
    expect(within(section).queryByText('0')).not.toBeInTheDocument();
    expect(within(section).queryByText('0%')).not.toBeInTheDocument();
    expect(await within(section).findByText('9')).toBeInTheDocument();
  });

  it('renders the real values on success', async () => {
    stubBoundary(() => HttpResponse.json({ success: true, data: progressOk }));

    renderPage();

    const section = await screen.findByRole('region', { name: /game statistics/i });
    expect(await within(section).findByText('Horses Owned')).toBeInTheDocument();
    expect(within(section).getByText('9')).toBeInTheDocument();
    expect(within(section).getByText('4')).toBeInTheDocument();
  });
});
