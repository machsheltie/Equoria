/**
 * NextActionsBar Component Tests
 *
 * Tests the next-actions suggestion bar with mocked useNextActions hook.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from '@/test/utils';

// Mock betaRouteScope — default to non-beta (override per-test as needed)
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return { ...actual, isBetaMode: false };
});

// Mock the hook
vi.mock('@/hooks/api/useNextActions', () => ({
  useNextActions: vi.fn(),
}));

import { NextActionsBar } from '../NextActionsBar';
import { useNextActions } from '@/hooks/api/useNextActions';

const mockUseNextActions = vi.mocked(useNextActions);

const mockActions = [
  { type: 'train' as const, priority: 1, horseId: 1, horseName: 'Thunder' },
  { type: 'compete' as const, priority: 2, horseId: 2, horseName: 'Lightning' },
  { type: 'claim-prize' as const, priority: 3 },
];

describe('NextActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons when loading', () => {
    mockUseNextActions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    const { container } = render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });

  it('returns null when there are no actions', () => {
    mockUseNextActions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null on error', () => {
    mockUseNextActions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fail'),
    } as any);

    const { container } = render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders action cards with narrative text', () => {
    mockUseNextActions.mockReturnValue({
      data: mockActions,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    expect(screen.getByText('Thunder is ready to train!')).toBeInTheDocument();
    expect(screen.getByText('Enter Lightning in a show')).toBeInTheDocument();
    expect(screen.getByText('You have unclaimed prizes!')).toBeInTheDocument();
  });

  it('renders the section heading', () => {
    mockUseNextActions.mockReturnValue({
      data: mockActions,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    expect(screen.getByText('Next Actions')).toBeInTheDocument();
  });

  it('applies gold border styling to top priority (priority=1) action', () => {
    mockUseNextActions.mockReturnValue({
      data: mockActions,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    // The priority 1 action should have a gold border class
    const trainLink = screen.getByLabelText('Thunder is ready to train!');
    expect(trainLink.className).toContain('border-[var(--gold-primary)]');
  });

  it('renders correct href links for each action type', () => {
    mockUseNextActions.mockReturnValue({
      data: mockActions,
      isLoading: false,
      error: null,
    } as any);

    render(
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    );
    const trainLink = screen.getByLabelText('Thunder is ready to train!');
    expect(trainLink).toHaveAttribute('href', '/training?horseId=1');

    const prizeLink = screen.getByLabelText('You have unclaimed prizes!');
    expect(prizeLink).toHaveAttribute('href', '/competitions');
  });
});
