/**
 * User API functions
 * Provides API calls for user-related data including balance.
 */
import apiClient from '@/lib/api-client';

export interface UserBalance {
  userId: number;
  balance: number;
  currency: string;
}

export function fetchUserBalance(userId: number): Promise<UserBalance> {
  return apiClient.get<UserBalance>(`/api/v1/users/${userId}/balance`);
}
