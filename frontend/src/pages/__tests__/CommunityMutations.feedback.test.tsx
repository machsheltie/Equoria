/**
 * Message board, thread replies and the compose recipient search — failures are
 * shown, typed text is kept, and a failed search is not "no results"
 * (Equoria-pqor7, Equoria-fslmm; FRONTEND_ASYNC_STATE_DOCTRINE §1/§2/§3).
 *
 * Boundary-level: REAL hooks through the REAL api-client; only the network is
 * stubbed (MSW). A refused post used to throw out of `mutateAsync` with no
 * handler and no message; a failed recipient search was swallowed into an empty
 * list, so "search is down" read as "no such player".
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { server } from '@/test/msw/server';
import MessageBoardPage from '../MessageBoardPage';
import MessageThreadPage from '../MessageThreadPage';
import { ComposeModal } from '../messages/ComposeModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const newThreadPath = `${base}/api/v1/forum/threads`;
const REPLY = `${base}/api/v1/forum/threads/1/posts`;
const SEARCH = `${base}/api/v1/users/search`;

const refusal = (status: number) =>
  HttpResponse.json({ success: false, message: 'RAW-SERVER-TEXT leak' }, { status });

function renderInQuery(node: React.ReactNode, route = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MessageBoardPage — new thread (Equoria-pqor7)', () => {
  it('a refused post says so in the dialog and keeps what the player typed', async () => {
    server.use(http.post(newThreadPath, () => refusal(500)));
    const user = userEvent.setup();
    renderInQuery(<MessageBoardPage />);

    await user.click(await screen.findByTestId('new-post-button'));
    await user.type(await screen.findByTestId('new-thread-title'), 'My title');
    await user.type(screen.getByTestId('new-thread-content'), 'My long post');
    await user.click(screen.getByTestId('submit-new-thread'));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    expect(screen.getByTestId('new-thread-title')).toHaveValue('My title');
    expect(screen.getByTestId('new-thread-content')).toHaveValue('My long post');
    expect(screen.getByTestId('submit-new-thread')).toBeEnabled();
  });

  it('a successful post closes the dialog with no error', async () => {
    const user = userEvent.setup();
    renderInQuery(<MessageBoardPage />);

    await user.click(await screen.findByTestId('new-post-button'));
    await user.type(await screen.findByTestId('new-thread-title'), 'My title');
    await user.type(screen.getByTestId('new-thread-content'), 'My long post');
    await user.click(screen.getByTestId('submit-new-thread'));

    await waitFor(() => expect(screen.queryByTestId('new-thread-title')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('MessageThreadPage — reply (Equoria-pqor7)', () => {
  function renderThread() {
    return renderInQuery(
      <Routes>
        <Route path="/message-board/:threadId" element={<MessageThreadPage />} />
      </Routes>,
      '/message-board/1'
    );
  }

  it('a refused reply says so beside the reply box and keeps the typed reply', async () => {
    server.use(http.post(REPLY, () => refusal(500)));
    const user = userEvent.setup();
    renderThread();

    await user.type(await screen.findByTestId('reply-input'), 'A thoughtful reply');
    await user.click(screen.getByTestId('submit-reply'));

    const box = await screen.findByTestId('reply-box');
    expect(await within(box).findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
    expect(screen.getByTestId('reply-input')).toHaveValue('A thoughtful reply');
    expect(screen.getByTestId('submit-reply')).toBeEnabled();
  });
});

describe('ComposeModal — recipient search (Equoria-fslmm)', () => {
  async function typeSearch(text: string) {
    const user = userEvent.setup();
    renderInQuery(<ComposeModal onClose={() => {}} />);
    await user.type(await screen.findByPlaceholderText(/search by username/i), text);
  }

  it('a failed search says search is unavailable, not "no results"', async () => {
    server.use(http.get(SEARCH, () => refusal(500)));
    await typeSearch('ada');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/search/i);
    expect(screen.queryByText(/no players found|no results|no matches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW-SERVER-TEXT/)).not.toBeInTheDocument();
  });

  it('a search that succeeds with nobody says no player was found', async () => {
    server.use(http.get(SEARCH, () => HttpResponse.json({ success: true, data: { users: [] } })));
    await typeSearch('zzzz');

    expect(await screen.findByText(/no players? found|no matches|no results/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the search error clears when the player types again', async () => {
    let calls = 0;
    server.use(
      http.get(SEARCH, () => {
        calls += 1;
        return calls === 1
          ? refusal(500)
          : HttpResponse.json({
              success: true,
              data: { users: [{ id: 'u-2', username: 'adalyn' }] },
            });
      })
    );
    const user = userEvent.setup();
    renderInQuery(<ComposeModal onClose={() => {}} />);
    const input = await screen.findByPlaceholderText(/search by username/i);
    await user.type(input, 'ada');
    await screen.findByRole('alert');

    await user.type(input, 'l');

    expect(await screen.findByText('adalyn')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
