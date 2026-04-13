/**
 * useTransactionHistory Hook
 *
 * React Query hook for fetching paginated transaction history.
 *
 * Backend endpoint `/api/v1/users/transactions` is not yet implemented.
 * This hook returns a disabled query (no fake empty success) so consumers
 * receive `data: undefined` and can render honest beta-excluded copy.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * (Removed fake empty-array stub; hook is disabled until real endpoint exists)
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
 * Returns a disabled query until the backend endpoint is available.
 * Consumers should check `data === undefined` and render explicit
 * beta-excluded copy rather than assuming empty means no transactions.
 *
 * @param userId - The user's ID (0 or undefined disables the query)
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of results per page
 *
 * @example
 * const { data, isLoading } = useTransactionHistory(userId);
 * if (data === undefined) {
 *   // Show beta-excluded notice — not available in this beta
 * }
 */
export function useTransactionHistory(userId: number, page = 1, _pageSize = 20) {
  return useQuery<TransactionHistoryResponse>({
    queryKey: ['transactions', userId, page],
    // Backend endpoint is not yet implemented — query is permanently disabled.
    // This queryFn would throw if the query were ever enabled, ensuring no
    // fake empty data is returned to consumers.
    queryFn: async (): Promise<TransactionHistoryResponse> => {
      throw new Error('Transaction history is not available in this beta.');
    },
    enabled: false,
    staleTime: 2 * 60 * 1000,
  });
}
