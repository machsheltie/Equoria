/**
 * NextActionsBar Component Tests
 *
 * Boundary-level tests (Equoria-fefh2.12): the bar renders against the REAL
 * `useNextActions` hook (real React Query + real `apiClient`) with the network
 * boundary stubbed by MSW (`server.use(...)`) — NOT a
 * `vi.mock('@/hooks/api/useNextActions')`. This exercises the real query-key,
 * the real `{ success, data: { actions } }` envelope unwrap (apiClient strips
 * `.data`, the hook reads `.actions ?? []`), and the loading→data / error
 * transitions end-to-end against the EXACT real wire shape produced by
 * `backend/modules/users/controllers/nextActionsController.mjs`
 * (`res.status(200).json({ success: true, data: { actions: topActions } })`).
 *
 * Per-test boundary control uses `server.use(...)` inline overrides so each
 * case observes the wire it needs (populated / empty / error / loading-delay).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import { NextActionsBar } from '../NextActionsBar';
import type { NextAction } from '@/hooks/api/useNextActions';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const NEXT_ACTIONS_PATH = `${base}/api/v1/next-actions`;

const mockActions: NextAction[] = [
  { type: 'train', priority: 1, horseId: 1, horseName: 'Thunder' },
  { type: 'compete', priority: 2, horseId: 2, horseName: 'Lightning' },
  { type: 'claim-prize', priority: 3 },
];

/**
 * Stub the next-actions network boundary with the REAL backend envelope
 * (`{ success, data: { actions } }`). The apiClient unwraps `.data`, the hook
 * reads `.actions`.
 */
function stubNextActions(actions: NextAction[]) {
  server.use(
    http.get(NEXT_ACTIONS_PATH, () => HttpResponse.json({ success: true, data: { actions } }))
  );
}

function renderBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NextActionsBar />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('NextActionsBar', () => {
  it('renders loading skeletons while the boundary request is in flight', async () => {
    // Delay the network response so the loading state is observable.
    server.use(
      http.get(NEXT_ACTIONS_PATH, async () => {
        await delay(100);
        return HttpResponse.json({ success: true, data: { actions: mockActions } });
      })
    );

    const { container } = renderBar();
    // Before the boundary resolves, the loading bar renders 4 skeletons.
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
    // After it resolves, real actions replace the skeletons.
    await waitFor(() => expect(screen.getByText('Thunder is ready to train!')).toBeInTheDocument());
  });

  it('returns null when the boundary returns no actions', async () => {
    stubNextActions([]);

    const { container } = renderBar();
    // Empty actions → component renders nothing (after the query settles).
    await waitFor(() => expect(container.querySelectorAll('.animate-pulse').length).toBe(0));
    expect(container.innerHTML).toBe('');
  });

  it('returns null when the boundary errors', async () => {
    server.use(
      http.get(NEXT_ACTIONS_PATH, () =>
        HttpResponse.json(
          { success: false, message: 'Failed to fetch next actions' },
          { status: 500 }
        )
      )
    );

    const { container } = renderBar();
    // On error, the hook surfaces `error` (retry:false) and the bar renders nothing.
    await waitFor(() => expect(container.querySelectorAll('.animate-pulse').length).toBe(0));
    expect(container.innerHTML).toBe('');
  });

  it('renders action cards with narrative text from boundary data', async () => {
    stubNextActions(mockActions);

    renderBar();
    expect(await screen.findByText('Thunder is ready to train!')).toBeInTheDocument();
    expect(screen.getByText('Enter Lightning in a show')).toBeInTheDocument();
    expect(screen.getByText('You have unclaimed prizes!')).toBeInTheDocument();
  });

  it('renders the section heading', async () => {
    stubNextActions(mockActions);

    renderBar();
    expect(await screen.findByText('Next Actions')).toBeInTheDocument();
  });

  it('applies gold border styling to top priority (priority=1) action', async () => {
    stubNextActions(mockActions);

    renderBar();
    // The priority 1 action should have a gold border class
    const trainLink = await screen.findByLabelText('Thunder is ready to train!');
    expect(trainLink.className).toContain('border-[var(--gold-primary)]');
  });

  it('renders correct href links for each action type', async () => {
    stubNextActions(mockActions);

    renderBar();
    const trainLink = await screen.findByLabelText('Thunder is ready to train!');
    expect(trainLink).toHaveAttribute('href', '/training?horseId=1');

    const prizeLink = screen.getByLabelText('You have unclaimed prizes!');
    expect(prizeLink).toHaveAttribute('href', '/competitions');
  });

  it('links visit-vet action to /vet (not /veterinarian)', async () => {
    stubNextActions([{ type: 'visit-vet', priority: 1, horseId: 5, horseName: 'Blaze' }]);

    renderBar();
    const vetLink = await screen.findByLabelText('Blaze needs veterinary care');
    expect(vetLink).toHaveAttribute('href', '/vet?horseId=5');
  });
});
