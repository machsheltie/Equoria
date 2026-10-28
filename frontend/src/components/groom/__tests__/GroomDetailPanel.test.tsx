/**
 * GroomDetailPanel Component Tests (Equoria-cbkw, Equoria-oey96.6)
 *
 * Verifies the assignment-history + talent-tree panel surfaces
 * backend data (the groom reputation metrics were retired, owner q128):
 *  - assignment-log rows render milestones / traitsShaped chips (no XP:
 *    grooms are fixed NPCs, Equoria-dea06)
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

afterEach(() => {
  vi.restoreAllMocks();
});

function spyHooks(
  logs: Q<unknown>,
  talents: Q<unknown> = profileResult({ data: null }),
  select: MutationStub = selectStub(),
  // Equoria-xlw03: the panel also reads the groom's profile for its discoveries.
  profile: Q<unknown> = profileResult({ isLoading: true })
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
      groomPersonality="energetic"
      enabled
      {...props}
    />
  );
}

describe('GroomDetailPanel (Equoria-cbkw)', () => {
  // Owner ruling 2026-10-21 (Equoria-dea06): grooms are fixed NPCs and never
  // gain XP. Old contract: each log row showed "XP gained: n". New: no XP row.
  it('renders assignment-log rows with milestones and trait chips, and no XP', () => {
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
    spyHooks(profileResult({ data: logs }));
    renderPanel();

    const row = screen.getByTestId('groom-log-11');
    expect(within(row).getByText('Comet')).toBeInTheDocument();
    expect(within(row).getByTestId('groom-log-milestones-11')).toHaveTextContent('4');
    expect(within(row).queryByTestId('groom-log-xp-11')).not.toBeInTheDocument();
    expect(within(row).queryByText(/XP/)).not.toBeInTheDocument();
    const traits = within(row).getByTestId('groom-log-traits-11');
    expect(within(traits).getByText('brave')).toBeInTheDocument();
    expect(within(traits).getByText('calm')).toBeInTheDocument();
  });

  it('shows the empty assignment-history state (no list) when logs are empty', () => {
    spyHooks(profileResult({ data: [] }));
    renderPanel();
    expect(screen.getByTestId('groom-logs-empty-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-logs-list-7')).not.toBeInTheDocument();
  });

  it('shows the assignment-history loading placeholder while the query is loading', () => {
    spyHooks(profileResult({ isLoading: true }));
    renderPanel();
    expect(screen.getByTestId('groom-logs-loading-7')).toBeInTheDocument();
  });

  it('shows the assignment-history error placeholder when the query errors', () => {
    spyHooks(profileResult({ error: new Error('boom') }));
    renderPanel();
    expect(screen.getByTestId('groom-logs-error-7')).toBeInTheDocument();
  });
});

describe('GroomDetailPanel — talent tree (Equoria-oey96.6)', () => {
  it('renders the talent tree from backend-sourced selections (tier1 selected)', () => {
    spyHooks(
      profileResult({ data: [] }),
      // BACKEND is the source of truth: tier1 is selected server-side.
      profileResult({ data: { tier1: 'playtime_pro', tier2: null, tier3: null } })
    );
    renderPanel({ groomPersonality: 'energetic' });

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
    spyHooks(profileResult({ data: [] }), profileResult({ data: null }));
    renderPanel({ groomPersonality: 'energetic' });

    const tree = screen.getByTestId('groom-talent-tree');
    expect(within(tree).getByTestId('talent-allocated-count')).toHaveTextContent('0 / 3 allocated');
    // No selected badge exists in the empty state.
    expect(
      within(tree).queryByTestId('talent-selected-badge-playtime_pro')
    ).not.toBeInTheDocument();
  });

  it('shows the talents loading placeholder while the talents query loads (no tree)', () => {
    spyHooks(profileResult({ data: [] }), profileResult({ isLoading: true }));
    renderPanel();
    expect(screen.getByTestId('groom-talents-loading-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-talent-tree')).not.toBeInTheDocument();
  });

  it('shows the talents error placeholder when the talents query errors (no tree)', () => {
    spyHooks(profileResult({ data: [] }), profileResult({ error: new Error('boom') }));
    renderPanel();
    expect(screen.getByTestId('groom-talents-error-7')).toBeInTheDocument();
    expect(screen.queryByTestId('groom-talent-tree')).not.toBeInTheDocument();
  });

  it('surfaces a rejected selection as an error state — not silently swallowed (AC5)', () => {
    spyHooks(
      profileResult({ data: [] }),
      profileResult({ data: null }),
      // The select mutation rejected (e.g. locked/invalid tier). Equoria-mr1kq
      // (FRONTEND_ASYNC_STATE_DOCTRINE section 4): the old contract showed the
      // backend's own message verbatim; the panel now shows mapped copy for the
      // refusal and never the server's words.
      selectStub({
        isError: true,
        error: { statusCode: 400, message: 'raw server words about the talent tier' },
      })
    );
    renderPanel({ groomPersonality: 'energetic' });

    const err = screen.getByTestId('groom-talent-select-error-7');
    expect(err).toBeInTheDocument();
    expect(err).toHaveTextContent(
      "That talent can't be chosen yet. Check the groom's level and the talent's prerequisites."
    );
    expect(err).not.toHaveTextContent('raw server words');
    expect(err).toHaveAttribute('role', 'alert');
  });

  // Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): the groom's old 1-10 level is
  // gone and stars open no talent tier for now, so the panel offers no choice whatever
  // the groom's stars. Old contract: a level-5 groom's panel offered playtime_pro and
  // clicking it fired the select mutation (the click wiring is still covered in
  // GroomTalentTree.story-7-6).
  it('offers no talent to choose: stars open no tier for now (q244)', () => {
    const select = selectStub();
    spyHooks(profileResult({ data: [] }), profileResult({ data: null }), select);
    renderPanel({ groomPersonality: 'energetic' });

    expect(screen.queryByTestId('talent-select-btn-playtime_pro')).not.toBeInTheDocument();
    for (const tier of ['tier1', 'tier2', 'tier3']) {
      expect(screen.getByTestId(`tier-requirement-${tier}`)).toHaveTextContent('Not open yet');
    }
    expect(screen.queryByText(/Level \d/)).not.toBeInTheDocument();
    expect(select.mutate).not.toHaveBeenCalled();
  });
});

// Owner rulings 2026-10-28 (q160, Equoria-xlw03): the panel shows what the groom has
// revealed of its hidden items, with the rest as undiscovered slots.
describe('GroomDetailPanel — discoveries (Equoria-xlw03)', () => {
  it('shows only the revealed items, by kind, and the rest as undiscovered', () => {
    const growth = {
      starLevel: 'novice',
      stars: 2,
      levelLabel: 'Novice',
      personality: 'gentle',
      totalItems: 12,
      revealedCount: 3,
      categories: [
        {
          label: 'Horse traits',
          total: 4,
          revealed: [{ label: 'Brave', sign: 'positive', note: 'Strength' }],
        },
        {
          label: 'Disciplines',
          total: 4,
          revealed: [{ label: 'Dressage', sign: 'negative', note: 'Weakness' }],
        },
        { label: 'Temperaments', total: 2, revealed: [] },
        {
          label: 'Favorite breeds',
          total: 2,
          revealed: [{ label: 'Arabian', sign: 'positive', note: 'Favorite' }],
        },
      ],
    };
    spyHooks(
      profileResult({ data: [] }),
      undefined,
      undefined,
      profileResult({ data: { growth } })
    );
    renderPanel();

    const panel = screen.getByTestId('groom-discovery-panel');
    expect(within(panel).getByText('3 / 12 revealed')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('discovery-category-0')).getByText('Brave')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('discovery-category-0')).getAllByText('Not yet discovered')
    ).toHaveLength(3);
    expect(
      within(screen.getByTestId('discovery-category-1')).getByText('Weakness')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('discovery-category-2')).getAllByText('Not yet discovered')
    ).toHaveLength(2);
    expect(
      within(screen.getByTestId('discovery-category-3')).getByText('Favorite')
    ).toBeInTheDocument();
    expect(screen.queryByText(/more competition/i)).not.toBeInTheDocument();
  });

  it('says so when the discoveries cannot be loaded', () => {
    spyHooks(
      profileResult({ data: [] }),
      undefined,
      undefined,
      profileResult({ error: new Error('boom') })
    );
    renderPanel();
    expect(screen.getByTestId('groom-discovery-error-7')).toBeInTheDocument();
  });
});
