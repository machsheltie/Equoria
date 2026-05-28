/**
 * useEventStream Hook Tests (ADR-011 / Equoria-rgyv)
 *
 * Unit test of the SSE client hook's lifecycle. A mocked EventSource is
 * used here — acceptable for a UNIT test of the hook (real SSE end-to-end
 * behavior is covered by the backend real-DB integration test
 * backend/modules/events/__tests__/eventStream.integration.test.mjs).
 *
 * Asserts: opens with withCredentials at the correct URL; invalidates the
 * notification query keys on a server event; registers a listener for every
 * backend-emitted event name and dispatches on it (Equoria-9fu3w); cleans up
 * (closes the source) on unmount.
 */

import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useEventStream, SSE_EVENT_NAMES } from '../useEventStream';

interface MockSource {
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<() => void>>;
  onmessage: (() => void) | null;
  onerror: (() => void) | null;
  closed: boolean;
  addEventListener: (t: string, cb: () => void) => void;
  removeEventListener: (t: string, cb: () => void) => void;
  close: () => void;
  emit: (t: string) => void;
}

let lastSource: MockSource | null = null;

class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<() => void>> = {};
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    lastSource = this as unknown as MockSource;
  }
  addEventListener(type: string, cb: () => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb);
  }
  close() {
    this.closed = true;
  }
  emit(type: string) {
    // Mirror the SSE spec: a named frame dispatches ONLY to the
    // addEventListener('<type>') handlers; the generic onmessage handler
    // fires only for the default/unnamed 'message' event.
    (this.listeners[type] ?? []).forEach((f) => f());
    if (type === 'message' && this.onmessage) this.onmessage();
  }
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useEventStream', () => {
  beforeEach(() => {
    lastSource = null;
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens an authenticated EventSource at the stream URL with credentials', () => {
    const qc = new QueryClient();
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    expect(lastSource).not.toBeNull();
    expect(lastSource!.url).toContain('/api/v1/events/stream');
    expect(lastSource!.withCredentials).toBe(true);
  });

  it('invalidates the notification query keys when a server event arrives', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    spy.mockClear();
    lastSource!.emit('stat_gain');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['game-notifications'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['messages', 'unread-count'] });
  });

  // Equoria-9fu3w: the hook must listen for the EXACT named event types the
  // backend SSE producer emits. Before the fix, the competition + marketplace
  // events were registered under the wrong name ('competition_result') or not
  // at all, so they were silently dropped on the SSE fast-path and only
  // arrived via the 5s poll. This is the SSE_EVENT_NAMES contract with the
  // backend createNotification(...) type strings.
  it.each([
    'stat_gain',
    'foal_born',
    'competition_placement',
    'competition_stat_gain',
    'horse_purchased',
    'horse_sold',
    'club_leadership_transferred',
  ])('registers a listener for backend event "%s" and invalidates on it', (eventName) => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    // The hook must have registered a handler for this exact named event.
    expect(lastSource!.listeners[eventName]?.length).toBeGreaterThan(0);

    spy.mockClear();
    // Simulate the backend producer emitting `event: <eventName>`. Per the
    // SSE spec this fires ONLY the addEventListener('<eventName>') handlers,
    // NOT onmessage — so a missing/misnamed listener means a dropped event.
    lastSource!.emit(eventName);

    expect(spy).toHaveBeenCalledWith({ queryKey: ['game-notifications'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['messages', 'unread-count'] });
  });

  // Equoria-lewrv: the DM live-receipt producer emits `event: message`. Per
  // the SSE spec a frame with `event: message` dispatches to the EventSource
  // onmessage catch-all (NOT a named addEventListener), so the hook's
  // `source.onmessage = invalidate` is what carries the live unread-count
  // refresh. Assert that an incoming 'message' frame invalidates the
  // messages unread-count query.
  it("invalidates the messages unread-count when a 'message' (DM) frame arrives", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    spy.mockClear();
    // FakeEventSource.emit('message') fires the onmessage catch-all, mirroring
    // a real `event: message` frame from messageController.sendMessage.
    lastSource!.emit('message');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['messages', 'unread-count'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['game-notifications'] });
  });

  it('exports SSE_EVENT_NAMES matching exactly the backend producer event types', () => {
    // Lockstep contract with the backend createNotification(...) type strings.
    expect([...SSE_EVENT_NAMES]).toEqual([
      'stat_gain',
      'foal_born',
      'competition_placement',
      'competition_stat_gain',
      'horse_purchased',
      'horse_sold',
      'forum_reply',
      'club_leadership_transferred',
    ]);
  });

  it('does NOT register the dead "competition_result" listener (no backend producer)', () => {
    const qc = new QueryClient();
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    // 'competition_result' matched no backend producer — registering it was
    // dead code. The real competition events are competition_placement /
    // competition_stat_gain.
    expect(lastSource!.listeners['competition_result']).toBeUndefined();
  });

  it('closes the EventSource on unmount (no leak)', () => {
    const qc = new QueryClient();
    const { unmount } = renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    expect(lastSource!.closed).toBe(false);
    unmount();
    expect(lastSource!.closed).toBe(true);
  });

  it('degrades gracefully when EventSource is unavailable', () => {
    vi.stubGlobal('EventSource', undefined);
    const qc = new QueryClient();
    // Must not throw when the platform has no EventSource — polling remains.
    expect(() => renderHook(() => useEventStream(), { wrapper: createWrapper(qc) })).not.toThrow();
  });
});
