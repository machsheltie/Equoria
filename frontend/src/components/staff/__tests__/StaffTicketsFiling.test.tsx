/**
 * StaffTickets: filing safety (STAFF-CR-13, STAFF-CR-14)
 *
 * - A filing in flight locks the form, so it is sent exactly once and then
 *   completes (CR-13).
 * - Changing what a ticket is about starts the subject over, so an ID typed
 *   for one kind of subject is never filed against another (CR-14).
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffTickets from '../StaffTickets';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const json = (body: unknown, status = 200) => HttpResponse.json(body as object, { status });

const filed = {
  id: 40,
  filedById: 'mod-2',
  filedBy: { id: 'mod-2', username: 'Willow' },
  targetType: 'post',
  targetId: '42',
  category: 'Spam',
  note: 'Selling coins',
  status: 'open',
  createdAt: '2026-10-11T12:00:00.000Z',
  updatedAt: '2026-10-11T12:00:00.000Z',
};

describe('StaffTickets: filing safety', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    server.use(http.get(`${STAFF}/tickets`, () => json({ tickets: [], nextCursor: null })));
  });

  const renderTickets = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StaffTickets canFile canResolve={false} onCheckinRequired={() => undefined} />
      </QueryClientProvider>
    );

  // ── CR-13 ────────────────────────────────────────────────────────────────

  function holdFilings() {
    const bodies: unknown[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${STAFF}/tickets`, async ({ request }) => {
        bodies.push(await request.json());
        await gate;
        return json({ ticket: filed }, 201);
      })
    );
    return { bodies, release: () => release() };
  }

  async function fileAboutPost(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(await screen.findByLabelText('About'), 'post');
    await user.type(screen.getByLabelText('Their ID'), '42');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
  }

  it('sends a filing once while it is in flight, then completes and clears the form', async () => {
    const { bodies, release } = holdFilings();
    const user = userEvent.setup();
    renderTickets();
    await fileAboutPost(user);
    await waitFor(() => expect(bodies).toHaveLength(1));

    // Editing the subject, re-clicking and re-submitting while it is in flight.
    const button = screen.getByRole('button', { name: 'File ticket' });
    fireEvent.change(screen.getByLabelText('About'), { target: { value: 'horse' } });
    fireEvent.change(screen.getByLabelText('Their ID'), { target: { value: '43' } });
    fireEvent.click(button);
    fireEvent.submit(button.closest('form') as HTMLFormElement);

    release();
    await waitFor(() => expect(screen.getByLabelText('Note')).toHaveValue(''));
    expect(bodies).toEqual([
      { targetType: 'post', targetId: '42', category: 'Spam', note: 'Selling coins' },
    ]);
    expect(screen.getByLabelText('About')).toHaveValue('user');
    expect(screen.getByLabelText('Their username')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks every filing control while a filing is in flight', async () => {
    const { bodies, release } = holdFilings();
    const user = userEvent.setup();
    renderTickets();
    await fileAboutPost(user);
    await waitFor(() => expect(bodies).toHaveLength(1));
    for (const label of ['About', 'Their ID', 'Category', 'Note']) {
      expect(screen.getByLabelText(label)).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'File ticket' })).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByLabelText('About')).not.toBeDisabled());
    expect(bodies).toHaveLength(1);
  });

  it('clears a settled refusal when the subject is edited', async () => {
    server.use(
      http.post(`${STAFF}/tickets`, () =>
        json({ success: false, message: 'Nothing by that ID', code: 'NO_TARGET' }, 404)
      )
    );
    const user = userEvent.setup();
    renderTickets();
    await user.selectOptions(await screen.findByLabelText('About'), 'show');
    await user.type(screen.getByLabelText('Their ID'), '9');
    await user.type(screen.getByLabelText('Category'), 'Rigged');
    await user.type(screen.getByLabelText('Note'), 'Judged by the host');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    expect(await screen.findByText('Nothing by that ID.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Their ID'), '1');
    expect(screen.queryByText('Nothing by that ID.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Their ID')).toHaveValue('91');
  });

  // ── CR-14 ────────────────────────────────────────────────────────────────

  async function expectSubjectCleared(user: ReturnType<typeof userEvent.setup>, to: string) {
    await user.selectOptions(screen.getByLabelText('About'), to);
    const field = screen.getByLabelText(to === 'user' ? 'Their username' : 'Their ID');
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: 'File ticket' })).toBeDisabled();
  }

  it('starts the ID over when a post becomes a horse', async () => {
    const user = userEvent.setup();
    renderTickets();
    await user.selectOptions(await screen.findByLabelText('About'), 'post');
    await user.type(screen.getByLabelText('Their ID'), '42');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await expectSubjectCleared(user, 'horse');
  });

  it('starts the ID over when a horse becomes a show', async () => {
    const user = userEvent.setup();
    renderTickets();
    await user.selectOptions(await screen.findByLabelText('About'), 'horse');
    await user.type(screen.getByLabelText('Their ID'), '345');
    await user.type(screen.getByLabelText('Category'), 'Name');
    await user.type(screen.getByLabelText('Note'), 'A slur');
    await expectSubjectCleared(user, 'show');
  });

  it('starts the ID over when a player named by ID becomes a post', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${STAFF}/tickets`, async ({ request }) => {
        bodies.push(await request.json());
        return json({ ticket: filed }, 201);
      })
    );
    const user = userEvent.setup();
    renderTickets();
    await user.selectOptions(await screen.findByLabelText('Find the player'), 'id');
    await user.type(screen.getByLabelText('Their ID'), '77');
    await user.type(screen.getByLabelText('Category'), 'Spam');
    await user.type(screen.getByLabelText('Note'), 'Selling coins');
    await expectSubjectCleared(user, 'post');

    // The post is filed only with the ID typed for it.
    await user.type(screen.getByLabelText('Their ID'), '42');
    await user.click(screen.getByRole('button', { name: 'File ticket' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ targetType: 'post', targetId: '42' });
  });
});
