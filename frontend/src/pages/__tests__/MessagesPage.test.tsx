/**
 * MessagesPage smoke tests (Equoria-jexy)
 *
 * Verifies the messages page renders correctly and key interactions work:
 * - Page mounts without crashing
 * - Inbox, Sent, Notifications tabs are present
 * - Unread badge shows correct count
 * - Compose button opens compose modal
 * - Empty inbox and sent states display correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';

vi.mock('@/components/layout/PageHero', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="page-hero">{children}</div>
  ),
}));

const mockUseInbox = vi.fn();
const mockUseSentMessages = vi.fn();
const mockUseUnreadCount = vi.fn();
const mockUseGameNotifications = vi.fn();
const mockMarkAllReadMutate = vi.fn();

vi.mock('@/hooks/api/useMessages', () => ({
  useInbox: () => mockUseInbox(),
  useSentMessages: () => mockUseSentMessages(),
  useUnreadCount: () => mockUseUnreadCount(),
  useSendMessage: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useMessage: () => ({ data: null, isLoading: false, error: null }),
  useMarkRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useGameNotifications', () => ({
  useGameNotifications: () => mockUseGameNotifications(),
  useMarkGameNotificationsRead: () => ({ mutate: mockMarkAllReadMutate, isPending: false }),
}));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual('@/lib/api-client');
  return {
    ...(actual as object),
    usersApi: {
      search: vi.fn().mockResolvedValue({ users: [] }),
    },
  };
});

import MessagesPage from '../MessagesPage';

const MOCK_MESSAGE = {
  id: 1,
  senderId: 'u2',
  sender: { id: 'u2', username: 'bob' },
  recipientId: 'u1',
  recipient: { id: 'u1', username: 'alice' },
  subject: 'Hello there',
  content: 'This is a test message with enough content to display.',
  tag: undefined,
  isRead: false,
  createdAt: new Date().toISOString(),
};

const MOCK_SENT_MESSAGE = {
  id: 2,
  senderId: 'u1',
  sender: { id: 'u1', username: 'alice' },
  recipientId: 'u2',
  recipient: { id: 'u2', username: 'bob' },
  subject: 'My sent message',
  content: 'This is a sent message.',
  tag: undefined,
  isRead: true,
  createdAt: new Date().toISOString(),
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestRouter>{children}</TestRouter>
    </QueryClientProvider>
  );
}

function setupDefaultMocks() {
  mockUseInbox.mockReturnValue({
    data: { messages: [MOCK_MESSAGE] },
    isLoading: false,
  });
  mockUseSentMessages.mockReturnValue({
    data: { messages: [MOCK_SENT_MESSAGE] },
    isLoading: false,
  });
  mockUseUnreadCount.mockReturnValue({
    data: { count: 1 },
  });
  mockUseGameNotifications.mockReturnValue({
    data: { notifications: [], unreadCount: 0 },
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

describe('MessagesPage', () => {
  it('renders without crashing', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('message-tabs')).toBeInTheDocument();
  });

  it('shows Inbox, Sent, and Notifications tabs', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('tab-inbox')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sent')).toBeInTheDocument();
    expect(screen.getByTestId('tab-notifications')).toBeInTheDocument();
  });

  it('inbox tab is selected by default', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('tab-inbox')).toHaveAttribute('aria-selected', 'true');
  });

  it('shows unread badge on inbox tab when there are unread messages', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    const inboxTab = screen.getByTestId('tab-inbox');
    expect(inboxTab).toHaveTextContent('1');
  });

  it('renders inbox messages', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('message-1')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('shows Compose button', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('compose-button')).toBeInTheDocument();
  });

  it('opens compose modal when Compose is clicked', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('compose-button'));

    expect(screen.getByRole('dialog', { name: /compose message/i })).toBeInTheDocument();
    expect(screen.getByTestId('send-message-button')).toBeInTheDocument();
  });

  it('switches to sent tab and shows sent messages', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-sent'));

    expect(screen.getByTestId('tab-sent')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('message-2')).toBeInTheDocument();
    expect(screen.getByText('My sent message')).toBeInTheDocument();
  });

  it('shows empty inbox state when no messages', () => {
    mockUseInbox.mockReturnValue({ data: { messages: [] }, isLoading: false });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );
    expect(screen.getByTestId('empty-messages')).toBeInTheDocument();
    expect(screen.getByText(/your inbox is empty/i)).toBeInTheDocument();
  });

  it('shows empty sent state when no sent messages', async () => {
    mockUseSentMessages.mockReturnValue({ data: { messages: [] }, isLoading: false });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-sent'));

    expect(screen.getByTestId('empty-messages')).toBeInTheDocument();
    expect(screen.getByText(/no sent messages/i)).toBeInTheDocument();
  });

  it('switches to notifications tab', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-notifications'));

    expect(screen.getByTestId('tab-notifications')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('empty-notifications')).toBeInTheDocument();
  });

  // Regression: Equoria-rtog. Pre-fix, the Notifications tab destructured
  // payload.{stat,amount,feedName} for every notif, so any foal_born row
  // crashed the tab. After the dispatch-by-type fix, mixed types must
  // render side-by-side without throwing, and unknown types must fall back.
  it('renders mixed stat_gain + foal_born + unknown notifications without crashing', async () => {
    mockUseGameNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: 'n-stat',
            type: 'stat_gain',
            isRead: false,
            createdAt: new Date().toISOString(),
            payload: {
              horseName: 'Stardust',
              stat: 'speed',
              amount: 2,
              feedName: 'Premium Oats',
            },
          },
          {
            id: 'n-foal',
            type: 'foal_born',
            isRead: false,
            createdAt: new Date().toISOString(),
            payload: {
              foalName: 'Comet Jr',
              foalId: 42,
              damName: 'Comet',
              sireName: 'Blaze',
            },
          },
          {
            id: 'n-unknown',
            type: 'something_new',
            isRead: true,
            createdAt: new Date().toISOString(),
            payload: { whatever: 1 },
          },
        ],
        unreadCount: 2,
      },
      isLoading: false,
    });

    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-notifications'));

    // stat_gain row renders with its existing copy
    const statRow = screen.getByTestId('game-notif-n-stat');
    expect(statRow).toBeInTheDocument();
    expect(statRow).toHaveAttribute('data-notif-type', 'stat_gain');
    expect(statRow).toHaveTextContent('Stardust');
    expect(statRow).toHaveTextContent('+2 Speed from Premium Oats');

    // foal_born row renders with the new copy
    const foalRow = screen.getByTestId('game-notif-n-foal');
    expect(foalRow).toBeInTheDocument();
    expect(foalRow).toHaveAttribute('data-notif-type', 'foal_born');
    expect(foalRow).toHaveTextContent('Comet Jr');
    expect(foalRow).toHaveTextContent('Out of Comet by Blaze.');

    // unknown type falls back rather than crashing
    const fallbackRow = screen.getByTestId('game-notif-n-unknown');
    expect(fallbackRow).toBeInTheDocument();
    expect(fallbackRow).toHaveAttribute('data-notif-type', 'something_new');
    expect(fallbackRow).toHaveTextContent('New notification');
  });

  // Equoria-50pn AC-3: populated Notifications tab triggers markAllRead once.
  // Asserts the useEffect at MessagesPage.tsx:96-100 fires the mark-read
  // mutation exactly once when the user opens the notifications tab with
  // unread items.
  it('calls markAllRead.mutate once when notifications tab is activated with unread items', async () => {
    mockUseGameNotifications.mockReturnValue({
      data: {
        notifications: [
          {
            id: 'n-1',
            type: 'stat_gain',
            isRead: false,
            createdAt: new Date().toISOString(),
            payload: {
              horseName: 'Stardust',
              stat: 'speed',
              amount: 1,
              feedName: 'Performance Feed',
            },
          },
          {
            id: 'n-2',
            type: 'stat_gain',
            isRead: false,
            createdAt: new Date().toISOString(),
            payload: {
              horseName: 'Comet',
              stat: 'stamina',
              amount: 1,
              feedName: 'Elite Feed',
            },
          },
        ],
        unreadCount: 2,
      },
      isLoading: false,
    });

    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    // Initial mount on inbox: mark-read must NOT have been called yet.
    expect(mockMarkAllReadMutate).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('tab-notifications'));

    // Both rows render with correct horse + stat copy.
    const row1 = screen.getByTestId('game-notif-n-1');
    expect(row1).toHaveTextContent('Stardust');
    expect(row1).toHaveTextContent('+1 Speed from Performance Feed');
    const row2 = screen.getByTestId('game-notif-n-2');
    expect(row2).toHaveTextContent('Comet');
    expect(row2).toHaveTextContent('+1 Stamina from Elite Feed');

    // Mark-read fired exactly once on tab activation.
    expect(mockMarkAllReadMutate).toHaveBeenCalledTimes(1);
  });

  // Equoria-50pn — when there are no unread, the mark-read mutation
  // must NOT fire even when the user opens the notifications tab.
  it('does NOT call markAllRead.mutate when unreadCount is 0', async () => {
    mockUseGameNotifications.mockReturnValue({
      data: { notifications: [], unreadCount: 0 },
      isLoading: false,
    });

    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessagesPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('tab-notifications'));
    expect(mockMarkAllReadMutate).not.toHaveBeenCalled();
  });
});
