/**
 * Authentication Hooks using React Query
 *
 * Provides hooks for login, register, logout, and profile management
 * Uses httpOnly cookies for secure authentication (no localStorage)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, ApiError } from '../lib/api-client';

/**
 * Available user roles in the system.
 * Hierarchy: admin > moderator > user
 */
export type UserRole = 'user' | 'admin' | 'moderator';

/**
 * User data shape
 */
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  /** User bio for profile (max 500 characters) */
  bio?: string;
  /** URL to user's avatar image */
  avatarUrl?: string;
  money?: number;
  level?: number;
  xp?: number;
  /** User's role for access control. Defaults to 'user' if not set. */
  role?: UserRole;
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

/**
 * Hook to verify email with token
 * Token comes from email verification link
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation<
    { verified: boolean; user: { id: number; email: string; username: string } },
    ApiError,
    string
  >({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      // Invalidate profile to get updated verification status
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['verificationStatus'] });
    },
  });
}

/**
 * Hook to resend verification email
 * Requires authentication
 */
export function useResendVerification() {
  return useMutation<{ emailSent: boolean; expiresAt: string }, ApiError>({
    mutationFn: authApi.resendVerification,
  });
}

/**
 * Hook to get email verification status
 * Requires authentication
 */
export function useVerificationStatus() {
  return useQuery<{ verified: boolean; email: string; verifiedAt: string | null }, ApiError>({
    queryKey: ['verificationStatus'],
    queryFn: authApi.getVerificationStatus,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to request password reset email
 * Note: Requires backend endpoint (not yet implemented)
 */
export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: authApi.forgotPassword,
  });
}

/**
 * Hook to reset password with token
 * Note: Requires backend endpoint (not yet implemented)
 */
export function useResetPassword() {
  return useMutation<{ message: string }, ApiError, { token: string; newPassword: string }>({
    mutationFn: ({ token, newPassword }) => authApi.resetPassword(token, newPassword),
  });
}
