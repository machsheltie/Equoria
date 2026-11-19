/**
 * StaffHeldPosts: the moderators' queue of held forum posts (Equoria-puj1e.3,
 * owner rulings q375 and q376). Accept publishes; Reject needs a reason and
 * removes the post. A decided post leaves the list.
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
import StaffHeldPosts from '../StaffHeldPosts';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const HELD = `${base}/api/v1/staff/forum/held`;

const reply = {
  id: 72,
  content: 'My colt, waiting',
  createdAt: '2026-11-18T09:30:00Z',
  author: { id: 'p-2', username: 'Willow' },
  thread: { id: 7, title: 'Spring foals', section: 'general' },
  startsThread: false,
};
const newThread = {
  id: 80,
  content: 'Buy cheap coins here',
  createdAt: '2026-11-18T09:40:00Z',
  author: { id: 'p-3', username: 'Spammer' },
  thread: { id: 8, title: 'Coins', section: 'general' },
  startsThread: true,
};

describe('StaffHeldPosts', () => {
  let queryClient: QueryClient;
  let waiting: (typeof reply)[];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    waiting = [reply, newThread];
    server.use(http.get(HELD, () => HttpResponse.json({ posts: waiting, nextAfter: null })));
  });

  const renderIt = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StaffHeldPosts onCheckinRequired={() => undefined} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('lists each held post with its author and thread, saying which would start a thread', async () => {
    renderIt();
    const first = await screen.findByTestId('held-post-72');
    expect(first).toHaveTextContent('Willow replied in Spring foals');
    expect(first).toHaveTextContent('My colt, waiting');
    expect(screen.getByTestId('held-post-80')).toHaveTextContent('Spammer started Coins');
  });

  it('accepting a post sends it and the post leaves the list', async () => {
    let accepted = false;
    server.use(
      http.post(`${HELD}/72/accept`, () => {
        accepted = true;
        waiting = [newThread];
        return HttpResponse.json({ id: 72 });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('held-post-72');
    await user.click(within(row).getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.queryByTestId('held-post-72')).toBeNull());
    expect(accepted).toBe(true);
  });

  it('rejecting needs a reason, names a thread removal, and sends the reason', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${HELD}/80/reject`, async ({ request }) => {
        sent = await request.json();
        waiting = [reply];
        return HttpResponse.json({ id: 80 });
      })
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('held-post-80');
    await user.click(within(row).getByRole('button', { name: 'Reject' }));
    const confirm = within(row).getByRole('button', { name: 'Reject and remove the thread' });
    expect(confirm).toBeDisabled();
    await user.type(within(row).getByLabelText(/Reason/), 'Spam');
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByTestId('held-post-80')).toBeNull());
    expect(sent).toEqual({ reason: 'Spam' });
  });

  it('words a held reply in a held thread as removing only the reply (Codex r2 #7)', async () => {
    const replyInHeldThread = { ...reply, id: 81, thread: newThread.thread, startsThread: false };
    waiting = [newThread, replyInHeldThread];
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('held-post-81');
    expect(row).toHaveTextContent('Willow replied in Coins');
    await user.click(within(row).getByRole('button', { name: 'Reject' }));
    expect(within(row).getByRole('button', { name: 'Reject and remove' })).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Reject and remove the thread' })).toBeNull();
  });

  it('says when another steward decided the post first', async () => {
    server.use(
      http.post(`${HELD}/72/accept`, () =>
        HttpResponse.json(
          { success: false, code: 'forumPostNotHeld', message: 'RAW-SERVER-TEXT' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderIt();
    const row = await screen.findByTestId('held-post-72');
    await user.click(within(row).getByRole('button', { name: 'Accept' }));
    expect(await within(row).findByText(/already decided/)).toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).toBeNull();
  });

  it('says plainly when nothing is waiting', async () => {
    waiting = [];
    renderIt();
    expect(await screen.findByText('No posts are waiting.')).toBeInTheDocument();
  });
});
