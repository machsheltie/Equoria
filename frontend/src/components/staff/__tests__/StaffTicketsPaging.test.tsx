/**
 * StaffTickets: older tickets and earlier replies (STAFF-CR-03, STAFF-CR-09)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 * The list and a thread each load one page; the rest comes on request, and a
 * failed request shows at its own control while what was loaded stays.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

const ticketNo = (id: number) => ({
  id,
  filedById: 'mod-2',
  filedBy: { id: 'mod-2', username: 'Willow' },
  targetType: 'post',
  targetId: '77',
  category: `Case ${id}`,
  note: `Note ${id}`,
  status: 'open',
  createdAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-11T12:00:00.000Z',
});

const replyNo = (id: number) => ({
  id,
  ticketId: 5,
  authorId: 'admin-1',
  author: { id: 'admin-1', username: 'Hazel' },
  body: `Reply ${id}`,
  createdAt: '2026-10-11T13:00:00.000Z',
});

describe('StaffTickets: paging', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderTickets = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile={false} canResolve onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

  it('shows older tickets on request, passing the cursor, until there are no more', async () => {
    const cursors: (string | null)[] = [];
    server.use(
      http.get(`${STAFF}/tickets`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        return cursor === 'older-1'
          ? json({ tickets: [ticketNo(2), ticketNo(1)], nextCursor: null })
          : json({ tickets: [ticketNo(4), ticketNo(3)], nextCursor: 'older-1' });
      })
    );
    const user = userEvent.setup();
    renderTickets();

    expect(await screen.findByText('Ticket #4: Case 4')).toBeInTheDocument();
    expect(screen.queryByText('Ticket #2: Case 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show older tickets' }));

    expect(await screen.findByText('Ticket #2: Case 2')).toBeInTheDocument();
    expect(screen.getByText('Ticket #4: Case 4')).toBeInTheDocument();
    expect(cursors).toEqual([null, 'older-1']);
    expect(screen.queryByRole('button', { name: 'Show older tickets' })).not.toBeInTheDocument();
  });

  it('keeps the loaded tickets and shows the failure at the button when older ones fail', async () => {
    let failOlder = true;
    server.use(
      http.get(`${STAFF}/tickets`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === null) {
          return json({ tickets: [ticketNo(4)], nextCursor: 'older-1' });
        }
        return failOlder
          ? json({ success: false, message: 'boom' }, 500)
          : json({ tickets: [ticketNo(1)], nextCursor: null });
      })
    );
    const user = userEvent.setup();
    renderTickets();

    await user.click(await screen.findByRole('button', { name: 'Show older tickets' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ticket #4: Case 4')).toBeInTheDocument();

    failOlder = false;
    await user.click(screen.getByRole('button', { name: 'Show older tickets' }));
    expect(await screen.findByText('Ticket #1: Case 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows earlier replies above the latest ones, in reading order', async () => {
    const befores: (string | null)[] = [];
    server.use(
      http.get(`${STAFF}/tickets`, () => json({ tickets: [ticketNo(5)], nextCursor: null })),
      http.get(`${STAFF}/tickets/5`, ({ request }) => {
        const before = new URL(request.url).searchParams.get('before');
        befores.push(before);
        return before === 'earlier-1'
          ? json({
              ticket: { ...ticketNo(5), replies: [replyNo(1), replyNo(2)] },
              olderRepliesCursor: null,
            })
          : json({
              ticket: { ...ticketNo(5), replies: [replyNo(3), replyNo(4)] },
              olderRepliesCursor: 'earlier-1',
            });
      })
    );
    const user = userEvent.setup();
    renderTickets();

    await user.click(await screen.findByText('Ticket #5: Case 5'));
    expect(await screen.findByText('Reply 4')).toBeInTheDocument();
    expect(screen.queryByText('Reply 1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show earlier replies' }));

    expect(await screen.findByText('Reply 1')).toBeInTheDocument();
    const thread = screen.getByRole('list', { name: 'Replies' });
    expect(
      within(thread)
        .getAllByText(/^Reply \d$/)
        .map((node) => node.textContent)
    ).toEqual(['Reply 1', 'Reply 2', 'Reply 3', 'Reply 4']);
    expect(befores).toEqual([null, 'earlier-1']);
    expect(screen.queryByRole('button', { name: 'Show earlier replies' })).not.toBeInTheDocument();
  });

  it('keeps the latest replies and shows the failure at the button when earlier ones fail', async () => {
    server.use(
      http.get(`${STAFF}/tickets`, () => json({ tickets: [ticketNo(5)], nextCursor: null })),
      http.get(`${STAFF}/tickets/5`, ({ request }) =>
        new URL(request.url).searchParams.get('before')
          ? json({ success: false, message: 'boom' }, 500)
          : json({
              ticket: { ...ticketNo(5), replies: [replyNo(3)] },
              olderRepliesCursor: 'earlier-1',
            })
      )
    );
    const user = userEvent.setup();
    renderTickets();

    await user.click(await screen.findByText('Ticket #5: Case 5'));
    await user.click(await screen.findByRole('button', { name: 'Show earlier replies' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Reply 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show earlier replies' })).toBeInTheDocument();
  });
});
