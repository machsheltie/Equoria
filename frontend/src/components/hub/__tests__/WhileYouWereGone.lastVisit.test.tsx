/**
 * WhileYouWereGone: the last-visit time moves on DISMISSAL, not on mount
 * (Equoria-oey96.53, Story 24.2/24.3).
 *
 * Writing "now" the moment the overlay mounts meant a player who closed the tab
 * before reading it had those events marked "seen". The summary is only
 * consumed when she dismisses it: Continue, the X, Escape, the backdrop, or
 * following one of its links all count. A visit that shows no overlay (a short
 * absence) still refreshes the time on mount, as before.
 *
 * Real component, real useWhileYouWereGone hook, real AuthContext provider,
 * MSW at the network boundary (same arrangement as WhileYouWereGone.test.tsx).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MockAuthProvider, defaultMockUser } from '@/test/utils';
import { server } from '@/test/msw/server';
import { WhileYouWereGone } from '../WhileYouWereGone';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const wyagPath = `${base}/api/v1/while-you-were-gone`;

const scopedKey = `equoria-last-visit:${defaultMockUser.id}`;
const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

const items = [
  {
    type: 'competition-result' as const,
    priority: 1,
    title: 'Thunder won 1st place!',
    description: 'Dressage Grand Prix',
    timestamp: new Date().toISOString(),
    actionUrl: '/competitions/1',
  },
];

function renderWYAG() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <WhileYouWereGone />
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

const storedLastVisit = () => localStorage.getItem(scopedKey);

describe('WhileYouWereGone last-visit timing (Equoria-oey96.53)', () => {
  beforeEach(() => {
    localStorage.clear();
    server.use(
      http.get(wyagPath, () =>
        HttpResponse.json({
          success: true,
          data: { items, since: fiveHoursAgo, hasMore: false },
        })
      )
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('leaves the last-visit time alone while the overlay is open and undismissed', async () => {
    localStorage.setItem(scopedKey, fiveHoursAgo);
    renderWYAG();
    await screen.findByRole('dialog');
    await screen.findByText('Thunder won 1st place!');

    expect(storedLastVisit()).toBe(fiveHoursAgo);
  });

  it('closing the tab with the overlay still open does not mark the events seen', async () => {
    localStorage.setItem(scopedKey, fiveHoursAgo);
    renderWYAG();
    await screen.findByRole('dialog');

    window.dispatchEvent(new Event('beforeunload'));

    expect(storedLastVisit()).toBe(fiveHoursAgo);
  });

  it.each([
    ['the Continue button', () => fireEvent.click(screen.getByText('Continue to Stable'))],
    ['the X button', () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))],
    ['the Escape key', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('dismissing with %s records the visit', async (_label, dismiss) => {
    localStorage.setItem(scopedKey, fiveHoursAgo);
    renderWYAG();
    await screen.findByRole('dialog');

    dismiss();

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storedLastVisit()).not.toBe(fiveHoursAgo);
    expect(Date.now() - new Date(storedLastVisit() as string).getTime()).toBeLessThan(60_000);
  });

  it('clicking the backdrop records the visit', async () => {
    localStorage.setItem(scopedKey, fiveHoursAgo);
    renderWYAG();
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(dialog.querySelector('[aria-hidden="true"]') as HTMLElement);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storedLastVisit()).not.toBe(fiveHoursAgo);
  });

  it('following an item link inside the overlay counts as dismissal', async () => {
    localStorage.setItem(scopedKey, fiveHoursAgo);
    renderWYAG();
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(await within(dialog).findByRole('link', { name: /Thunder won 1st place!/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(storedLastVisit()).not.toBe(fiveHoursAgo);
  });

  it('a short absence shows no overlay and still refreshes the time on mount', async () => {
    localStorage.setItem(scopedKey, oneHourAgo);
    renderWYAG();

    await waitFor(() => expect(storedLastVisit()).not.toBe(oneHourAgo));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a first-ever visit (no stored time) records it on mount', async () => {
    renderWYAG();

    await waitFor(() => expect(storedLastVisit()).not.toBeNull());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
