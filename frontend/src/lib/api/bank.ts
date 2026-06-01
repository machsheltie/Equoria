/**
 * Bank API client (Equoria-rfsml).
 *
 *   POST /api/v1/bank/claim          → Claim weekly reward
 *   GET  /api/v1/bank/claim-status   → Check claim availability
 *   GET  /api/v1/users/transactions  → Transaction history
 */

import { apiClient } from '../http/apiClient.js';

export interface WeeklyClaimResponse {
  amount: number;
  newBalance: number;
  nextClaimDate: string;
}

export interface ClaimStatusResponse {
  canClaim: boolean;
  nextClaimDate: string | null;
  rewardAmount: number;
}

export interface TransactionHistoryItem {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  category: string;
  description: string;
  balanceAfter: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface TransactionHistoryResponse {
  transactions: TransactionHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const bankApi = {
  claimWeekly: () => apiClient.post<WeeklyClaimResponse>('/api/v1/bank/claim', {}),
  getClaimStatus: () => apiClient.get<ClaimStatusResponse>('/api/v1/bank/claim-status'),
  getTransactions: (page = 1, pageSize = 20) =>
    apiClient.get<TransactionHistoryResponse>(
      `/api/v1/users/transactions?page=${page}&pageSize=${pageSize}`
    ),
};
