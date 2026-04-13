/**
 * StableView — Beta Mode Tests
 *
 * Verifies that the empty-state CTAs linking to /breeding and /marketplace/horses
 * are hidden when isBetaMode is true, since both routes are classified beta-readonly
 * in docs/beta-route-truth-table.md and must not be linked from a beta-live surface.
 *
 * Story 21R-1 Third-Pass Course Correction (2026-04-13)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import React from 'react';

// ── Mock betaRouteScope with isBetaMode: true ─────────────────────────────────
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return {
    ...actual,
    isBetaMode: true,
  };
});

// Mock HorseCard so stable renders without full card complexity
vi.mock('../../components/HorseCard', () => ({
  default: () => null,
}));

// Mock FantasyTabs to render the first tab content (all horses)
vi.mock('../../components/FantasyTabs', () => ({
  FantasyTabs: ({
    tabs,
    defaultValue,
  }: {
    tabs: Array<{ value: string; content: React.ReactNode }>;
    defaultValue?: string;
  }) => {
    const selected = tabs.find((tab) => tab.value === defaultValue) || tabs[0];
    return <div data-testid="fantasy-tabs">{selected?.content}</div>;
  },
}));

vi.mock('../../hooks/api/useHorses', () => ({
  useHorses: vi.fn(),
}));

vi.mock('../../hooks/useAuth', async () => {
  const actual = await vi.importActual('../../hooks/useAuth');
  return {
    ...actual,
    useProfile: vi.fn(),
  };
});

import * as useHorsesModule from '../../hooks/api/useHorses';
import * as useAuthModule from '../../hooks/useAuth';
import StableView from '../StableView';

describe('StableView — beta mode', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.mocked(useHorsesModule.useHorses).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHorsesModule.useHorses>);

    vi.mocked(useAuthModule.useProfile).mockReturnValue({
      data: { user: { id: 1, money: 0, xp: 0, level: 1 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthModule.useProfile>);
  });

  it('hides the /breeding CTA in beta mode when stable is empty', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    // The "Go to Breeding" link must not be present in beta mode
    expect(screen.queryByRole('link', { name: /go to breeding/i })).not.toBeInTheDocument();
  });

  it('hides the /marketplace/horses CTA in beta mode when stable is empty', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    // The "Browse Marketplace" link must not be present in beta mode
    expect(screen.queryByRole('link', { name: /browse marketplace/i })).not.toBeInTheDocument();
  });

  it('still renders the empty-state message in beta mode', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    expect(screen.getByText(/your stable is empty/i)).toBeInTheDocument();
  });
});
