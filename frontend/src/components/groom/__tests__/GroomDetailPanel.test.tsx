/**
 * GroomDetailPanel Component Tests (Equoria-cbkw)
 *
 * Verifies the metrics + assignment-history panel surfaces backend data:
 *  - 7 GroomMetrics score fields + totalInteractions render with values
 *  - assignment-log rows render milestones / xp / traitsShaped chips
 *  - loading / error / empty states render their honest placeholders
 *    (and the populated grids/lists are ABSENT in those states)
 *
 * Uses hook-level spies on useGroomProfile / useGroomAssignmentLogs
 * (per CLAUDE.md: no NEW vi.mock of api-client; hook-level spy is allowed).
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

function spyHooks(profile: Q<unknown>, logs: Q<unknown>) {
  vi.spyOn(useGroomsModule, 'useGroomProfile').mockReturnValue(profile as never);
  vi.spyOn(useGroomsModule, 'useGroomAssignmentLogs').mockReturnValue(logs as never);
}

describe('GroomDetailPanel (Equoria-cbkw)', () => {
  it('renders all 7 metric fields + totalInteractions with their values', () => {
    spyHooks(profileResult({ data: { metrics: fullMetrics } }), profileResult({ data: [] }));
    render(<GroomDetailPanel groomId={7} enabled />);

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
    render(<GroomDetailPanel groomId={7} enabled />);

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
    render(<GroomDetailPanel groomId={7} enabled />);
    expect(screen.getByTestId('groom-metrics-empty-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-metrics-grid-7')).not.toBeInTheDocument();
  });

  it('shows the empty assignment-history state (no list) when logs are empty', () => {
    spyHooks(profileResult({ data: { metrics: fullMetrics } }), profileResult({ data: [] }));
    render(<GroomDetailPanel groomId={7} enabled />);
    expect(screen.getByTestId('groom-logs-empty-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-logs-list-7')).not.toBeInTheDocument();
  });

  it('shows loading placeholders while either query is loading', () => {
    spyHooks(profileResult({ isLoading: true }), profileResult({ isLoading: true }));
    render(<GroomDetailPanel groomId={7} enabled />);
    expect(screen.getByTestId('groom-metrics-loading-7')).toBeInTheDocument();
    expect(screen.getByTestId('groom-logs-loading-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-metrics-grid-7')).not.toBeInTheDocument();
  });

  it('shows error placeholders when either query errors', () => {
    spyHooks(
      profileResult({ error: new Error('boom') }),
      profileResult({ error: new Error('boom') })
    );
    render(<GroomDetailPanel groomId={7} enabled />);
    expect(screen.getByTestId('groom-metrics-error-7')).toBeInTheDocument();
    expect(screen.getByTestId('groom-logs-error-7')).toBeInTheDocument();
  });
});
