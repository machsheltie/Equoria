/**
 * ClubsPage smoke tests (Equoria-jexy)
 *
 * Verifies the clubs page renders correctly and key interactions work:
 * - Page mounts without crashing
 * - Discipline, Breed, My Club tabs are present
 * - Club cards with join buttons render in the discipline tab
 * - Breed tab shows breed clubs
 * - My Club tab shows create club toggle and leaderboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { TestRouter } from '@/test/utils';

const mockUseClubs = vi.fn();
const mockUseMyClubs = vi.fn();
const mockJoinMutate = vi.fn();

vi.mock('@/hooks/api/useClubs', () => ({
  useClubs: (...args: unknown[]) => mockUseClubs(...args),
  useMyClubs: () => mockUseMyClubs(),
  useClub: () => ({ data: null, isLoading: false }),
  useJoinClub: () => ({ mutate: mockJoinMutate, isPending: false }),
  useLeaveClub: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateClub: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClubElections: () => ({ data: { elections: [] }, isLoading: false, fetchStatus: 'idle' }),
  useNominate: () => ({ mutate: vi.fn(), isPending: false }),
  useVote: () => ({ mutate: vi.fn(), isPending: false }),
  useElectionResults: () => ({ data: { election: null, candidates: [] }, isLoading: false }),
  useTransferLeadership: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import ClubsPage from '../ClubsPage';

const DISCIPLINE_CLUB = {
  id: 10,
  name: 'Dressage Enthusiasts',
  type: 'discipline' as const,
  category: 'Dressage',
  description: 'For lovers of classical dressage.',
  leader: { id: 'u3', username: 'horsepro' },
  memberCount: 42,
  createdAt: new Date().toISOString(),
};

const BREED_CLUB = {
  id: 20,
  name: 'Arabian Society',
  type: 'breed' as const,
  category: 'Arabian',
  description: 'Celebrating the Arabian breed.',
  leader: { id: 'u4', username: 'breeder' },
  memberCount: 18,
  createdAt: new Date().toISOString(),
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestRouter>{children}</TestRouter>
    </QueryClientProvider>
  );
}

function setupDefaultMocks() {
  mockUseClubs.mockImplementation((type?: string) => {
    if (type === 'discipline') {
      return { data: { clubs: [DISCIPLINE_CLUB] }, isLoading: false };
    }
    if (type === 'breed') {
      return { data: { clubs: [BREED_CLUB] }, isLoading: false };
    }
    // no filter — all clubs
    return { data: { clubs: [DISCIPLINE_CLUB, BREED_CLUB] }, isLoading: false };
  });
  mockUseMyClubs.mockReturnValue({
    data: { memberships: [] },
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

describe('ClubsPage', () => {
  it('renders without crashing', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByTestId('club-tabs')).toBeInTheDocument();
  });

  it('shows Discipline, Breed, and My Club tabs', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByTestId('tab-discipline')).toBeInTheDocument();
    expect(screen.getByTestId('tab-breed')).toBeInTheDocument();
    expect(screen.getByTestId('tab-my-club')).toBeInTheDocument();
  });

  it('discipline tab is selected by default', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByTestId('tab-discipline')).toHaveAttribute('aria-selected', 'true');
  });

  it('renders discipline club cards with join buttons', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByTestId('club-card-10')).toBeInTheDocument();
    expect(screen.getByText('Dressage Enthusiasts')).toBeInTheDocument();
    expect(screen.getByTestId('join-button-10')).toBeInTheDocument();
  });

  it('calls joinClub.mutate when join button is clicked', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('join-button-10'));

    expect(mockJoinMutate).toHaveBeenCalledWith(10);
  });

  it('switches to breed tab and shows breed clubs', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-breed'));

    expect(screen.getByTestId('tab-breed')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('club-card-20')).toBeInTheDocument();
    expect(screen.getByText('Arabian Society')).toBeInTheDocument();
  });

  it('shows discipline clubs grid', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByTestId('discipline-clubs-grid')).toBeInTheDocument();
  });

  it('switches to My Club tab and shows create club toggle', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-my-club'));

    expect(screen.getByTestId('tab-my-club')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('create-club-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('my-club-tab')).toBeInTheDocument();
  });

  it('shows create club form when create club toggle is clicked', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-my-club'));
    await user.click(screen.getByTestId('create-club-toggle'));

    expect(screen.getByTestId('create-club-name')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-type')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-category')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-description')).toBeInTheDocument();
    expect(screen.getByTestId('create-club-submit')).toBeInTheDocument();
  });

  it('shows total club count in page header', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );
    expect(screen.getByText('2 clubs total')).toBeInTheDocument();
  });

  it('shows club leaderboard in My Club tab with top clubs', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ClubsPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-my-club'));

    // Leaderboard rows for both clubs
    expect(screen.getByTestId('leaderboard-row-10')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-row-20')).toBeInTheDocument();
  });
});
