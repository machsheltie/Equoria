/**
 * MessageBoardPage smoke tests (Equoria-jexy)
 *
 * Verifies the forum message board renders correctly and key interactions work:
 * - Page mounts without crashing
 * - All five section tabs are present
 * - Thread rows render from mock data
 * - New Post button opens thread creation modal
 * - Empty state shows when no threads
 * - Section switching calls the hook with the new filter
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

const mockUseThreads = vi.fn();

vi.mock('@/hooks/api/useForum', () => ({
  useThreads: (...args: unknown[]) => mockUseThreads(...args),
  useCreateThread: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useThread: vi.fn(),
  useCreatePost: vi.fn(),
  useIncrementView: vi.fn(),
}));

import MessageBoardPage from '../MessageBoardPage';

const MOCK_THREAD = {
  id: 1,
  section: 'general',
  title: 'Welcome to the board',
  author: { id: 'u1', username: 'alice' },
  tags: [],
  isPinned: false,
  viewCount: 12,
  replyCount: 3,
  lastActivityAt: new Date().toISOString(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseThreads.mockReturnValue({
    threads: [MOCK_THREAD],
    total: 1,
    page: 1,
    isLoading: false,
    error: null,
  });
});

describe('MessageBoardPage', () => {
  it('renders without crashing', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('section-tabs')).toBeInTheDocument();
  });

  it('shows all five section tabs', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('section-tab-general')).toBeInTheDocument();
    expect(screen.getByTestId('section-tab-art')).toBeInTheDocument();
    expect(screen.getByTestId('section-tab-sales')).toBeInTheDocument();
    expect(screen.getByTestId('section-tab-services')).toBeInTheDocument();
    expect(screen.getByTestId('section-tab-venting')).toBeInTheDocument();
  });

  it('general tab is selected by default', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('section-tab-general')).toHaveAttribute('aria-selected', 'true');
  });

  it('renders thread rows from API data', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('thread-1')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the board')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('shows New Post button', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByTestId('new-post-button')).toBeInTheDocument();
  });

  it('opens new thread modal when New Post is clicked', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('new-post-button'));

    expect(screen.getByTestId('new-thread-title')).toBeInTheDocument();
    expect(screen.getByTestId('new-thread-content')).toBeInTheDocument();
    expect(screen.getByTestId('submit-new-thread')).toBeInTheDocument();
  });

  it('submit button is disabled when title or content is empty', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('new-post-button'));

    expect(screen.getByTestId('submit-new-thread')).toBeDisabled();
  });

  it('shows empty state when there are no threads', () => {
    mockUseThreads.mockReturnValue({
      threads: [],
      total: 0,
      page: 1,
      isLoading: false,
      error: null,
    });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByText(/no threads yet/i)).toBeInTheDocument();
  });

  it('shows error message on API failure', () => {
    mockUseThreads.mockReturnValue({
      threads: [],
      total: 0,
      page: 1,
      isLoading: false,
      error: new Error('Network error'),
    });
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );
    expect(screen.getByText(/failed to load threads/i)).toBeInTheDocument();
  });

  it('calls useThreads with new section when tab is clicked', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageBoardPage />
      </Wrapper>
    );

    await user.click(screen.getByTestId('section-tab-sales'));

    const callArgs = mockUseThreads.mock.calls.map((c) => c[0]);
    expect(callArgs).toContain('sales');
  });
});
