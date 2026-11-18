/**
 * Reporting a forum post, and the blocked-word refusal, on the thread page
 * (Equoria-puj1e.3, owner rulings q380 and q382).
 *
 * Boundary-level: the REAL page, hooks and api-client; only the network is stubbed
 * (MSW). A player may report someone else's published post for one of four
 * reasons (Other needs a note); the post then says it was reported. A blocked
 * word is refused in words beside the reply box, without naming the word.
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
import MessageThreadPage from '../MessageThreadPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const THREAD = `${base}/api/v1/forum/threads/7`;
const REPLY = `${base}/api/v1/forum/threads/7/posts`;
const REPORT = `${base}/api/v1/forum/posts/71/report`;

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
const theirs = {
  id: 71,
  threadId: 7,
  author: { id: 'p-starter', username: 'Starter' },
  content: 'Show me your foals',
  createdAt: '2026-11-18T09:00:00Z',
  status: 'published',
  reportedByMe: false,
};
const mine = {
  id: 72,
  threadId: 7,
  author: { id: '1', username: 'TestUser' },
  content: 'My colt',
  createdAt: '2026-11-18T09:30:00Z',
  status: 'published',
  reportedByMe: false,
};
const myHeld = { ...mine, id: 73, content: 'Waiting one', status: 'held' };

function renderThread() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ id: 1, role: 'user' }}>
        <MemoryRouter initialEntries={['/message-board/7']}>
          <Routes>
            <Route path="/message-board/:threadId" element={<MessageThreadPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('MessageThreadPage: reporting a post (q382)', () => {
  it("offers Report on someone else's post only, not on the player's own or held posts", async () => {
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [theirs, mine, myHeld] }))
    );
    renderThread();
    const other = await screen.findByTestId('post-71');
    expect(within(other).getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(
      within(screen.getByTestId('post-72')).queryByRole('button', { name: 'Report' })
    ).toBeNull();
    expect(
      within(screen.getByTestId('post-73')).queryByRole('button', { name: 'Report' })
    ).toBeNull();
  });

  it('sends the chosen reason and the post then says it was reported', async () => {
    let sent: unknown = null;
    let current = theirs;
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [current] })),
      http.post(REPORT, async ({ request }) => {
        sent = await request.json();
        current = { ...theirs, reportedByMe: true };
        return HttpResponse.json({ postId: 71, reportedByMe: true }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderThread();
    const post = await screen.findByTestId('post-71');
    await user.click(within(post).getByRole('button', { name: 'Report' }));

    const reasons = within(post).getByRole('group', { name: 'Why are you reporting this post?' });
    for (const label of ['Rude or bullying', 'Spam or selling', 'Personal information', 'Other']) {
      expect(within(reasons).getByRole('radio', { name: label })).toBeInTheDocument();
    }
    const sendButton = within(post).getByRole('button', { name: 'Send report' });
    expect(sendButton).toBeDisabled();
    await user.click(within(reasons).getByRole('radio', { name: 'Spam or selling' }));
    await user.click(sendButton);

    expect(
      await within(post).findByText('Reported. A moderator will take a look.')
    ).toBeInTheDocument();
    expect(sent).toEqual({ reason: 'spamOrSelling' });
    expect(within(post).queryByRole('button', { name: 'Report' })).toBeNull();
  });

  it('asks for a note with Other and sends it', async () => {
    let sent: unknown = null;
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [theirs] })),
      http.post(REPORT, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ postId: 71, reportedByMe: true }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderThread();
    const post = await screen.findByTestId('post-71');
    await user.click(within(post).getByRole('button', { name: 'Report' }));
    await user.click(within(post).getByRole('radio', { name: 'Other' }));
    const sendButton = within(post).getByRole('button', { name: 'Send report' });
    expect(sendButton).toBeDisabled();
    await user.type(within(post).getByRole('textbox', { name: /What is wrong/ }), 'Copied my art');
    await user.click(sendButton);
    expect(
      await within(post).findByText('Reported. A moderator will take a look.')
    ).toBeInTheDocument();
    expect(sent).toEqual({ reason: 'other', note: 'Copied my art' });
  });

  it('says so beside the form when the post was already reported', async () => {
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [theirs] })),
      http.post(REPORT, () =>
        HttpResponse.json(
          { success: false, code: 'forumReportDuplicate', message: 'raw server words' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderThread();
    const post = await screen.findByTestId('post-71');
    await user.click(within(post).getByRole('button', { name: 'Report' }));
    await user.click(within(post).getByRole('radio', { name: 'Rude or bullying' }));
    await user.click(within(post).getByRole('button', { name: 'Send report' }));
    expect(
      await within(post).findByText('You have already reported this post.')
    ).toBeInTheDocument();
    expect(screen.queryByText('raw server words')).toBeNull();
  });

  it('shows a post the player already reported as reported, with no Report button', async () => {
    server.use(
      http.get(THREAD, () =>
        HttpResponse.json({ thread, posts: [{ ...theirs, reportedByMe: true }] })
      )
    );
    renderThread();
    const post = await screen.findByTestId('post-71');
    expect(within(post).getByText('Reported. A moderator will take a look.')).toBeInTheDocument();
    expect(within(post).queryByRole('button', { name: 'Report' })).toBeNull();
  });
});

describe('MessageThreadPage: a blocked word (q380)', () => {
  it('refuses the reply in words beside the box, keeps the text, and never names the word', async () => {
    server.use(
      http.get(THREAD, () => HttpResponse.json({ thread, posts: [theirs] })),
      http.post(REPLY, () =>
        HttpResponse.json(
          { success: false, code: 'forumBlockedWord', message: 'server copy' },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderThread();
    await screen.findByTestId('post-71');
    const box = screen.getByTestId('reply-input');
    await user.type(box, 'some rude words');
    await user.click(screen.getByTestId('submit-reply'));
    const replyBox = screen.getByTestId('reply-box');
    expect(
      await within(replyBox).findByText(
        'This cannot be posted as written. Please change the wording and try again.'
      )
    ).toBeInTheDocument();
    expect(box).toHaveValue('some rude words');
    expect(screen.queryByText('server copy')).toBeNull();
  });
});
