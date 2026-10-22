/**
 * WhileYouWereGone — honest failure + per-user last visit (Equoria-bvddn.39)
 *
 * 1. A failed activity request used to fall through to "Nothing new since your
 *    last visit. Your stable is resting peacefully." — a false all-clear for a
 *    network blip. It must say the activity could not be loaded, with a retry.
 * 2. `lastVisit` was one unscoped localStorage key, so a second account on the
 *    same browser inherited the first account's absence window. It is keyed by
 *    user id.
 *
 * Real component + real hook + real apiClient; MSW only at the HTTP boundary.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import { WhileYouWereGone } from '../WhileYouWereGone';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const wyagPath = `${base}/api/v1/while-you-were-gone`;
const lastVisitPrefix = 'equoria-last-visit';
const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

function renderWYAG(userId: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ id: userId, completedOnboarding: true }}>
        <BrowserRouter>
          <WhileYouWereGone />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('WhileYouWereGone — failure is not "nothing new" (Equoria-bvddn.39)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows a retryable error, not the all-clear, when the activity request fails', async () => {
    localStorage.setItem(`${lastVisitPrefix}:7`, fiveHoursAgo);
    server.use(
      http.get(wyagPath, () =>
        HttpResponse.json({ status: 'error', message: 'internal boom' }, { status: 500 })
      )
    );

    renderWYAG(7);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/resting peacefully/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing new/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal boom/i)).not.toBeInTheDocument();
  });

  it('retry re-fetches and renders the real items', async () => {
    localStorage.setItem(`${lastVisitPrefix}:7`, fiveHoursAgo);
    let calls = 0;
    server.use(
      http.get(wyagPath, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                type: 'competition-result',
                priority: 1,
                title: 'Thunder won 1st place!',
                description: 'Dressage Grand Prix',
                timestamp: new Date().toISOString(),
              },
            ],
            since: fiveHoursAgo,
            hasMore: false,
          },
        });
      })
    );

    const user = userEvent.setup();
    renderWYAG(7);

    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Thunder won 1st place!')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe('WhileYouWereGone — last visit is per user (Equoria-bvddn.39)', () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(
      http.get(wyagPath, () =>
        HttpResponse.json({
          success: true,
          data: { items: [], since: fiveHoursAgo, hasMore: false },
        })
      )
    );
  });
  afterEach(() => localStorage.clear());

  it("does not show another account's absence window to a different user", () => {
    localStorage.setItem(`${lastVisitPrefix}:7`, fiveHoursAgo);
    renderWYAG(8);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("records this user's visit under their own key, leaving the other user's alone", () => {
    localStorage.setItem(`${lastVisitPrefix}:7`, fiveHoursAgo);
    renderWYAG(8);
    expect(localStorage.getItem(`${lastVisitPrefix}:8`)).not.toBeNull();
    expect(localStorage.getItem(`${lastVisitPrefix}:7`)).toBe(fiveHoursAgo);
  });

  it('shows the overlay for the user whose own key is 4+ hours old', async () => {
    localStorage.setItem(`${lastVisitPrefix}:7`, fiveHoursAgo);
    renderWYAG(7);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
