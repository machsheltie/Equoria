/**
 * useTransactionHistory Hook
 *
 * React Query hook for fetching paginated transaction history.
 *
 * Story 2.3: Currency Management - AC-3
 */

import { useQuery } from '@tanstack/react-query';
import { bankApi } from '@/lib/api-client';

/**
 * A single currency transaction entry
 */
export interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  category: string;
  description: string;
  balanceAfter: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Paginated transaction history response shape
 */
export interface TransactionHistoryResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Hook to fetch paginated transaction history for a user.
 *
 * @param userId - The user's ID (0 or undefined disables the query)
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of results per page
 */
export function useTransactionHistory(
  userId: string | number | undefined,
  page = 1,
  pageSize = 20
) {
  return useQuery<TransactionHistoryResponse>({
    queryKey: ['transactions', userId, page, pageSize],
    queryFn: () => bankApi.getTransactions(page, pageSize),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });
}
