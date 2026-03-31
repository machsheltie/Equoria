/**
 * useTransactionHistory Hook
 *
 * React Query hook for fetching paginated transaction history.
 * Currently a stub — backend endpoint `/api/v1/users/transactions` is not yet implemented.
 *
 * Story 2.3: Currency Management - AC-3
 */

import { useQuery } from '@tanstack/react-query';

/**
 * A single currency transaction entry
 */
export interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
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
 * Stub implementation — returns empty data until the backend endpoint is available.
 *
 * @param userId - The user's ID (0 or undefined disables the query)
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of results per page
 *
 * @example
 * const { data, isLoading } = useTransactionHistory(userId);
 */
export function useTransactionHistory(userId: number, page = 1, pageSize = 20) {
  return useQuery<TransactionHistoryResponse>({
    queryKey: ['transactions', userId, page, pageSize],
    queryFn: async (): Promise<TransactionHistoryResponse> => {
      // TODO: replace with real API call when backend implements /api/v1/users/transactions
      // const response = await apiClient.get(`/api/v1/users/${userId}/transactions?page=${page}&pageSize=${pageSize}`);
      // return response.data;
      return { transactions: [], total: 0, page, pageSize };
    },
    enabled: !!userId && userId > 0,
    staleTime: 2 * 60 * 1000,
  });
}
