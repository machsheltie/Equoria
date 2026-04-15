/**
 * MessageThreadPage — Beta Behavior Tests
 *
 * Verifies that /message-board/:threadId is fully active in beta:
 * - Thread content renders
 * - /community breadcrumb is a navigable link
 * - Reply box is present and interactive
 * - Submit reply button is present
 * - useIncrementView().mutate IS called on mount
 *
 * Story 21R-2: Remove beta read-only restrictions — message thread must be
 * fully writable in beta, not hidden or read-only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';

// ── Mock react-router-dom useParams ────────────────────────────────────────────
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ threadId: '42' }),
  };
});

// ── Mock PageHero ──────────────────────────────────────────────────────────────
vi.mock('@/components/layout/PageHero', () => ({
  default: ({ children }: { children?: ReactNode }) => (
    <div data-testid="page-hero">{children}</div>
  ),
}));

// ── Mock useForum hooks ────────────────────────────────────────────────────────
const mockMutate = vi.fn();

vi.mock('@/hooks/api/useForum', () => ({
  useThread: () => ({
    thread: {
      id: 42,
      title: 'Test Thread',
      section: 'general',
      isPinned: false,
      tags: [],
      author: { username: 'testuser' },
    },
    posts: [
      {
        id: 1,
        content: 'First post content',
        createdAt: new Date().toISOString(),
        author: { username: 'testuser' },
      },
    ],
    isLoading: false,
    error: null,
  }),
  useCreatePost: () => ({
    mutateAsync: vi.fn(),
  }),
  useIncrementView: () => ({
    mutate: mockMutate,
  }),
}));

// Import AFTER mocks are registered
const { default: MessageThreadPage } = await import('../MessageThreadPage');

describe('MessageThreadPage — beta active behavior', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TestRouter>{children}</TestRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders thread content with post list', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(screen.getByTestId('post-list')).toBeInTheDocument();
    expect(screen.getByText('First post content')).toBeInTheDocument();
  });

  it('renders /community as a navigable link — not plain text', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    // Community must be a real link — not suppressed or degraded to plain text
    const communityLink = screen.getByRole('link', { name: /community/i });
    expect(communityLink).toBeInTheDocument();
    expect(communityLink).toHaveAttribute('href', '/community');
  });

  it('renders the reply box and submit button — thread is writable', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(screen.getByTestId('reply-box')).toBeInTheDocument();
    expect(screen.getByTestId('submit-reply')).toBeInTheDocument();
  });

  it('calls useIncrementView().mutate on mount with thread id', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(mockMutate).toHaveBeenCalledWith(42);
  });
});
