/**
 * StaffActionLog: entries by a steward who is no longer on staff (Equoria-2yugk)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffActionLog from '../StaffActionLog';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const entry = (id: number, actorId: string, actorRole: string, targetId: string) => ({
  id,
  actorId,
  actorRole,
  capability: 'ticket.file',
  targetType: 'ticket',
  targetId,
  reason: 'Spam',
  before: null,
  after: null,
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-11T12:00:00.000Z',
});

describe('StaffActionLog: a former steward', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('names a listed steward and calls an unlisted actor a former steward with a short id', async () => {
    server.use(
      http.get(`${STAFF}/log`, () =>
        HttpResponse.json({
          entries: [
            entry(2, '1a2b3c4d-erased-account', 'moderator', '41'),
            entry(1, 'mod-willow-id', 'moderator', '40'),
          ],
          nextCursor: null,
        })
      ),
      http.get(`${STAFF}/log/actors`, () => HttpResponse.json({ actors: [] })),
      http.get(`${STAFF}/roles`, () =>
        HttpResponse.json({
          staff: [
            { id: 'admin-1', username: 'Hazel', role: 'admin' },
            { id: 'mod-willow-id', username: 'Willow', role: 'moderator' },
          ],
        })
      )
    );

    render(
      <QueryClientProvider client={queryClient}>
        <StaffActionLog
          selfId="admin-1"
          canSeeNames
          canFilter
          onCheckinRequired={() => undefined}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Willow filed ticket #40.')).toBeInTheDocument();
    expect(
      await screen.findByText('A former steward (#1a2b3c4d) filed ticket #41.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Moderator #1a2b3c4d/)).not.toBeInTheDocument();
  });
});

describe('StaffActionLog: the steward filter lists everyone in the ledger (STAFF-CR-16)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderAdminLedger = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffActionLog
          selfId="admin-1"
          canSeeNames
          canFilter
          onCheckinRequired={() => undefined}
        />
      </QueryClientProvider>
    );

  // Today's staff: only the admin. Willow was revoked; the other account was erased.
  const stubLedger = (actors: () => Response | Promise<Response>) => {
    const actorIds: (string | null)[] = [];
    server.use(
      http.get(`${STAFF}/log`, ({ request }) => {
        actorIds.push(new URL(request.url).searchParams.get('actorId'));
        return HttpResponse.json({
          entries: [entry(1, 'admin-1', 'admin', '40')],
          nextCursor: null,
        });
      }),
      http.get(`${STAFF}/log/actors`, actors),
      http.get(`${STAFF}/roles`, () =>
        HttpResponse.json({ staff: [{ id: 'admin-1', username: 'Hazel', role: 'admin' }] })
      )
    );
    return actorIds;
  };

  it('offers a revoked and an erased steward, and filters by either', async () => {
    const actorIds = stubLedger(() =>
      HttpResponse.json({
        actors: [
          { id: 'admin-1', username: 'Hazel' },
          { id: 'mod-willow-id', username: 'Willow' },
          { id: '1a2b3c4d-erased-account', username: null },
        ],
      })
    );
    const user = userEvent.setup();
    renderAdminLedger();
    const steward = await screen.findByLabelText('Steward');
    // Hazel is on staff and keeps her name; a revoked steward reads as the
    // entries do, with the last known username after the reference.
    await screen.findByRole('option', { name: 'Hazel' });
    expect(
      screen.getByRole('option', { name: 'a former steward (#mod-will) (Willow)' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Willow' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'a former steward (#1a2b3c4d)' })
    ).toBeInTheDocument();

    await user.selectOptions(steward, 'a former steward (#1a2b3c4d)');
    await waitFor(() => expect(actorIds).toContain('1a2b3c4d-erased-account'));
    await user.selectOptions(steward, 'a former steward (#mod-will) (Willow)');
    await waitFor(() => expect(actorIds).toContain('mod-willow-id'));
  });

  it('holds the steward choice while the list loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubLedger(async () => {
      await gate;
      return HttpResponse.json({ actors: [{ id: 'admin-1', username: 'Hazel' }] });
    });
    renderAdminLedger();
    const steward = await screen.findByLabelText('Steward');
    expect(steward).toBeDisabled();
    expect(steward).toHaveAttribute('aria-busy', 'true');
    release();
    await waitFor(() => expect(steward).not.toBeDisabled());
    expect(screen.getByRole('option', { name: 'Hazel' })).toBeInTheDocument();
  });

  it('shows a failed steward list at the filter, with a working retry', async () => {
    let fail = true;
    stubLedger(() =>
      fail
        ? HttpResponse.json({ success: false, message: 'db exploded' }, { status: 500 })
        : HttpResponse.json({ actors: [{ id: 'mod-willow-id', username: 'Willow' }] })
    );
    const user = userEvent.setup();
    renderAdminLedger();
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('db exploded');
    expect(screen.getByLabelText('Steward')).toBeDisabled();

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('option', { name: 'a former steward (#mod-will) (Willow)' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
