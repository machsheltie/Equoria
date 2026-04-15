/**
 * useTransactionHistory Hook Tests
 *
 * Verifies the hook fetches the persisted transaction ledger.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useTransactionHistory } from '../useTransactionHistory';
import { bankApi } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  bankApi: {
    getTransactions: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bankApi.getTransactions).mockResolvedValue({
      transactions: [
        {
          id: 1,
          type: 'credit',
          amount: 500,
          category: 'weekly_reward',
          description: 'Weekly reward claim',
          balanceAfter: 1500,
          metadata: {},
          timestamp: '2026-04-14T12:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('fetches persisted transactions for the authenticated user', async () => {
    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(bankApi.getTransactions).toHaveBeenCalledWith(1, 20);
    expect(result.current.data?.transactions[0]).toMatchObject({
      id: 1,
      type: 'credit',
      amount: 500,
      description: 'Weekly reward claim',
    });
  });

  it('stays idle when disabled by missing user id', () => {
    const { result } = renderHook(() => useTransactionHistory(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(bankApi.getTransactions).not.toHaveBeenCalled();
  });

  it('passes pagination to the API client', async () => {
    const { result } = renderHook(() => useTransactionHistory(1, 3, 10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(bankApi.getTransactions).toHaveBeenCalledWith(3, 10);
  });
});
