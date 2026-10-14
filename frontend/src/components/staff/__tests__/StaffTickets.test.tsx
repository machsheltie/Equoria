/**
 * StaffTickets: naming a player by username or ID (Equoria-puj1e.1)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

const ticket = {
  id: 12,
  filedById: 'mod-2',
  filedBy: { id: 'mod-2', username: 'Willow' },
  targetType: 'user',
  targetId: 'u-1',
  category: 'Spam',
  note: 'Selling coins',
  status: 'open',
  createdAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-11T12:00:00.000Z',
};

function stubTickets(tickets: unknown[] = []) {
  server.use(http.get(`${STAFF}/tickets`, () => json({ tickets })));
}

describe('StaffTickets: the player a ticket is about', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const renderTickets = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile canResolve={false} onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

  async function fillRest(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
  }

  it('names a player by username by default and by ID on request', async () => {
    const bodies: unknown[] = [];
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, async ({ request }) => {
        bodies.push(await request.json());
        return json({ ticket }, 201);
      })
    );
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), '  Mara  ');
    await fillRest(user);
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      targetType: 'user',
      targetUsername: 'Mara',
      category: 'Spam',
      note: 'Selling coins',
    });

    await user.selectOptions(screen.getByLabelText('Find the player'), 'id');
    await user.type(screen.getByLabelText('Their ID'), 'abc-123');
    await fillRest(user);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      targetType: 'user',
      targetId: 'abc-123',
      category: 'Spam',
      note: 'Selling coins',
    });
  });

  it('shows an unknown player at the field and keeps what was typed', async () => {
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, () =>
        json({ success: false, message: 'No player by that name or ID', code: 'NO_PLAYER' }, 404)
      )
    );
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), 'Nobody');
    await fillRest(user);
    expect(await screen.findByText('No player by that name or ID.')).toBeInTheDocument();
    expect(screen.getByLabelText('Their username')).toHaveValue('Nobody');
    expect(screen.getByLabelText('Note')).toHaveValue('Selling coins');
  });

  it('does not call a revoked steward 404 an unknown player', async () => {
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, () => json({ success: false, message: 'Not found' }, 404))
    );
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), 'Mara');
    await fillRest(user);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText('No player by that name or ID.')).not.toBeInTheDocument();
  });

  // STAFF-CR-02: tickets name players only; the refusal is the same by name or ID.
  it('shows a steward or yourself as not a player, by username and by ID', async () => {
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, () =>
        json(
          { success: false, message: 'Tickets can only be about players', code: 'NOT_A_PLAYER' },
          403
        )
      )
    );
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), 'Willow');
    await fillRest(user);
    const copy = 'Tickets can only be about players, not stewards or yourself.';
    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('Their username')).toHaveValue('Willow');

    await user.selectOptions(screen.getByLabelText('Find the player'), 'id');
    await user.type(screen.getByLabelText('Their ID'), 'mod-2');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByText(copy)).toBeInTheDocument();
  });

  // STAFF-CR-07: a horse, show or post that does not exist is refused at the field.
  it('shows an unknown horse at the field', async () => {
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, () =>
        json({ success: false, message: 'Nothing by that ID', code: 'NO_TARGET' }, 404)
      )
    );
    const user = userEvent.setup();
    renderTickets();
    await user.selectOptions(await screen.findByLabelText('About'), 'horse');
    await user.type(screen.getByLabelText('Their ID'), '999');
    await fillRest(user);
    expect(await screen.findByText('Nothing by that ID.')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('Their ID')).toHaveValue('999');
  });

  it('clears the field error when the name is edited or the mode is switched', async () => {
    stubTickets();
    server.use(
      http.post(`${STAFF}/tickets`, () =>
        json({ success: false, message: 'No player by that name or ID', code: 'NO_PLAYER' }, 404)
      )
    );
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), 'Nobody');
    await fillRest(user);
    expect(await screen.findByText('No player by that name or ID.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Their username'), 'x');
    expect(screen.queryByText('No player by that name or ID.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByText('No player by that name or ID.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Find the player'), 'id');
    expect(screen.queryByText('No player by that name or ID.')).not.toBeInTheDocument();
  });

  it('keeps a separate value for each way of naming the player', async () => {
    stubTickets();
    const user = userEvent.setup();
    renderTickets();
    await user.type(await screen.findByLabelText('Their username'), 'Mara');
    await user.selectOptions(screen.getByLabelText('Find the player'), 'id');
    expect(screen.getByLabelText('Their ID')).toHaveValue('');
    await user.type(screen.getByLabelText('Their ID'), 'abc-123');
    await user.selectOptions(screen.getByLabelText('Find the player'), 'name');
    expect(screen.getByLabelText('Their username')).toHaveValue('Mara');
  });

  it('shows the current username, or a former player', async () => {
    stubTickets([
      { ...ticket, id: 20, targetUsername: 'Mara' },
      { ...ticket, id: 21, targetId: 'u-2', targetUsername: null },
    ]);
    renderTickets();
    expect(await screen.findByText(/Player Mara/)).toBeInTheDocument();
    expect(screen.getByText(/a former player/)).toBeInTheDocument();
  });
});

describe('StaffTickets: a filer or author whose account was erased (Equoria-2yugk)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('shows a former steward in the ticket list and in the thread', async () => {
    const orphan = {
      ...ticket,
      id: 30,
      targetType: 'post',
      targetId: '77',
      filedById: null,
      filedBy: null,
    };
    stubTickets([orphan]);
    server.use(
      http.get(`${STAFF}/tickets/30`, () =>
        json({
          ticket: {
            ...orphan,
            replies: [
              {
                id: 1,
                ticketId: 30,
                authorId: 'admin-1',
                author: { id: 'admin-1', username: 'Hazel' },
                body: 'On it.',
                createdAt: '2026-10-11T13:00:00.000Z',
              },
              {
                id: 2,
                ticketId: 30,
                authorId: null,
                author: null,
                body: 'Thanks.',
                createdAt: '2026-10-11T14:00:00.000Z',
              },
            ],
          },
        })
      )
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile={false} canResolve onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/filed by a former steward/)).toBeInTheDocument();
    await user.click(screen.getByText('Ticket #30: Spam'));
    expect(await screen.findByText('Thanks.')).toBeInTheDocument();
    expect(screen.getByText(/^Hazel,/)).toBeInTheDocument();
    expect(screen.getByText(/^a former steward,/)).toBeInTheDocument();
  });
});
