/**
 * Loading skeletons are announced (Equoria-2fzcy; FRONTEND_ASYNC_STATE_DOCTRINE
 * sections 1 and 5).
 *
 * About twenty components drew their own pulsing placeholder blocks with no
 * live-region semantics, so a screen reader heard nothing while a section loaded.
 * Each loading branch must expose one role="status" region that is named and
 * aria-busy. Repeated placeholders (a grid of cards, a run of rows) share ONE
 * region rather than announcing once per block.
 *
 * Real components and hooks; where a hook owns the request, MSW holds it open
 * (a request that never resolves) so the loading branch is what is rendered.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http } from 'msw';
import { server } from '@/test/msw/server';
import ActivityFeed from '../ActivityFeed';
import XPLevelDisplay from '../XPLevelDisplay';
import StatisticsCard from '../StatisticsCard';
import CompetitionList from '../competition/CompetitionList';
import CompetitionCard from '../competition/CompetitionCard';
import RankSummaryCard from '../leaderboard/RankSummaryCard';
import UserRankDashboard from '../leaderboard/UserRankDashboard';
import LeaderboardHorseDetailModal from '../leaderboard/LeaderboardHorseDetailModal';
import TrainingHistoryTable from '../training/TrainingHistoryTable';
import XpHistoryTimeline from '../horse/XpHistoryTimeline';
import ScoreProgressionPanel from '../training/ScoreProgressionPanel';
import StatHistoryGraph from '../horse/StatHistoryGraph';
import { NextActionsBar } from '../hub/NextActionsBar';

function withProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** A request that never settles, so a hook-owned component stays in its loading branch. */
function holdEveryRequest() {
  server.use(
    http.get('*', () => new Promise(() => {})),
    http.post('*', () => new Promise(() => {}))
  );
}

function expectOneBusyStatus() {
  const status = screen.getByRole('status');
  expect(status).toHaveAttribute('aria-busy', 'true');
  expect(status).toHaveAccessibleName(/loading/i);
}

describe('loading skeletons expose a live region (Equoria-2fzcy)', () => {
  it('ActivityFeed', () => {
    render(<ActivityFeed activities={[]} isLoading />);
    expectOneBusyStatus();
  });

  it('XPLevelDisplay', () => {
    render(<XPLevelDisplay isLoading />);
    expectOneBusyStatus();
  });

  it('StatisticsCard', () => {
    render(<StatisticsCard label="Horses Owned" isLoading />);
    expectOneBusyStatus();
  });

  it('CompetitionList shares one region across its placeholder cards', () => {
    render(<CompetitionList competitions={[]} onCompetitionClick={() => {}} isLoading />);
    expectOneBusyStatus();
  });

  it('CompetitionCard', () => {
    render(
      <CompetitionCard
        competition={{ id: 1 } as React.ComponentProps<typeof CompetitionCard>['competition']}
        onClick={() => {}}
        isLoading
      />
    );
    expectOneBusyStatus();
  });

  it('RankSummaryCard', () => {
    render(
      <RankSummaryCard
        ranking={null as unknown as React.ComponentProps<typeof RankSummaryCard>['ranking']}
        isLoading
      />
    );
    expectOneBusyStatus();
  });

  it('UserRankDashboard announces once, not once per placeholder card', () => {
    render(
      <UserRankDashboard userId="u1" userName="Ada" rankings={[]} bestRankings={[]} isLoading />
    );
    expectOneBusyStatus();
  });

  it('LeaderboardHorseDetailModal', () => {
    render(<LeaderboardHorseDetailModal isOpen onClose={() => {}} horseData={null} isLoading />);
    expectOneBusyStatus();
  });

  it('TrainingHistoryTable', () => {
    render(<TrainingHistoryTable history={[]} loading />);
    expectOneBusyStatus();
  });

  it('XpHistoryTimeline', () => {
    render(<XpHistoryTimeline horseId={1} horseName="Moonflower" entries={[]} isLoading />);
    expectOneBusyStatus();
  });

  it('ScoreProgressionPanel', () => {
    holdEveryRequest();
    withProviders(<ScoreProgressionPanel horseId={1} />);
    expectOneBusyStatus();
  });

  it('StatHistoryGraph', () => {
    holdEveryRequest();
    withProviders(<StatHistoryGraph horseId={1} />);
    expectOneBusyStatus();
  });

  it('NextActionsBar', () => {
    holdEveryRequest();
    withProviders(<NextActionsBar />);
    expectOneBusyStatus();
  });
});
