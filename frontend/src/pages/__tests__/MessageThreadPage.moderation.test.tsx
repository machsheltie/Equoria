/**
 * Forum moderation on the thread page (Equoria-puj1e.3, owner rulings q375/q376).
 *
 * Boundary-level: the REAL page, hooks and api-client; only the network is stubbed
 * (MSW). The server decides who sees a held post; the page marks the author's own
 * held post, gives stewards (and only stewards) the tools to edit or remove a
 * player's post, and names when a steward's posting cooldown ends.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import type { UserRole } from '@/contexts/AuthContext';
import MessageBoardPage from '../MessageBoardPage';
import MessageThreadPage from '../MessageThreadPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const THREAD = `${base}/api/v1/forum/threads/7`;
const REPLY = `${base}/api/v1/forum/threads/7/posts`;
const EDIT = `${base}/api/v1/staff/forum/posts/71/edit`;

const thread = {
  id: 7,
  section: 'general',
  title: 'Spring foals',
  author: { id: 'p-starter', username: 'Starter' },
  tags: [],
  isPinned: false,
  status: 'published',
  viewCount: 3,
  replyCount: 1,
  lastActivityAt: '2026-11-18T10:00:00Z',
  createdAt: '2026-11-18T09:00:00Z',
};
const opening = {
  id: 71,
  threadId: 7,
  author: { id: 'p-starter', username: 'Starter' },
  content: 'Show me your foals',
  createdAt: '2026-11-18T09:00:00Z',
  status: 'published',
};
const heldReply = {
  id: 72,
  threadId: 7,
  author: { id: '1', username: 'TestUser' },
  content: 'My colt, waiting',
  createdAt: '2026-11-18T09:30:00Z',
  status: 'held',
};

function renderThread(role: UserRole) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ id: 1, role }}>
        <MemoryRouter initialEntries={['/message-board/7']}>
          <Routes>
            <Route path="/message-board/:threadId" element={<MessageThreadPage />} />
            <Route path="/message-board" element={<p>The board</p>} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('MessageThreadPage: held posts and steward tools', () => {
  it("marks the author's own held post as awaiting a moderator, and no other post", async () => {
    server.use(http.get(THREAD, () => HttpResponse.json({ thread, posts: [opening, heldReply] })));
    renderThread('user');

    const held = await screen.findByTestId('post-72');
    expect(within(held).getByText('Awaiting a moderator')).toBeInTheDocument();
    expect(within(screen.getByTestId('post-71')).queryByText('Awaiting a moderator')).toBeNull();
    expect(screen.queryByText('held')).toBeNull();
  });

  it('gives a player no steward tools', async () => {
    server.use(http.get(THREAD, () => HttpResponse.json({ thread, posts: [opening] })));
    renderThread('user');
    await screen.findByTestId('post-71');
    expect(screen.queryByRole('button', { name: 'Moderate' })).toBeNull();
  });

  it("lets a moderator edit a player's post with a reason, and not their own", async () => {
    let sent: unknown = null;
    let current = opening;
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [current, heldReply] })),
      http.post(EDIT, async ({ request }) => {
        sent = await request.json();
        current = { ...opening, content: 'Show me your foals (edited)' };
        return HttpResponse.json({ id: 71, threadId: 7, content: current.content });
      })
    );
    const user = userEvent.setup();
    renderThread('moderator');

    const post = await screen.findByTestId('post-71');
    // The viewer wrote post 72: the server would refuse, so the page offers nothing there.
    expect(
      within(screen.getByTestId('post-72')).queryByRole('button', { name: 'Moderate' })
    ).toBeNull();

    await user.click(within(post).getByRole('button', { name: 'Moderate' }));
    const save = within(post).getByRole('button', { name: 'Save edit' });
    expect(save).toBeDisabled();
    const text = within(post).getByLabelText('Post');
    await user.clear(text);
    await user.type(text, 'Show me your foals (edited)');
    await user.type(within(post).getByLabelText(/Reason/), 'Removed a phone number');
    await user.click(save);

    expect(await screen.findByText('Show me your foals (edited)')).toBeInTheDocument();
    expect(sent).toEqual({
      content: 'Show me your foals (edited)',
      reason: 'Removed a phone number',
    });
    // The tools close once the change shows on the page.
    expect(
      within(screen.getByTestId('post-71')).queryByRole('button', { name: 'Remove the thread' })
    ).toBeNull();
  });

  it('removing the opening post removes the thread and returns to the board', async () => {
    let sent: unknown = null;
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [opening] })),
      http.post(`${base}/api/v1/staff/forum/posts/71/remove`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: 71, threadId: 7, removed: 'thread' });
      })
    );
    const user = userEvent.setup();
    renderThread('admin');

    const post = await screen.findByTestId('post-71');
    await user.click(within(post).getByRole('button', { name: 'Moderate' }));
    const remove = within(post).getByRole('button', { name: 'Remove the thread' });
    expect(remove).toBeDisabled();
    await user.type(within(post).getByLabelText(/Reason/), 'Spam');
    await user.click(remove);

    expect(await screen.findByText('The board')).toBeInTheDocument();
    expect(sent).toEqual({ reason: 'Spam' });
  });

  it('names when a posting cooldown ends, in authored words, and keeps the reply', async () => {
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [opening] })),
      http.post(REPLY, () =>
        HttpResponse.json(
          {
            success: false,
            code: 'forumPostingCooldown',
            message: 'RAW-SERVER-TEXT',
            until: '2026-11-19T15:00:00.000Z',
          },
          { status: 403 }
        )
      )
    );
    const user = userEvent.setup();
    renderThread('user');

    await user.type(await screen.findByTestId('reply-input'), 'One more thing');
    await user.click(screen.getByTestId('submit-reply'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/A steward has paused your forum posting until/);
    expect(alert).toHaveTextContent(/Nov(ember)? 19/);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).toBeNull();
    expect(screen.queryByText(/forumPostingCooldown/)).toBeNull();
    expect(screen.getByTestId('reply-input')).toHaveValue('One more thing');
  });
});

describe('MessageBoardPage: a held thread', () => {
  it("marks the author's held thread as awaiting a moderator", async () => {
    server.use(
      http.get(`${base}/api/v1/forum/threads`, () =>
        HttpResponse.json({
          threads: [
            { ...thread, id: 8, title: 'My held thread', status: 'held' },
            { ...thread, id: 9, title: 'Someone else' },
          ],
          total: 2,
          page: 1,
        })
      )
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MessageBoardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const held = await screen.findByTestId('thread-8');
    expect(within(held).getByText('Awaiting a moderator')).toBeInTheDocument();
    expect(within(screen.getByTestId('thread-9')).queryByText('Awaiting a moderator')).toBeNull();
  });
});
