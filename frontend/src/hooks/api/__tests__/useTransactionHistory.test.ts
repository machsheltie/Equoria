/**
 * useTransactionHistory Hook Tests
 *
 * Verifies the hook is permanently disabled (no fake empty-array stub)
 * and returns data: undefined so consumers can render honest beta-excluded copy.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 */

import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useTransactionHistory } from '../useTransactionHistory';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTransactionHistory', () => {
  it('returns data: undefined (not a fake empty array)', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    // Hook is disabled — must not return fake success data
    expect(result.current.data).toBeUndefined();
  });

  it('is not in loading state (disabled query never fetches)', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('is not in error state (disabled query never runs)', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(false);
  });

  it('returns isPending: false (disabled = never pending)', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true); // disabled queries are in 'pending' status
    // but isLoading (isFetching && isPending) must be false
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it('is not fetching (no network request made)', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
  });

  it('does not return a fake empty transactions array', () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    // Old stub returned { transactions: [], total: 0, page: 1, pageSize: 20 }
    // The new hook must NOT do that
    expect(result.current.data?.transactions).toBeUndefined();
  });
});
