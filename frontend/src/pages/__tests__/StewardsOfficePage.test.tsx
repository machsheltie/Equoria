/**
 * The Steward's Office (Equoria-puj1e.1, Task 8)
 *
 * Boundary-level tests: the real staff hooks over the real apiClient, with the
 * HTTP boundary stubbed by MSW. No vi.mock of the api-client module or hooks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider, Routes, Route } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StewardsOfficePage from '../StewardsOfficePage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const MODERATOR_CAPS = [
  'warn',
  'freeze',
  'ban.account',
  'rename',
  'post.moderate',
  'post.review',
  'ticket.file',
  'log.view.own',
];
const ADMIN_CAPS = [
  'warn',
  'freeze',
  'ban.account',
  'rename',
  'post.moderate',
  'post.review',
  'log.view.own',
  'ticket.resolve',
  'log.view.all',
  'roles.manage',
];

const moderatorMe = { role: 'moderator', capabilities: MODERATOR_CAPS, trusted: true };
const adminMe = { role: 'admin', capabilities: ADMIN_CAPS, trusted: true };

const logEntry = {
  id: 7,
  actorId: 'admin-1',
  actorRole: 'admin',
  capability: 'roles.manage',
  targetType: 'player',
  targetId: 'mod-2',
  reason: 'Kind and steady in the forums',
  before: { role: 'user' },
  after: { role: 'moderator' },
  outcome: 'succeeded',
  error: null,
  reversesId: null,
  createdAt: '2026-10-10T15:00:00.000Z',
};

const staffList = {
  staff: [
    { id: 'admin-1', username: 'Stacey', role: 'admin' },
    { id: 'mod-2', username: 'Willow', role: 'moderator' },
  ],
};

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

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

interface StubOptions {
  me?: () => Response | Promise<Response>;
  log?: () => Response | Promise<Response>;
  roles?: () => Response | Promise<Response>;
  tickets?: () => Response | Promise<Response>;
}

function stubStaff(opts: StubOptions = {}) {
  server.use(
    http.get(`${STAFF}/me`, opts.me ?? (() => json(adminMe))),
    http.get(`${STAFF}/log`, opts.log ?? (() => json({ entries: [logEntry], nextCursor: null }))),
    http.get(`${STAFF}/roles`, opts.roles ?? (() => json(staffList))),
    http.get(`${STAFF}/tickets`, opts.tickets ?? (() => json({ tickets: [ticket] })))
  );
}

describe("The Steward's Office", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 'admin-1', username: 'Stacey' } as never}>
          <MemoryRouter initialEntries={['/steward']}>
            <Routes>
              <Route path="/" element={<p>Stable home</p>} />
              <Route path="/steward" element={<StewardsOfficePage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // ── /me gate ──────────────────────────────────────────────────────────────

  it('sends a non-staff player home, with no hint the office exists', async () => {
    stubStaff({ me: () => json({ success: false, message: 'Not found' }, 404) });
    renderPage();
    expect(await screen.findByText('Stable home')).toBeInTheDocument();
    expect(screen.queryByText(/steward/i)).not.toBeInTheDocument();
  });

  it('shows the loading state while /me is pending, not the redirect or the areas', async () => {
    stubStaff({
      me: async () => {
        await delay(150);
        return json(adminMe);
      },
    });
    renderPage();
    // PageLoading nests the shared GallopingLoader, so two status regions show.
    expect((await screen.findAllByRole('status', { name: 'Loading' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('Stable home')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ledger' })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
  });

  it('shows an error with a working retry when /me fails for another reason', async () => {
    let calls = 0;
    stubStaff({
      me: () => {
        calls += 1;
        return calls === 1 ? json({ message: 'db exploded' }, 500) : json(adminMe);
      },
    });
    const user = userEvent.setup();
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(screen.queryByText(/db exploded/)).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
  });

  // ── Check-in ──────────────────────────────────────────────────────────────

  it('checks in: requests a code, sends {code}, then shows the areas', async () => {
    let trusted = false;
    let verifyBody: unknown = null;
    let requested = 0;
    stubStaff({ me: () => json({ ...moderatorMe, trusted }) });
    server.use(
      http.post(`${STAFF}/checkin/request`, () => {
        requested += 1;
        return json({ sent: true }, 202);
      }),
      http.post(`${STAFF}/checkin/verify`, async ({ request }) => {
        verifyBody = await request.json();
        trusted = true;
        return json({ trusted: true });
      })
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Check in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ledger' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send my code' }));
    await user.type(await screen.findByLabelText('Your code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    expect(requested).toBe(1);
    expect(verifyBody).toEqual({ code: '123456' });
    expect(screen.queryByRole('heading', { name: 'Check in' })).not.toBeInTheDocument();
  });

  it('a wrong code shows an inline error at the field and keeps the typed code', async () => {
    stubStaff({ me: () => json({ ...moderatorMe, trusted: false }) });
    server.use(
      http.post(`${STAFF}/checkin/request`, () => json({ sent: true }, 202)),
      http.post(`${STAFF}/checkin/verify`, () =>
        json({ success: false, code: 'STAFF_CHECKIN_CODE_INVALID', message: 'raw server' }, 400)
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send my code' }));
    const input = await screen.findByLabelText('Your code');
    await user.type(input, '999999');
    await user.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/that code didn't work/i);
    expect(screen.queryByText('raw server')).not.toBeInTheDocument();
    expect(input).toHaveValue('999999');
  });

  it('an unverified email is refused with a mapped message when requesting a code', async () => {
    stubStaff({ me: () => json({ ...moderatorMe, trusted: false }) });
    server.use(
      http.post(`${STAFF}/checkin/request`, () =>
        json({ success: false, code: 'STAFF_EMAIL_UNVERIFIED', message: 'raw' }, 409)
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send my code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/verify your email address/i);
  });

  it('returns to check-in when an area reports the device check-in has lapsed', async () => {
    stubStaff({
      me: () => json(moderatorMe),
      log: () =>
        json({ success: false, code: 'STAFF_CHECKIN_REQUIRED', message: 'Check in first' }, 403),
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Check in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ledger' })).not.toBeInTheDocument();
  });

  // ── Areas by capability ───────────────────────────────────────────────────

  it('a moderator sees the Ledger and Tickets but not Stewards', async () => {
    stubStaff({ me: () => json(moderatorMe) });
    renderPage();
    expect(
      await screen.findByRole('heading', { name: "The Steward's Office", level: 1 })
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stewards' })).not.toBeInTheDocument();
    // Moderators file tickets; only the admin changes status.
    expect(screen.getByRole('button', { name: 'File ticket' })).toBeInTheDocument();
  });

  it('the admin sees all three areas, without the moderator-only file form', async () => {
    stubStaff({ me: () => json(adminMe) });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stewards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'File ticket' })).not.toBeInTheDocument();
  });

  // ── Ledger four states ────────────────────────────────────────────────────

  it('ledger: loading region while the log is pending', async () => {
    stubStaff({
      log: async () => {
        await delay(150);
        return json({ entries: [], nextCursor: null });
      },
    });
    renderPage();
    expect(await screen.findByRole('status', { name: /loading the ledger/i })).toBeInTheDocument();
    expect(screen.queryByText('The ledger is empty')).not.toBeInTheDocument();
  });

  it('ledger: error shows retry wired to refetch, never a false empty', async () => {
    let calls = 0;
    stubStaff({
      log: () => {
        calls += 1;
        return calls === 1
          ? json({ message: 'log boom' }, 500)
          : json({ entries: [logEntry], nextCursor: null });
      },
      tickets: () => json({ tickets: [] }),
    });
    const user = userEvent.setup();
    renderPage();
    const ledger = await screen.findByRole('region', { name: 'Ledger' });
    const alert = await within(ledger).findByRole('alert');
    expect(screen.queryByText('The ledger is empty')).not.toBeInTheDocument();
    expect(screen.queryByText(/log boom/)).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await within(ledger).findByText(/Kind and steady in the forums/)).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('ledger: empty state only after a successful empty read', async () => {
    stubStaff({ log: () => json({ entries: [], nextCursor: null }) });
    renderPage();
    expect(await screen.findByText('The ledger is empty')).toBeInTheDocument();
  });

  it('ledger: entries read as plain sentences with actor, action, target, reason and time', async () => {
    stubStaff();
    renderPage();
    const ledger = await screen.findByRole('region', { name: 'Ledger' });
    const item = await within(ledger).findByRole('listitem');
    // The target's name resolves from the staff list once it has loaded.
    await waitFor(() => expect(item).toHaveTextContent('You made Willow a moderator'));
    expect(item).toHaveTextContent('Kind and steady in the forums');
    expect(item).toHaveTextContent(/Oct 10, 2026/);
  });

  it('ledger: older entries load from the cursor', async () => {
    const older = {
      ...logEntry,
      id: 3,
      reason: 'An older note',
      createdAt: '2026-10-01T10:00:00Z',
    };
    stubStaff({ tickets: () => json({ tickets: [] }) });
    server.use(
      http.get(`${STAFF}/log`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        return cursor === '7'
          ? json({ entries: [older], nextCursor: null })
          : json({ entries: [logEntry], nextCursor: 7 });
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Show older entries' }));
    expect(await screen.findByText(/An older note/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older entries' })).not.toBeInTheDocument();
  });

  // ── Ledger filter (admin only) ────────────────────────────────────────────

  /** Records every ledger request URL's query string. */
  function recordLogQueries() {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get(`${STAFF}/log`, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return json({ entries: [logEntry], nextCursor: null });
      })
    );
    return queries;
  }

  it('ledger filter: the admin chooses a steward and the request carries actorId', async () => {
    stubStaff();
    const queries = recordLogQueries();
    const user = userEvent.setup();
    renderPage();
    const steward = await screen.findByLabelText('Steward');
    await screen.findByRole('option', { name: 'Willow' });
    await user.selectOptions(steward, 'Willow');
    await waitFor(() => expect(queries.some((q) => q.get('actorId') === 'mod-2')).toBe(true));
    const filtered = queries.find((q) => q.get('actorId') === 'mod-2');
    expect(filtered?.get('cursor')).toBeNull();
  });

  it('ledger filter: choosing an action sends capability', async () => {
    stubStaff();
    const queries = recordLogQueries();
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByLabelText('Action'), 'filing tickets');
    await waitFor(() =>
      expect(queries.some((q) => q.get('capability') === 'ticket.file')).toBe(true)
    );
  });

  it('ledger: a ticket reply and a check-in read as plain sentences', async () => {
    const reply = {
      ...logEntry,
      id: 9,
      actorId: 'mod-2',
      actorRole: 'moderator',
      capability: 'ticket.reply',
      targetType: 'ticket',
      targetId: '12',
      reason: null,
      before: null,
      after: null,
    };
    const checkin = {
      ...reply,
      id: 8,
      capability: 'staff.checkin',
      targetType: 'device',
      targetId: '31',
    };
    stubStaff();
    server.use(
      http.get(`${STAFF}/log`, () => json({ entries: [reply, checkin], nextCursor: null }))
    );
    renderPage();
    const ledger = await screen.findByRole('region', { name: 'Ledger' });
    expect(await within(ledger).findByText('Willow replied to ticket #12.')).toBeInTheDocument();
    expect(within(ledger).getByText('Willow checked in to the office.')).toBeInTheDocument();
  });

  it('ledger filter: Ticket replies and Check-ins send their capability', async () => {
    stubStaff();
    const queries = recordLogQueries();
    const user = userEvent.setup();
    renderPage();
    const action = await screen.findByLabelText('Action');
    await user.selectOptions(action, 'Ticket replies');
    await waitFor(() =>
      expect(queries.some((q) => q.get('capability') === 'ticket.reply')).toBe(true)
    );
    await user.selectOptions(action, 'Check-ins');
    await waitFor(() =>
      expect(queries.some((q) => q.get('capability') === 'staff.checkin')).toBe(true)
    );
  });

  it('ledger filter: a moderator does not see the filter line', async () => {
    stubStaff({ me: () => json(moderatorMe) });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Steward')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Action')).not.toBeInTheDocument();
  });

  // ── /me refetch after the office has loaded ───────────────────────────────

  it('a failed background /me refetch keeps the office and an open dialog with its reason', async () => {
    let meFails = false;
    stubStaff({ me: () => (meFails ? json({ message: 'boom' }, 500) : json(adminMe)) });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Revoke Willow' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).getByLabelText(/reason/i);
    await user.type(reason, 'Half-written reason');

    meFails = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['staff', 'me'] });
    });
    await waitFor(() => expect(queryClient.getQueryState(['staff', 'me'])?.status).toBe('error'));
    // Let the query observer's batched notification reach React before asserting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(reason).toHaveValue('Half-written reason');
    expect(screen.getByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
  });

  it('a /me refetch that answers 404 (access revoked) still sends the visitor home', async () => {
    let revoked = false;
    stubStaff({
      me: () => (revoked ? json({ success: false, message: 'Not found' }, 404) : json(adminMe)),
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Ledger' })).toBeInTheDocument();
    revoked = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['staff', 'me'] });
    });
    expect(await screen.findByText('Stable home')).toBeInTheDocument();
  });

  // ── Stewards (roles) ──────────────────────────────────────────────────────

  it('revoking a moderator requires a reason and a confirmation', async () => {
    let roleBody: unknown = null;
    let revoked = false;
    stubStaff({
      roles: () => json(revoked ? { staff: [staffList.staff[0]] } : staffList),
    });
    server.use(
      http.post(`${STAFF}/roles/mod-2`, async ({ request }) => {
        roleBody = await request.json();
        revoked = true;
        return json({ id: 'mod-2', username: 'Willow', role: 'user' });
      })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Revoke Willow' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Revoke role' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), '   ');
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/reason/i), 'Stepped away from the game');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(roleBody).toEqual({ role: 'user', reason: 'Stepped away from the game' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Revoke Willow' })).not.toBeInTheDocument()
    );
  });

  it('a failed role change shows an inline error and keeps the typed reason', async () => {
    stubStaff();
    server.use(
      http.post(`${STAFF}/roles/mod-2`, () =>
        json({ success: false, message: 'Role changed meanwhile' }, 409)
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Revoke Willow' }));
    const dialog = await screen.findByRole('dialog');
    const reason = within(dialog).getByLabelText(/reason/i);
    await user.type(reason, 'Stepped away');
    await user.click(within(dialog).getByRole('button', { name: 'Revoke role' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/changed meanwhile/i);
    expect(screen.queryByText('Role changed meanwhile')).not.toBeInTheDocument();
    expect(reason).toHaveValue('Stepped away');
  });

  it('finds a player by username and promotes them with a reason', async () => {
    let roleBody: unknown = null;
    stubStaff();
    server.use(
      http.post(`${STAFF}/roles/lookup`, () =>
        json({ id: 'p-9', username: 'Juniper', role: 'user' })
      ),
      http.post(`${STAFF}/roles/p-9`, async ({ request }) => {
        roleBody = await request.json();
        return json({ id: 'p-9', username: 'Juniper', role: 'moderator' });
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Player's username"), 'Juniper');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    await user.click(await screen.findByRole('button', { name: 'Make Juniper a moderator' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/reason/i), 'Trusted helper');
    await user.click(within(dialog).getByRole('button', { name: 'Make moderator' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(roleBody).toEqual({ role: 'moderator', reason: 'Trusted helper' });
    expect(await screen.findByText(/Juniper is a moderator/)).toBeInTheDocument();
  });

  it('an unknown username shows an inline error at the lookup', async () => {
    stubStaff();
    server.use(
      http.post(`${STAFF}/roles/lookup`, () =>
        json({ success: false, message: 'No player has that username' }, 404)
      )
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Player's username"), 'Nobody');
    await user.click(screen.getByRole('button', { name: 'Find' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no player goes by that name/i);
  });

  // ── Tickets four states ───────────────────────────────────────────────────

  it('tickets: loading region while the list is pending', async () => {
    stubStaff({
      tickets: async () => {
        await delay(150);
        return json({ tickets: [] });
      },
    });
    renderPage();
    expect(await screen.findByRole('status', { name: /loading tickets/i })).toBeInTheDocument();
  });

  it('tickets: list error shows retry wired to refetch', async () => {
    let calls = 0;
    stubStaff({
      log: () => json({ entries: [], nextCursor: null }),
      tickets: () => {
        calls += 1;
        return calls === 1 ? json({ message: 'ticket boom' }, 500) : json({ tickets: [ticket] });
      },
    });
    const user = userEvent.setup();
    renderPage();
    const section = await screen.findByRole('region', { name: 'Tickets' });
    const alert = await within(section).findByRole('alert');
    expect(within(section).queryByText(/no tickets/i)).not.toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await within(section).findByText(/Offensive name/)).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('tickets: empty state only after a successful empty read', async () => {
    stubStaff({ tickets: () => json({ tickets: [] }) });
    renderPage();
    const section = await screen.findByRole('region', { name: 'Tickets' });
    expect(await within(section).findByText('No tickets yet')).toBeInTheDocument();
  });

  it('tickets: the admin opens a ticket, reads its thread and sets its status', async () => {
    let statusBody: unknown = null;
    stubStaff();
    server.use(
      http.get(`${STAFF}/tickets/12`, () =>
        json({
          ticket: {
            ...ticket,
            replies: [
              {
                id: 1,
                ticketId: 12,
                authorId: 'mod-2',
                author: { id: 'mod-2', username: 'Willow' },
                body: 'Screenshot is in the forum report.',
                createdAt: '2026-10-11T13:00:00.000Z',
              },
            ],
          },
        })
      ),
      http.post(`${STAFF}/tickets/12/status`, async ({ request }) => {
        statusBody = await request.json();
        return json({ ticket: { ...ticket, status: 'resolved' } });
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /ticket #12/i }));
    expect(await screen.findByText('Screenshot is in the forum report.')).toBeInTheDocument();
    expect(screen.getByText('This horse name is a slur.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'resolved');
    await user.click(screen.getByRole('button', { name: 'Update status' }));
    await waitFor(() => expect(statusBody).toEqual({ status: 'resolved' }));
  });

  it('tickets: a moderator files a ticket and the form clears on success', async () => {
    let fileBody: unknown = null;
    let filed = false;
    stubStaff({
      me: () => json(moderatorMe),
      tickets: () => json({ tickets: filed ? [ticket] : [] }),
    });
    server.use(
      http.post(`${STAFF}/tickets`, async ({ request }) => {
        fileBody = await request.json();
        filed = true;
        return json({ ticket }, 201);
      })
    );
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByLabelText('About'), 'horse');
    await user.type(screen.getByLabelText('Their ID'), '345');
    await user.type(screen.getByLabelText('Category'), 'Offensive name');
    await user.type(screen.getByLabelText('Note'), 'This horse name is a slur.');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));

    expect(await screen.findByRole('button', { name: /ticket #12/i })).toBeInTheDocument();
    expect(fileBody).toEqual({
      targetType: 'horse',
      targetId: '345',
      category: 'Offensive name',
      note: 'This horse name is a slur.',
    });
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('tickets: a failed filing keeps what was typed and explains at the button', async () => {
    stubStaff({ me: () => json(moderatorMe), tickets: () => json({ tickets: [] }) });
    server.use(http.post(`${STAFF}/tickets`, () => json({ message: 'boom' }, 500)));
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Their ID'), '345');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.getByLabelText('Note')).toHaveValue('Selling coins');
  });

  // ── Revoked mid-visit ─────────────────────────────────────────────────────

  /** /me answers as a moderator once, then as nobody (revoked). */
  const revokedAfterFirstMe = () => {
    let meCalls = 0;
    return () => {
      meCalls += 1;
      return meCalls === 1
        ? json(moderatorMe)
        : json({ success: false, message: 'Not found' }, 404);
    };
  };

  it('an area read that gets a 404 re-asks /me, and a revoked steward is sent home', async () => {
    stubStaff({
      me: revokedAfterFirstMe(),
      tickets: () => json({ success: false, message: 'Not found' }, 404),
    });
    renderPage();
    expect(await screen.findByText('Stable home')).toBeInTheDocument();
    expect(screen.queryByTestId('stewards-office')).not.toBeInTheDocument();
  });

  it('an action that gets a 404 re-asks /me, and a revoked steward is sent home', async () => {
    stubStaff({ me: revokedAfterFirstMe(), tickets: () => json({ tickets: [] }) });
    server.use(
      http.post(`${STAFF}/tickets`, () => json({ success: false, message: 'Not found' }, 404))
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Their ID'), '345');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByText('Stable home')).toBeInTheDocument();
  });

  it('a 404 for a steward who is still staff leaves the office open', async () => {
    stubStaff({
      me: () => json(moderatorMe),
      tickets: () => json({ tickets: [] }),
    });
    server.use(
      http.post(`${STAFF}/tickets`, () => json({ success: false, message: 'Not found' }, 404))
    );
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Their ID'), '345');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('stewards-office')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toHaveValue('Selling coins');
  });
});
