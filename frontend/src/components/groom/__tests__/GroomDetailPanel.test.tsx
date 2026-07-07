/**
 * GroomDetailPanel Component Tests (Equoria-cbkw, Equoria-oey96.6)
 *
 * Verifies the metrics + assignment-history + talent-tree panel surfaces
 * backend data:
 *  - 7 GroomMetrics score fields + totalInteractions render with values
 *  - assignment-log rows render milestones / xp / traitsShaped chips
 *  - loading / error / empty states render their honest placeholders
 *    (and the populated grids/lists are ABSENT in those states)
 *  - Equoria-oey96.6: the talent tree renders from BACKEND-sourced selections,
 *    and a REJECTED selection surfaces an error state (never silently swallowed)
 *
 * Uses hook-level spies on the useGrooms hooks (per CLAUDE.md: no NEW vi.mock of
 * api-client; hook-level spy is allowed). NOTE: the end-to-end reachability +
 * real-backend allocate/persist proof for the talent tree is the Playwright
 * spec tests/e2e/groom-talent-tree.spec.ts — these unit tests only assert the
 * panel's own rendering/error-surfacing contract.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import GroomDetailPanel from '../GroomDetailPanel';
import * as useGroomsModule from '../../../hooks/api/useGrooms';

type Q<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
};

function profileResult(over: Partial<Q<unknown>>): any {
  return { data: undefined, isLoading: false, error: null, ...over };
}

type MutationStub = {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

function selectStub(over: Partial<MutationStub> = {}): MutationStub {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...over };
}

const fullMetrics = {
  id: 1,
  groomId: 7,
  totalInteractions: 42,
  bondingEffectiveness: 88,
  taskCompletion: 75,
  horseWellbeing: 55,
  showPerformance: 30,
  consistency: 60,
  playerSatisfaction: 90,
  reputationScore: 50,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function spyHooks(
  profile: Q<unknown>,
  logs: Q<unknown>,
  talents: Q<unknown> = profileResult({ data: null }),
  select: MutationStub = selectStub()
) {
  vi.spyOn(useGroomsModule, 'useGroomProfile').mockReturnValue(profile as never);
  vi.spyOn(useGroomsModule, 'useGroomAssignmentLogs').mockReturnValue(logs as never);
  vi.spyOn(useGroomsModule, 'useGroomTalents').mockReturnValue(talents as never);
  vi.spyOn(useGroomsModule, 'useSelectTalent').mockReturnValue(select as never);
}

function renderPanel(props: Partial<React.ComponentProps<typeof GroomDetailPanel>> = {}) {
  return render(
    <GroomDetailPanel
      groomId={7}
      groomName="TestGroom"
      groomLevel={5}
      groomPersonality="energetic"
      enabled
      {...props}
    />
  );
}

describe('GroomDetailPanel (Equoria-cbkw)', () => {
  it('renders all 7 metric fields + totalInteractions with their values', () => {
    spyHooks(profileResult({ data: { metrics: fullMetrics } }), profileResult({ data: [] }));
    renderPanel();

    const grid = screen.getByTestId('groom-metrics-grid-7');
    expect(within(grid).getByTestId('groom-metric-bondingEffectiveness-7')).toHaveTextContent('88');
    expect(within(grid).getByTestId('groom-metric-taskCompletion-7')).toHaveTextContent('75');
    expect(within(grid).getByTestId('groom-metric-horseWellbeing-7')).toHaveTextContent('55');
    expect(within(grid).getByTestId('groom-metric-showPerformance-7')).toHaveTextContent('30');
    expect(within(grid).getByTestId('groom-metric-consistency-7')).toHaveTextContent('60');
    expect(within(grid).getByTestId('groom-metric-playerSatisfaction-7')).toHaveTextContent('90');
    expect(within(grid).getByTestId('groom-metric-reputationScore-7')).toHaveTextContent('50');
    expect(within(grid).getByTestId('groom-metric-totalInteractions-7')).toHaveTextContent('42');
  });

  it('renders assignment-log rows with milestones, xp, and trait chips', () => {
    const logs = [
      {
        id: 11,
        groomId: 7,
        horseId: 3,
        horse: { id: 3, name: 'Comet' },
        assignedAt: '2026-05-01T00:00:00.000Z',
        unassignedAt: '2026-05-10T00:00:00.000Z',
        milestonesCompleted: 4,
        xpGained: 120,
        traitsShaped: ['brave', 'calm'],
      },
    ];
    spyHooks(profileResult({ data: { metrics: fullMetrics } }), profileResult({ data: logs }));
    renderPanel();

    const row = screen.getByTestId('groom-log-11');
    expect(within(row).getByText('Comet')).toBeInTheDocument();
    expect(within(row).getByTestId('groom-log-milestones-11')).toHaveTextContent('4');
    expect(within(row).getByTestId('groom-log-xp-11')).toHaveTextContent('120');
    const traits = within(row).getByTestId('groom-log-traits-11');
    expect(within(traits).getByText('brave')).toBeInTheDocument();
    expect(within(traits).getByText('calm')).toBeInTheDocument();
  });

  it('shows the empty metrics state (no grid) when metrics is null', () => {
    spyHooks(profileResult({ data: { metrics: null } }), profileResult({ data: [] }));
    renderPanel();
    expect(screen.getByTestId('groom-metrics-empty-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-metrics-grid-7')).not.toBeInTheDocument();
  });

  it('shows the empty assignment-history state (no list) when logs are empty', () => {
    spyHooks(profileResult({ data: { metrics: fullMetrics } }), profileResult({ data: [] }));
    renderPanel();
    expect(screen.getByTestId('groom-logs-empty-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-logs-list-7')).not.toBeInTheDocument();
  });

  it('shows loading placeholders while either query is loading', () => {
    spyHooks(profileResult({ isLoading: true }), profileResult({ isLoading: true }));
    renderPanel();
    expect(screen.getByTestId('groom-metrics-loading-7')).toBeInTheDocument();
    expect(screen.getByTestId('groom-logs-loading-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-metrics-grid-7')).not.toBeInTheDocument();
  });

  it('shows error placeholders when either query errors', () => {
    spyHooks(
      profileResult({ error: new Error('boom') }),
      profileResult({ error: new Error('boom') })
    );
    renderPanel();
    expect(screen.getByTestId('groom-metrics-error-7')).toBeInTheDocument();
    expect(screen.getByTestId('groom-logs-error-7')).toBeInTheDocument();
  });
});

describe('GroomDetailPanel — talent tree (Equoria-oey96.6)', () => {
  it('renders the talent tree from backend-sourced selections (tier1 selected)', () => {
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      // BACKEND is the source of truth: tier1 is selected server-side.
      profileResult({ data: { tier1: 'playtime_pro', tier2: null, tier3: null } })
    );
    renderPanel({ groomLevel: 5, groomPersonality: 'energetic' });

    const section = screen.getByTestId('groom-talents-section-7');
    const tree = within(section).getByTestId('groom-talent-tree');
    expect(tree).toBeInTheDocument();
    // energetic tree → tier1 talents playtime_pro / enthusiasm_boost.
    expect(within(tree).getByTestId('talent-selected-badge-playtime_pro')).toBeInTheDocument();
    expect(within(tree).getByTestId('talent-allocated-count')).toHaveTextContent('1 / 3 allocated');
    expect(within(tree).getByTestId('talent-personality-label')).toHaveTextContent(
      'Energetic specialization'
    );
  });

  it('renders an honest empty tree (no selections) when the backend returns none', () => {
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      profileResult({ data: null })
    );
    renderPanel({ groomLevel: 5, groomPersonality: 'energetic' });

    const tree = screen.getByTestId('groom-talent-tree');
    expect(within(tree).getByTestId('talent-allocated-count')).toHaveTextContent('0 / 3 allocated');
    // No selected badge exists in the empty state.
    expect(
      within(tree).queryByTestId('talent-selected-badge-playtime_pro')
    ).not.toBeInTheDocument();
  });

  it('shows the talents loading placeholder while the talents query loads (no tree)', () => {
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      profileResult({ isLoading: true })
    );
    renderPanel();
    expect(screen.getByTestId('groom-talents-loading-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-talent-tree')).not.toBeInTheDocument();
  });

  it('shows the talents error placeholder when the talents query errors (no tree)', () => {
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      profileResult({ error: new Error('boom') })
    );
    renderPanel();
    expect(screen.getByTestId('groom-talents-error-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-talent-tree')).not.toBeInTheDocument();
  });

  it('surfaces a rejected selection as an error state — not silently swallowed (AC5)', () => {
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      profileResult({ data: null }),
      // The select mutation rejected (e.g. locked/invalid tier) with the real
      // backend message.
      selectStub({
        isError: true,
        error: { message: 'Invalid talent selection: insufficient_level' },
      })
    );
    renderPanel({ groomLevel: 5, groomPersonality: 'energetic' });

    const err = screen.getByTestId('groom-talent-select-error-7');
    expect(err).toBeInTheDocument();
    expect(err).toHaveTextContent('Invalid talent selection: insufficient_level');
    expect(err).toHaveAttribute('role', 'alert');
  });

  it('wires an available-talent selection to the select mutation', () => {
    const select = selectStub();
    spyHooks(
      profileResult({ data: { metrics: fullMetrics } }),
      profileResult({ data: [] }),
      profileResult({ data: null }),
      select
    );
    renderPanel({ groomLevel: 5, groomPersonality: 'energetic' });

    // Level 5, no prerequisites for tier1 → playtime_pro is available and has a
    // select button. Clicking it fires the real mutation with the exact
    // { groomId, tier, talentId } the backend route expects.
    const btn = screen.getByTestId('talent-select-btn-playtime_pro');
    btn.click();
    expect(select.mutate).toHaveBeenCalledWith({
      groomId: 7,
      tier: 'tier1',
      talentId: 'playtime_pro',
    });
  });
});
