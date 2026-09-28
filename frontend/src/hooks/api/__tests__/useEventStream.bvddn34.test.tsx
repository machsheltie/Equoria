/**
 * useEventStream — money events refresh the balance (Equoria-bvddn.34)
 *
 * Before the fix, `invalidate` only touched ['game-notifications'] and
 * ['messages', 'unread-count'] — a horse sale, a marketplace purchase, a
 * conformation-show prize payout, or entering groom-fee grace all leave the
 * nav balance (['profile'], read by useAuth.ts) stale until the next
 * unrelated profile refetch.
 *
 * Same hermetic-mock strategy as the sibling useEventStream.test.tsx (a real
 * EventSource is not available/deterministic in the test runner) — dispatch
 * a real named frame through the hook's registered listener and assert the
 * REAL query key the nav balance reads.
 */
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useEventStream } from '../useEventStream';

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
    (this.listeners[type] ?? []).forEach((f) => f());
    if (type === 'message' && this.onmessage) this.onmessage();
  }
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useEventStream — money events invalidate the balance (Equoria-bvddn.34)', () => {
  beforeEach(() => {
    lastSource = null;
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['horse_sold', 'horse_purchased', 'competition_placement', 'groom_fee_unpaid'])(
    'invalidates ["profile"] when the "%s" money event arrives',
    (eventName) => {
      const qc = new QueryClient();
      const spy = vi.spyOn(qc, 'invalidateQueries');
      renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

      spy.mockClear();
      lastSource!.emit(eventName);

      expect(spy).toHaveBeenCalledWith({ queryKey: ['profile'] });
      // Still does the baseline notification refresh too.
      expect(spy).toHaveBeenCalledWith({ queryKey: ['game-notifications'] });
    }
  );

  it.each([
    'stat_gain',
    'foal_born',
    'competition_stat_gain',
    'club_leadership_transferred',
    'groom_retired',
    'groom_released',
  ])('does NOT invalidate ["profile"] for the non-money event "%s"', (eventName) => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useEventStream(), { wrapper: createWrapper(qc) });

    spy.mockClear();
    lastSource!.emit(eventName);

    expect(spy).not.toHaveBeenCalledWith({ queryKey: ['profile'] });
  });
});
