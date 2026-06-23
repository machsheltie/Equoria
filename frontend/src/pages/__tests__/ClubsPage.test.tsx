/**
 * ClubsPage boundary tests (Equoria-jexy; converted under Equoria-fefh2.12)
 *
 * Boundary-level: the page renders against the REAL `useClubs` /
 * `useMyClubs` / `useJoinClub` / `useCreateClub` hooks (real React Query +
 * real `clubsApi` over `apiClient`) with the network boundary stubbed by MSW
 * (`src/test/msw/handlers/clubs.ts`) — NOT a `vi.mock('@/hooks/api/useClubs')`.
 * This exercises the real query-key fanout (`useClubs('discipline')`,
 * `useClubs('breed')`, `useClubs()`), the `{ clubs }` / `{ memberships }`
 * envelope unwrap, the membership-derived "Member" vs "Join Club" rendering,
 * and the real join mutation hitting the wire end-to-end.
 *
 * Fixtures are the MSW handler's canonical data (3 clubs: id 10 "Dressage
 * Enthusiasts"/discipline, id 11 "Arabian Breed Society"/breed, id 12 "Show
 * Jumping League"/discipline; the user is a member of club 10 via /clubs/mine).
 *
 * Verifies the clubs page renders correctly and key interactions work:
 * - Page mounts without crashing
 * - Discipline, Breed, My Club tabs are present
 * - Club cards with join buttons render in the discipline tab
 * - Breed tab shows breed clubs
 * - My Club tab shows create club toggle and leaderboard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { TestRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import ClubsPage from '../ClubsPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestRouter>{children}</TestRouter>
    </QueryClientProvider>
  );
}

function renderPage() {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <ClubsPage />
    </Wrapper>
  );
}

beforeEach(() => {
  // Default MSW clubs handlers are registered globally; individual tests
  // override with server.use(...) where they need to observe the wire.
});

describe('ClubsPage', () => {
  it('renders without crashing', () => {
    renderPage();
    expect(screen.getByTestId('club-tabs')).toBeInTheDocument();
  });

  it('shows Discipline, Breed, and My Club tabs', () => {
    renderPage();
    expect(screen.getByTestId('tab-discipline')).toBeInTheDocument();
    expect(screen.getByTestId('tab-breed')).toBeInTheDocument();
    expect(screen.getByTestId('tab-my-club')).toBeInTheDocument();
  });

  it('discipline tab is selected by default', () => {
    renderPage();
    expect(screen.getByTestId('tab-discipline')).toHaveAttribute('aria-selected', 'true');
  });

  it('renders discipline club cards fetched from the boundary', async () => {
    renderPage();
    expect(await screen.findByTestId('club-card-10')).toBeInTheDocument();
    expect(screen.getByText('Dressage Enthusiasts')).toBeInTheDocument();
    // Club 12 (Show Jumping) is a discipline club the user is NOT a member of,
    // so it renders a real Join button.
    expect(await screen.findByTestId('join-button-12')).toBeInTheDocument();
  });

  it('renders a Member badge (not a Join button) for a club the user belongs to', async () => {
    renderPage();
    // The user is a member of club 10 per /clubs/mine — derived from the real
    // useMyClubs query, so no join button is offered for it.
    await screen.findByTestId('club-card-10');
    expect(screen.queryByTestId('join-button-10')).not.toBeInTheDocument();
  });

  it('sends a join request to the boundary when a Join button is clicked', async () => {
    let joinedClubId: number | null = null;
    server.use(
      http.post(`${base}/api/v1/clubs/:id/join`, ({ params }) => {
        joinedClubId = Number(params.id);
        return HttpResponse.json(
          {
            membership: {
              id: 500,
              club: {
                id: Number(params.id),
                name: 'Show Jumping League',
                type: 'discipline',
                category: 'Show Jumping',
                description: 'Competitive show jumping community.',
                leader: { id: 'user-6', username: 'jumpmaster' },
                memberCount: 68,
                createdAt: '2025-03-20T00:00:00Z',
              },
              role: 'member',
              joinedAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('join-button-12'));

    await waitFor(() => expect(joinedClubId).toBe(12));
  });

  it('switches to breed tab and shows breed clubs from the boundary', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('tab-breed'));

    expect(screen.getByTestId('tab-breed')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('club-card-11')).toBeInTheDocument();
    expect(screen.getByText('Arabian Breed Society')).toBeInTheDocument();
  });

  it('shows discipline clubs grid', async () => {
    renderPage();
    expect(await screen.findByTestId('discipline-clubs-grid')).toBeInTheDocument();
  });

  it('switches to My Club tab and shows create club toggle', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('tab-my-club'));

    expect(screen.getByTestId('tab-my-club')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('create-club-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('my-club-tab')).toBeInTheDocument();
  });

  it('shows create club form when create club toggle is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('tab-my-club'));
    await user.click(await screen.findByTestId('create-club-toggle'));

    expect(screen.getByTestId('create-club-name')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-type')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-category')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-description')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-submit')).toBeInTheDocument();
  });

  it('shows total club count in page header', async () => {
    renderPage();
    // 3 clubs come from the boundary's GET /api/v1/clubs (no filter).
    expect(await screen.findByText('3 clubs total')).toBeInTheDocument();
  });

  it('shows club leaderboard in My Club tab with the boundary clubs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('tab-my-club'));

    // Leaderboard rows for all clubs returned by the boundary.
    expect(await screen.findByTestId('leaderboard-row-10')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-row-11')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-row-12')).toBeInTheDocument();
  });
});
