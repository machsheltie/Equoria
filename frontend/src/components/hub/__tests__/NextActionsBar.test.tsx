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
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '@/test/utils';
import { server } from '@/test/msw/server';
import { NextActionsBar } from '../NextActionsBar';
import { nextActionsKeys, type NextAction } from '@/hooks/api/useNextActions';
import { userMessageFor } from '@/lib/http/userMessage';

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

  // Equoria-oey96.51 / Equoria-wohv4 (owner doctrine FRONTEND_ASYNC_STATE_DOCTRINE §1):
  // these two cases used to pin "renders nothing" for an empty list and for a
  // failed read. A failed read is not an empty one, and a genuinely empty list
  // owes the player an honest resting line (Story 23.1 AC, literal copy).
  it('renders the resting line when the boundary returns no actions', async () => {
    stubNextActions([]);

    renderBar();
    expect(
      await screen.findByText('Your stable is resting — check back soon.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show the resting line while loading', async () => {
    server.use(
      http.get(`${base}/api/v1/next-actions`, async () => {
        await delay(100);
        return HttpResponse.json({ success: true, data: { actions: [] } });
      })
    );

    renderBar();
    expect(screen.queryByText(/your stable is resting/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/your stable is resting/i)).toBeInTheDocument();
  });

  it('shows a visible error with a working retry when the boundary errors, never the resting line', async () => {
    const SENTINEL = 'Failed to fetch next actions: connect ECONNRESET 10.0.0.7';
    server.use(
      http.get(NEXT_ACTIONS_PATH, () =>
        HttpResponse.json({ success: false, message: SENTINEL }, { status: 500 })
      )
    );

    renderBar();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(userMessageFor({ statusCode: 500 }).message);
    expect(alert).not.toHaveTextContent('ECONNRESET');
    expect(screen.queryByText(/your stable is resting/i)).not.toBeInTheDocument();

    // Retry re-reads the endpoint; a recovered read replaces the error.
    stubNextActions(mockActions);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Thunder is ready to train!')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refreshes the list every 60 seconds (Story 23.1 AC)', async () => {
    stubNextActions(mockActions);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NextActionsBar />
        </BrowserRouter>
      </QueryClientProvider>
    );
    await screen.findByText('Thunder is ready to train!');

    const query = queryClient.getQueryCache().find({ queryKey: nextActionsKeys.all });
    expect(query?.observers[0]?.options.refetchInterval).toBe(60_000);
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

  // Equoria-oey96.28 — check-results became emittable once CompetitionResult
  // gained its `viewedAt` column. The card must reach the RESULTS surface, not
  // the browse-competitions list, and it must say what is actually waiting.
  it('links check-results to /competition-results and names a single waiting result', async () => {
    stubNextActions([
      {
        type: 'check-results',
        priority: 1,
        metadata: { count: 1, showId: 7, showName: 'Moonlit Cup' },
      },
    ]);

    renderBar();
    const link = await screen.findByLabelText('Your results are in');
    expect(link).toHaveAttribute('href', '/competition-results');
  });

  it('counts the waiting results when more than one is unread', async () => {
    stubNextActions([{ type: 'check-results', priority: 1, metadata: { count: 3 } }]);

    renderBar();
    expect(await screen.findByText('3 competition results are waiting')).toBeInTheDocument();
  });

  it('links visit-vet action to /vet (not /veterinarian)', async () => {
    stubNextActions([{ type: 'visit-vet', priority: 1, horseId: 5, horseName: 'Blaze' }]);

    renderBar();
    const vetLink = await screen.findByLabelText('Blaze needs veterinary care');
    expect(vetLink).toHaveAttribute('href', '/vet?horseId=5');
  });

  // Equoria-cn6kt (owner ruling 2026-10-22): a horse in critical health gets
  // a feed suggestion beside the vet visit. Feeding happens on the horse page.
  it('names a feed action and links it to that horse', async () => {
    stubNextActions([{ type: 'feed', priority: 1, horseId: 6, horseName: 'Ember' }]);

    renderBar();
    const feedLink = await screen.findByLabelText('Ember needs feeding');
    expect(feedLink).toHaveAttribute('href', '/horses/6');
  });
});
