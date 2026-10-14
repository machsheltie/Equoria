/**
 * A failed background refresh is visible (Task 4 review carry-over)
 *
 * When a refetch fails while loaded data is on screen, the data stays and a
 * notice at the section says it may be out of date, with a working retry.
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { staffKeys } from '@/hooks/api/useStaff';
import StaffActionLog from '../StaffActionLog';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });
const serverDown = () => json({ success: false, message: 'db exploded at row 7' }, 500);

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

const logEntry = {
  id: 7,
  actorId: 'admin-1',
  actorRole: 'admin',
  capability: 'staff.checkin',
  targetType: 'device',
  targetId: null,
  reason: null,
  before: null,
  after: null,
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-10T15:00:00.000Z',
};

describe('A failed background refresh keeps the data and says so', () => {
  let queryClient: QueryClient;
  let failing: boolean;

  beforeEach(() => {
    failing = false;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(
      http.get(`${STAFF}/tickets`, () =>
        failing ? serverDown() : json({ tickets: [ticket], nextCursor: null })
      ),
      http.get(`${STAFF}/tickets/12`, () =>
        failing ? serverDown() : json({ ticket: { ...ticket, replies: [] } })
      ),
      http.get(`${STAFF}/log`, () =>
        failing ? serverDown() : json({ entries: [logEntry], nextCursor: null })
      )
    );
  });

  const refreshAll = async () => {
    failing = true;
    await act(() => queryClient.refetchQueries({ queryKey: staffKeys.all }));
  };

  async function expectNoticeThenRetry(user: ReturnType<typeof userEvent.setup>, kept: string) {
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not refresh .*; this may be out of date\./);
    expect(alert).not.toHaveTextContent('db exploded');
    expect(screen.getByText(kept)).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText(kept)).toBeInTheDocument();
  }

  it('the ticket list', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile={false} canResolve onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );
    expect(await screen.findByText('Ticket #12: Offensive name')).toBeInTheDocument();
    await refreshAll();
    await expectNoticeThenRetry(user, 'Ticket #12: Offensive name');
  });

  it('an open ticket thread', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile={false} canResolve={false} onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );
    await user.click(await screen.findByText('Ticket #12: Offensive name'));
    expect(await screen.findByText('This horse name is a slur.')).toBeInTheDocument();
    failing = true;
    await act(() => queryClient.refetchQueries({ queryKey: staffKeys.ticket(12) }));
    await expectNoticeThenRetry(user, 'This horse name is a slur.');
  });

  it('the ledger', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <StaffActionLog
          selfId="admin-1"
          canSeeNames={false}
          canFilter={false}
          onCheckinRequired={() => undefined}
        />
      </QueryClientProvider>
    );
    expect(await screen.findByText('You checked in to the office.')).toBeInTheDocument();
    await refreshAll();
    await expectNoticeThenRetry(user, 'You checked in to the office.');
  });
});
