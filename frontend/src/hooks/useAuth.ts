/**
 * Authentication Hooks using React Query
 *
 * Provides hooks for login, register, logout, and profile management
 * Uses httpOnly cookies for secure authentication (no localStorage)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, ApiError } from '../lib/api-client';

/**
 * User data shape
 */
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  money?: number;
  level?: number;
  xp?: number;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Hook to get current user profile
 * Automatically uses httpOnly cookies
 */
export function useProfile() {
  return useQuery<{ user: User }, ApiError>({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
    retry: false, // Don't retry on 401
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to login user
 * Sets httpOnly cookies automatically
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<{ user: User }, ApiError, LoginCredentials>({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      // Update profile cache
      queryClient.setQueryData(['profile'], data);
    },
  });
}

/**
 * Hook to register new user
 * Sets httpOnly cookies automatically
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation<{ user: User }, ApiError, RegisterData>({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      // Update profile cache
      queryClient.setQueryData(['profile'], data);
    },
  });
}

/**
 * Hook to logout user
 * Clears httpOnly cookies
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiError>({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<{ user: User }, ApiError, Partial<User>>({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      // Update profile cache
      queryClient.setQueryData(['profile'], data);
    },
  });
}

/**
 * Hook to check if user is authenticated
 * Uses profile query status
 */
export function useIsAuthenticated() {
  const { data, isSuccess } = useProfile();
  return isSuccess && !!data?.user;
}
