/**
 * StableView — Beta Mode Tests
 *
 * Verifies that empty-state CTAs remain available when isBetaMode is true.
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

  it('shows the /breeding CTA in beta mode when stable is empty', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /go to breeding/i })).toHaveAttribute(
      'href',
      '/breeding'
    );
  });

  it('shows the /marketplace/horses CTA in beta mode when stable is empty', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    expect(screen.getByRole('link', { name: /browse marketplace/i })).toHaveAttribute(
      'href',
      '/marketplace/horses'
    );
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
