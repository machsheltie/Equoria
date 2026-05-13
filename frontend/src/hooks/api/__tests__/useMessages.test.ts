/**
 * useMessages hook tests (Equoria-5oaf)
 *
 * Tests for Epic 19B-2 message hooks: useInbox, useSentMessages, useUnreadCount,
 * useMessage, useSendMessage, useMarkRead.
 *
 * Relies on MSW global handlers (messages section of handlers.ts).
 * Per-test overrides via server.use() for error paths and mutation assertions.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import React from 'react';
import {
  useInbox,
  useSentMessages,
  useUnreadCount,
  useMessage,
  useSendMessage,
  useMarkRead,
} from '../useMessages';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

// ── useInbox ─────────────────────────────────────────────────────────────────

describe('useInbox', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useInbox(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches inbox and returns messages array', async () => {
    const { result } = renderHook(() => useInbox(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.messages).toBeDefined();
    expect(Array.isArray(result.current.data?.messages)).toBe(true);
    expect(result.current.data!.messages.length).toBeGreaterThan(0);

    const msg = result.current.data!.messages[0];
    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('subject');
    expect(msg).toHaveProperty('isRead');
    expect(msg).toHaveProperty('sender');
  });

  it('exposes error on API failure', async () => {
    server.use(http.get('/api/v1/messages/inbox', () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useInbox(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useSentMessages ───────────────────────────────────────────────────────────

describe('useSentMessages', () => {
  it('fetches sent messages with correct shape', async () => {
    const { result } = renderHook(() => useSentMessages(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.messages)).toBe(true);
    const msg = result.current.data!.messages[0];
    expect(msg).toHaveProperty('subject');
    expect(msg).toHaveProperty('recipientId');
  });
});

// ── useUnreadCount ────────────────────────────────────────────────────────────

describe('useUnreadCount', () => {
  it('returns numeric count', async () => {
    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(typeof result.current.data?.count).toBe('number');
    expect(result.current.data!.count).toBe(1);
  });

  it('returns 0 when no unread messages', async () => {
    server.use(http.get('/api/v1/messages/unread-count', () => HttpResponse.json({ count: 0 })));

    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.count).toBe(0);
  });
});

// ── useMessage ────────────────────────────────────────────────────────────────

describe('useMessage', () => {
  it('does not fetch when id is null', () => {
    const { result } = renderHook(() => useMessage(null), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches message detail for valid id', async () => {
    const { result } = renderHook(() => useMessage(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.message).toBeDefined();
    expect(result.current.data!.message.id).toBe(1);
    expect(result.current.data!.message).toHaveProperty('subject');
    expect(result.current.data!.message).toHaveProperty('content');
    expect(result.current.data!.message).toHaveProperty('isRead');
  });

  it('exposes error on 404', async () => {
    const { result } = renderHook(() => useMessage(999), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useSendMessage ────────────────────────────────────────────────────────────

describe('useSendMessage', () => {
  it('calls POST /api/v1/messages and returns sent message', async () => {
    let called = false;
    server.use(
      http.post('/api/v1/messages', () => {
        called = true;
        return HttpResponse.json(
          {
            message: {
              id: 400,
              senderId: 'user-1',
              sender: { id: 'user-1', username: 'testuser' },
              recipientId: 'user-4',
              recipient: { id: 'user-4', username: 'newrider' },
              subject: 'Hello',
              content: 'Test message content',
              tag: undefined,
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useSendMessage(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({
        recipientId: 'user-4',
        subject: 'Hello',
        content: 'Test message content',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(called).toBe(true);
    expect(result.current.data?.message.subject).toBe('Hello');
  });
});

// ── useMarkRead ───────────────────────────────────────────────────────────────

describe('useMarkRead', () => {
  it('calls PATCH /api/v1/messages/:id/read', async () => {
    let patchedId = '';
    server.use(
      http.patch('/api/v1/messages/:id/read', ({ params }) => {
        patchedId = String(params.id);
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useMarkRead(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate(7);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(patchedId).toBe('7');
  });
});
