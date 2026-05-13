/**
 * useForum hook tests (Equoria-5oaf)
 *
 * Tests for Epic 19B-1 forum hooks: useThreads, useThread, useCreateThread,
 * useCreatePost, useIncrementView.
 *
 * Relies on MSW global handlers (forum section of handlers.ts).
 * Per-test overrides via server.use() for error paths and mutation assertions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import React from 'react';
import {
  useThreads,
  useThread,
  useCreateThread,
  useCreatePost,
  useIncrementView,
} from '../useForum';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── useThreads ───────────────────────────────────────────────────────────────

describe('useThreads', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.threads).toEqual([]);
  });

  it('fetches all threads and returns array with correct shape', async () => {
    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(Array.isArray(result.current.threads)).toBe(true);
    expect(result.current.threads.length).toBeGreaterThan(0);
    expect(result.current.total).toBeGreaterThan(0);
    expect(result.current.page).toBe(1);

    const thread = result.current.threads[0];
    expect(thread).toHaveProperty('id');
    expect(thread).toHaveProperty('section');
    expect(thread).toHaveProperty('title');
    expect(thread).toHaveProperty('author');
    expect(thread).toHaveProperty('replyCount');
    expect(thread).toHaveProperty('viewCount');
  });

  it('filters threads by section', async () => {
    const { result } = renderHook(() => useThreads('sales'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.threads.every((t) => t.section === 'sales')).toBe(true);
  });

  it('returns empty arrays and zero totals on API error', async () => {
    server.use(http.get('/api/v1/forum/threads', () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useThreads(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.threads).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

// ── useThread ────────────────────────────────────────────────────────────────

describe('useThread', () => {
  it('does not fetch when id is null', () => {
    const { result } = renderHook(() => useThread(null), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.thread).toBeNull();
    expect(result.current.posts).toEqual([]);
  });

  it('fetches thread and posts for a valid id', async () => {
    const { result } = renderHook(() => useThread(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.thread).not.toBeNull();
    expect(result.current.thread?.id).toBe(1);
    expect(Array.isArray(result.current.posts)).toBe(true);
    expect(result.current.posts.length).toBeGreaterThan(0);
    expect(result.current.posts[0]).toHaveProperty('content');
  });

  it('exposes error on 404', async () => {
    const { result } = renderHook(() => useThread(999), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.thread).toBeNull();
    expect(result.current.posts).toEqual([]);
  });
});

// ── useCreateThread ──────────────────────────────────────────────────────────

describe('useCreateThread', () => {
  it('calls POST /api/v1/forum/threads and returns created thread', async () => {
    let called = false;
    server.use(
      http.post('/api/v1/forum/threads', () => {
        called = true;
        return HttpResponse.json(
          {
            thread: {
              id: 100,
              section: 'general',
              title: 'Test Thread',
              author: { id: 'user-1', username: 'testuser' },
              tags: [],
              isPinned: false,
              viewCount: 1,
              replyCount: 1,
              lastActivityAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
            firstPost: {
              id: 200,
              threadId: 100,
              author: { id: 'user-1', username: 'testuser' },
              content: 'Hello world',
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useCreateThread(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({
        section: 'general',
        title: 'Test Thread',
        content: 'Hello world',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(called).toBe(true);
    expect(result.current.data?.thread.title).toBe('Test Thread');
  });
});

// ── useCreatePost ────────────────────────────────────────────────────────────

describe('useCreatePost', () => {
  it('calls POST /api/v1/forum/threads/:id/posts', async () => {
    let calledPath = '';
    server.use(
      http.post('/api/v1/forum/threads/:id/posts', ({ params }) => {
        calledPath = `/api/v1/forum/threads/${params.id}/posts`;
        return HttpResponse.json(
          {
            post: {
              id: 300,
              threadId: 1,
              author: { id: 'user-1', username: 'testuser' },
              content: 'A reply',
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useCreatePost(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ threadId: 1, content: 'A reply' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPath).toBe('/api/v1/forum/threads/1/posts');
    expect(result.current.data?.post.content).toBe('A reply');
  });
});

// ── useIncrementView ─────────────────────────────────────────────────────────

describe('useIncrementView', () => {
  it('fires POST /api/v1/forum/threads/:id/view (fire-and-forget)', async () => {
    let called = false;
    server.use(
      http.post('/api/v1/forum/threads/:id/view', () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useIncrementView(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(42);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(called).toBe(true);
  });
});
