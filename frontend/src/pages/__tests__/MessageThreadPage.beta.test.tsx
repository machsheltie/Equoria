/**
 * MessageThreadPage — Beta Mode Tests
 *
 * Verifies that /message-board/:threadId renders read-only in beta:
 * - Thread content still renders for read access
 * - /community breadcrumb is plain text, not a link
 * - Reply box is absent
 * - Submit reply button is absent
 * - useIncrementView().mutate is NOT called
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code (fourth-pass correction)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';

// ── Mock betaRouteScope with isBetaMode: true ──────────────────────────────────
vi.mock('@/config/betaRouteScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/betaRouteScope')>();
  return { ...actual, isBetaMode: true };
});

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

describe('MessageThreadPage — beta mode', () => {
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

  it('renders thread content for read access in beta', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(screen.getByTestId('post-list')).toBeInTheDocument();
    expect(screen.getByText('First post content')).toBeInTheDocument();
  });

  it('does not render /community as a link in beta', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    const communityLink = screen.queryByRole('link', { name: /community/i });
    // community link must not be present — it is plain text in beta
    expect(communityLink).not.toBeInTheDocument();
    // but the text still renders
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  it('does not render the reply box in beta', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(screen.queryByTestId('reply-box')).not.toBeInTheDocument();
    expect(screen.queryByTestId('submit-reply')).not.toBeInTheDocument();
  });

  it('does not call useIncrementView().mutate in beta', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <MessageThreadPage />
      </Wrapper>
    );

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
