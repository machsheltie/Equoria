/**
 * WhileYouWereGone Component Tests
 *
 * Tests the return overlay portal with mocked hooks and localStorage.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from '@/test/utils';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/api/useWhileYouWereGone', () => ({
  useWhileYouWereGone: vi.fn(),
}));

import { WhileYouWereGone } from '../WhileYouWereGone';
import { useAuth } from '@/contexts/AuthContext';
import { useWhileYouWereGone } from '@/hooks/api/useWhileYouWereGone';

const mockUseAuth = vi.mocked(useAuth);
const mockUseWYAG = vi.mocked(useWhileYouWereGone);

const LAST_VISIT_KEY = 'equoria-last-visit';
const FIVE_HOURS_AGO = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

const mockItems = [
  {
    type: 'competition-result' as const,
    priority: 1,
    title: 'Thunder won 1st place!',
    description: 'Dressage Grand Prix',
    timestamp: new Date().toISOString(),
    actionUrl: '/competitions/1',
  },
  {
    type: 'foal-milestone' as const,
    priority: 2,
    title: 'Luna reached weanling stage',
    description: '',
    timestamp: new Date().toISOString(),
  },
];

describe('WhileYouWereGone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseAuth.mockReturnValue({
      user: { completedOnboarding: true },
    } as any);

    mockUseWYAG.mockReturnValue({
      data: { items: mockItems, since: FIVE_HOURS_AGO, hasMore: false },
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    localStorage.clear();
  });

  function renderWithRouter() {
    return render(
      <BrowserRouter>
        <WhileYouWereGone />
      </BrowserRouter>
    );
  }

  it('does not show when user has not been away long enough', () => {
    // Set last visit to 1 hour ago (under 4h threshold)
    localStorage.setItem(LAST_VISIT_KEY, new Date(Date.now() - 60 * 60 * 1000).toISOString());
    renderWithRouter();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show for users who have not completed onboarding', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    mockUseAuth.mockReturnValue({
      user: { completedOnboarding: false },
    } as any);
    renderWithRouter();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows overlay when user has been away for 4+ hours', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('While You Were Away')).toBeInTheDocument();
  });

  it('renders in a portal (document.body)', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
  });

  it('displays WYAG items', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    expect(screen.getByText('Thunder won 1st place!')).toBeInTheDocument();
    expect(screen.getByText('Luna reached weanling stage')).toBeInTheDocument();
  });

  it('dismisses on "Continue to Stable" button click', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    fireEvent.click(screen.getByText('Continue to Stable'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses on Escape key press', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses on X button click', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWithRouter();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading skeletons while data is loading', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    mockUseWYAG.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    const { container } = renderWithRouter();
    expect(container.ownerDocument.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows empty message when no items', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    mockUseWYAG.mockReturnValue({
      data: { items: [], since: FIVE_HOURS_AGO, hasMore: false },
      isLoading: false,
    } as any);
    renderWithRouter();
    expect(screen.getByText(/resting peacefully/)).toBeInTheDocument();
  });
});
