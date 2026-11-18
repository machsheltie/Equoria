/**
 * StaffForumReports: posts players have reported (Equoria-puj1e.3, owner ruling
 * q382). Each report shows who reported whose post, why, the note, the post and a
 * link to its thread; Mark resolved or Dismiss sends the decision and the report
 * leaves the list.
 *
 * The real hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import StaffForumReports from '../StaffForumReports';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const REPORTS = `${base}/api/v1/staff/forum/reports`;

const rude = {
  id: 5,
  reason: 'rudeOrBullying',
  note: null,
  createdAt: '2026-11-18T09:30:00Z',
  reporter: { id: 'p-1', username: 'Willow' },
  post: {
    id: 71,
    content: 'You ride like a sack of oats',
    status: 'published',
    author: { id: 'p-2', username: 'Bramble' },
    thread: { id: 7, title: 'Spring foals' },
  },
};
const other = {
  ...rude,
  id: 6,
  reason: 'other',
  note: 'Copied my art',
  post: { ...rude.post, id: 80, content: 'Look at my painting', thread: { id: 8, title: 'Art' } },
};

describe('StaffForumReports', () => {
  let queryClient: QueryClient;
  let waiting: (typeof rude)[];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    waiting = [rude, other];
    server.use(http.get(REPORTS, () => HttpResponse.json({ reports: waiting, nextAfter: null })));
  });

  const renderIt = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffForumReports onCheckinRequired={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('lists each report with reporter, author, reason in words, note, post and thread link', async () => {
    renderIt();
    const first = await screen.findByTestId('forum-report-5');
    expect(first).toHaveTextContent("Willow reported Bramble's post in Spring foals");
    expect(first).toHaveTextContent('Rude or bullying');
    expect(first).toHaveTextContent('You ride like a sack of oats');
    expect(within(first).getByRole('link', { name: 'Spring foals' })).toHaveAttribute(
      'href',
      '/message-board/7'
    );
    expect(first).not.toHaveTextContent('rudeOrBullying');
    expect(screen.getByTestId('forum-report-6')).toHaveTextContent('Other: Copied my art');
  });

  it('resolving a report sends the ledger note and the report leaves the list', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${REPORTS}/5/resolve`, async ({ request }) => {
        sent = await request.json();
        waiting = [other];
        return HttpResponse.json({ id: 5, status: 'resolved' });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('forum-report-5');
    await user.type(within(row).getByRole('textbox'), 'Removed the insult');
    await user.click(within(row).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(screen.queryByTestId('forum-report-5')).toBeNull());
    expect(sent).toEqual({ reason: 'Removed the insult' });
  });

  it('dismissing without a note sends no reason', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${REPORTS}/6/dismiss`, async ({ request }) => {
        sent = await request.json();
        waiting = [rude];
        return HttpResponse.json({ id: 6, status: 'dismissed' });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('forum-report-6');
    await user.click(within(row).getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByTestId('forum-report-6')).toBeNull());
    expect(sent).toEqual({});
  });

  it('says so beside the buttons when another steward already decided it', async () => {
    server.use(
      http.post(`${REPORTS}/5/dismiss`, () =>
        HttpResponse.json(
          { success: false, code: 'forumReportDecided', message: 'x' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('forum-report-5');
    await user.click(within(row).getByRole('button', { name: 'Dismiss' }));
    expect(
      await within(row).findByText('Another steward has already decided this report.')
    ).toBeInTheDocument();
  });

  it('says honestly when nothing is waiting', async () => {
    waiting = [];
    renderIt();
    expect(await screen.findByText('No reports are waiting.')).toBeInTheDocument();
  });
});
