/**
 * A ticket reply refreshes the Ledger (STAFF-CR-15)
 *
 * The backend writes a `ticket.reply` ledger entry in the reply's own
 * transaction, so a successful reply must refresh both the thread and the
 * ledger. The real staff hooks over the real apiClient; MSW stubs the HTTP
 * boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { server } from '@/test/msw/server';
import { staffKeys, useReplyToTicket } from '@/hooks/api/useStaff';
import StaffActionLog from '../StaffActionLog';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

const ticket = {
  id: 12,
  filedById: 'mod-2',
  filedBy: { id: 'mod-2', username: 'Willow' },
  targetType: 'horse',
  targetId: '345',
  category: 'Offensive name',
  note: 'This horse name is a slur.',
  status: 'open',
  createdAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-11T12:00:00.000Z',
};

const replyEntry = {
  id: 90,
  actorId: 'admin-1',
  actorRole: 'admin',
  capability: 'ticket.reply',
  targetType: 'ticket',
  targetId: '12',
  reason: null,
  before: null,
  after: null,
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-11T13:00:00.000Z',
};

describe('A ticket reply refreshes the Ledger (STAFF-CR-15)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('invalidates the ticket and every ledger query after a reply', async () => {
    server.use(
      http.post(`${STAFF}/tickets/12/replies`, () =>
        json({ reply: { id: 1, ticketId: 12, body: 'On it.' } }, 201)
      )
    );
    const ledgerKey = [...staffKeys.log, { actorId: '', capability: '' }];
    const filteredKey = [...staffKeys.log, { actorId: 'mod-2', capability: '' }];
    for (const key of [staffKeys.ticket(12), ledgerKey, filteredKey, staffKeys.ticket(13)]) {
      queryClient.setQueryData(key, { pages: [], pageParams: [] });
    }
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useReplyToTicket(12), { wrapper });

    await act(() => result.current.mutateAsync('On it.'));

    const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;
    expect(invalidated(staffKeys.ticket(12))).toBe(true);
    expect(invalidated(ledgerKey)).toBe(true);
    expect(invalidated(filteredKey)).toBe(true);
    expect(invalidated(staffKeys.ticket(13))).toBe(false);
  });

  it('shows the reply in the open Ledger without a reload', async () => {
    let replied = false;
    server.use(
      http.get(`${STAFF}/tickets`, () => json({ tickets: [ticket], nextCursor: null })),
      http.get(`${STAFF}/tickets/12`, () =>
        json({ ticket: { ...ticket, replies: [] }, olderRepliesCursor: null })
      ),
      http.post(`${STAFF}/tickets/12/replies`, () => {
        replied = true;
        return json({ reply: { id: 1, ticketId: 12, body: 'On it.' } }, 201);
      }),
      http.get(`${STAFF}/log`, () =>
        json({ entries: replied ? [replyEntry] : [], nextCursor: null })
      )
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile={false} canResolve={false} onCheckinRequired={() => undefined} />
        <StaffActionLog
          selfId="admin-1"
          canSeeNames={false}
          canFilter={false}
          onCheckinRequired={() => undefined}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('The ledger is empty')).toBeInTheDocument();
    await user.click(await screen.findByText('Ticket #12: Offensive name'));
    await user.type(await screen.findByLabelText('Your reply'), 'On it.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByText('You replied to ticket #12.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('The ledger is empty')).not.toBeInTheDocument());
  });
});
