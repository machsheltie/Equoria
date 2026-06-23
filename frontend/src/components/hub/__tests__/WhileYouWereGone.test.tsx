/**
 * WhileYouWereGone Component Tests
 *
 * Boundary-level tests (Equoria-fefh2.12): the component renders against the
 * REAL `useWhileYouWereGone` hook (real React Query + real `apiClient`) with
 * the network boundary stubbed by MSW (`server.use(...)`) — NOT a
 * `vi.mock('@/hooks/api/useWhileYouWereGone')`. This exercises the real
 * query-key construction, the `enabled` gating, the `{ success, data }`
 * envelope unwrap, and the loading→data transition end-to-end. Auth state is
 * provided through the REAL `AuthContext` via `MockAuthProvider` (a real
 * provider, not a module mock). localStorage drives the 4-hour absence gate.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import { WhileYouWereGone } from '../WhileYouWereGone';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WYAG_PATH = `${base}/api/v1/while-you-were-gone`;

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

/**
 * Stub the WYAG network boundary with a given items payload. The hook unwraps
 * the `{ success, data }` envelope, so the test mirrors the real wire shape.
 */
function stubWyag(items: typeof mockItems, opts: { hasMore?: boolean } = {}) {
  server.use(
    http.get(WYAG_PATH, () =>
      HttpResponse.json({
        success: true,
        data: { items, since: FIVE_HOURS_AGO, hasMore: opts.hasMore ?? false },
      })
    )
  );
}

function renderWYAG(opts: { completedOnboarding?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ completedOnboarding: opts.completedOnboarding ?? true }}>
        <BrowserRouter>
          <WhileYouWereGone />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('WhileYouWereGone', () => {
  beforeEach(() => {
    localStorage.clear();
    stubWyag(mockItems);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not show when user has not been away long enough', () => {
    // Set last visit to 1 hour ago (under 4h threshold)
    localStorage.setItem(LAST_VISIT_KEY, new Date(Date.now() - 60 * 60 * 1000).toISOString());
    renderWYAG();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show for users who have not completed onboarding', () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG({ completedOnboarding: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows overlay when user has been away for 4+ hours', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('While You Were Away')).toBeInTheDocument();
  });

  it('renders in a portal (document.body)', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    await screen.findByRole('dialog');
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
  });

  it('displays WYAG items fetched from the network boundary', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    expect(await screen.findByText('Thunder won 1st place!')).toBeInTheDocument();
    expect(screen.getByText('Luna reached weanling stage')).toBeInTheDocument();
  });

  it('dismisses on "Continue to Stable" button click', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    fireEvent.click(await screen.findByText('Continue to Stable'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses on Escape key press', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismisses on X button click', async () => {
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    fireEvent.click(await screen.findByLabelText('Dismiss'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading skeletons while the boundary request is in flight', async () => {
    // Delay the network response so the loading state is observable.
    server.use(
      http.get(WYAG_PATH, async () => {
        await delay(100);
        return HttpResponse.json({
          success: true,
          data: { items: mockItems, since: FIVE_HOURS_AGO, hasMore: false },
        });
      })
    );
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    const { container } = renderWYAG();
    // Dialog is shown immediately on long-absence; skeletons render while loading.
    await screen.findByRole('dialog');
    expect(container.ownerDocument.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    // After the boundary resolves, real items replace the skeletons.
    await waitFor(() => expect(screen.getByText('Thunder won 1st place!')).toBeInTheDocument());
  });

  it('shows empty message when the boundary returns no items', async () => {
    stubWyag([]);
    localStorage.setItem(LAST_VISIT_KEY, FIVE_HOURS_AGO);
    renderWYAG();
    expect(await screen.findByText(/resting peacefully/)).toBeInTheDocument();
  });
});
