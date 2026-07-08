/**
 * MessagesPage — inbox / sent / notifications four-state tests (Equoria-l22ki)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect: the
 * page used to destructure only `{ data, isLoading }` from useInbox /
 * useSentMessages / useGameNotifications, so a FAILED fetch rendered the honest
 * empty state ("Your inbox is empty", "No game notifications yet") —
 * indistinguishable from a genuinely-empty result. Per
 * FRONTEND_ASYNC_STATE_DOCTRINE §1 the four canonical states are
 * LOADING → ERROR (visible + retry) → EMPTY (only via success) → SUCCESS.
 *
 * Boundary-level test (mirrors BankPage.test.tsx / Equoria-4hra5): the page
 * renders against the REAL hooks (real React Query + real messagesApi /
 * gameNotificationsApi over the real apiClient), with only the HTTP transport
 * boundary stubbed by MSW. This is NOT a vi.mock of the hooks — the real
 * envelope unwrap and loading/error/empty/success transitions run end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import MessagesPage from '../MessagesPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const INBOX = `${base}/api/v1/messages/inbox`;
const SENT = `${base}/api/v1/messages/sent`;
const UNREAD = `${base}/api/v1/messages/unread-count`;
const GAMENOTIFS = `${base}/api/v1/users/me/game-notifications`;

const sampleMessages = [
  {
    id: 1,
    senderId: 'user-2',
    sender: { id: 'user-2', username: 'breeder99' },
    recipientId: 'user-1',
    recipient: { id: 'user-1', username: 'tester' },
    subject: 'Interested in your mare',
    content: 'Hi! Is she still available?',
    tag: 'breeding',
    isRead: false,
    createdAt: '2026-07-01T10:00:00Z',
  },
];

/** Benign stubs for the queries that are NOT the subject of a given test. */
function stubBenign() {
  server.use(
    http.get(SENT, () => HttpResponse.json({ messages: [] })),
    http.get(UNREAD, () => HttpResponse.json({ count: 0 })),
    http.get(GAMENOTIFS, () =>
      HttpResponse.json({ success: true, data: { notifications: [], unreadCount: 0 } })
    )
  );
}

describe('MessagesPage — inbox four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    stubBenign();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 7, username: 'MsgTester' }}>
          <MemoryRouter initialEntries={['/messages']}>
            <MessagesPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  // LOADING — while the inbox fetch is pending the empty lie must not appear.
  it('shows a loading region while the inbox fetch is pending (not the empty lie)', async () => {
    server.use(
      http.get(INBOX, async () => {
        await delay(150);
        return HttpResponse.json({ messages: [] });
      })
    );

    renderPage();

    expect(await screen.findByRole('status', { name: /loading messages/i })).toBeInTheDocument();
    expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ERROR — the key assertion: a failed inbox fetch renders an error+retry,
  // NEVER the false "Your inbox is empty" empty state.
  it('renders an error state with retry (not a false empty) when the inbox fetch fails', async () => {
    server.use(
      http.get(INBOX, () =>
        HttpResponse.json({ status: 'error', message: 'internal boom detail' }, { status: 500 })
      )
    );

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // The empty lie must NOT be rendered on a failed fetch.
    expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument();
    // Raw server error text must never leak into the UI (doctrine §3).
    expect(screen.queryByText(/internal boom detail/i)).not.toBeInTheDocument();
  });

  // EMPTY — reachable ONLY through a successful, genuinely-empty fetch.
  it('renders the honest empty state on a successful but empty inbox fetch', async () => {
    server.use(http.get(INBOX, () => HttpResponse.json({ messages: [] })));

    renderPage();

    expect(await screen.findByText('Your inbox is empty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // SUCCESS — real rows render.
  it('renders message rows on a successful inbox fetch with data', async () => {
    server.use(http.get(INBOX, () => HttpResponse.json({ messages: sampleMessages })));

    renderPage();

    expect(await screen.findByText('Interested in your mare')).toBeInTheDocument();
    expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // RETRY WIRING — the retry affordance must call refetch (not be a dead
  // button). First fetch fails; clicking Try Again re-fetches and renders rows.
  it('retry re-fetches and renders rows (refetch is wired to the error retry)', async () => {
    let calls = 0;
    server.use(
      http.get(INBOX, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ messages: sampleMessages });
      })
    );

    const user = userEvent.setup();
    renderPage();

    const retryBtn = await screen.findByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Interested in your mare')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Your inbox is empty')).not.toBeInTheDocument();
  });
});

describe('MessagesPage — notifications four-state (Equoria-l22ki)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Inbox/sent/unread benign; notifications overridden per test.
    server.use(
      http.get(INBOX, () => HttpResponse.json({ messages: [] })),
      http.get(SENT, () => HttpResponse.json({ messages: [] })),
      http.get(UNREAD, () => HttpResponse.json({ count: 0 }))
    );
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider userOverrides={{ id: 7, username: 'MsgTester' }}>
          <MemoryRouter initialEntries={['/messages']}>
            <MessagesPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

  it('renders an error state with retry (not a false empty) when the notifications fetch fails', async () => {
    server.use(
      http.get(GAMENOTIFS, () =>
        HttpResponse.json({ success: false, message: 'notif boom' }, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderPage();

    // Switch to the Notifications tab.
    await user.click(await screen.findByTestId('tab-notifications'));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('No game notifications yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/notif boom/i)).not.toBeInTheDocument();
  });

  it('renders the honest empty state on a successful but empty notifications fetch', async () => {
    server.use(
      http.get(GAMENOTIFS, () =>
        HttpResponse.json({ success: true, data: { notifications: [], unreadCount: 0 } })
      )
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByTestId('tab-notifications'));

    expect(await screen.findByText('No game notifications yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
