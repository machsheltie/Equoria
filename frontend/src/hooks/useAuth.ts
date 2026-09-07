/**
 * Authentication Hooks using React Query
 *
 * Provides hooks for login, register, logout, and profile management
 * Uses httpOnly cookies for secure authentication (no localStorage)
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, ApiError } from '../lib/api-client';
import type {
  AuthenticatedSessionResult,
  EmailChangeConfirmResult,
  EmailChangeRequestCredentials,
  EmailChangeRequestResult,
  EmailChangeStatus,
  LoginResult,
  MfaChallengeCredentials,
} from '../lib/api/auth';

/**
 * Available user roles in the system.
 * Hierarchy: admin > moderator > user
 */
export type UserRole = 'user' | 'admin' | 'moderator';

/**
 * User data shape
 */
export interface User {
  // Backend Prisma: User.id is String @id @default(uuid()) — the auth user id
  // is a UUID string at runtime, NOT a numeric DB int (Equoria-ai6pw).
  id: string;
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
  /** Whether the player has completed the new-user onboarding wizard. Undefined for legacy accounts. */
  completedOnboarding?: boolean;
  /** Current step in the 10-step onboarding spotlight tour (0 = not started, 1-10 = in progress, 10 = complete). */
  onboardingStep?: number;
  /** Backend-persisted notification preferences (see SettingsPage). */
  notifications?: Record<string, boolean | string | number> | null;
  /** Backend-persisted display/accessibility preferences (see SettingsPage). */
  display?: Record<string, boolean | string | number> | null;
  /** Persisted user preferences surfaced on /settings. Story 21S-5. */
  preferences?: Partial<import('@/lib/api-client').UserPreferences>;
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
  // Equoria-iqzn / Equoria-9tlha: collected at registration for the
  // server-authoritative COPPA age gate. ISO date string (YYYY-MM-DD).
  dateOfBirth?: string;
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
 * Hook to login user.
 *
 * Resolves to the session-or-challenge union (Finding 7, Equoria-6p398.7). For
 * an MFA-enrolled account the backend verifies the password and deliberately
 * issues NO session, so this hook must NOT refresh the profile on that branch:
 * doing so would send the player's cached identity into an authenticated-looking
 * state while no session cookie exists. Only a completed session invalidates.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<LoginResult, ApiError, LoginCredentials>({
    mutationFn: authApi.login,
    onSuccess: (result) => {
      if (result.status !== 'authenticated') return;
      // Force fresh profile fetch so balance, level, role etc. are correct
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/**
 * Hook to complete the second factor of login.
 *
 * Uses the same session finalization as an ordinary login: the backend sets the
 * session cookies and returns the user-bound CSRF token (seeded by
 * `authApi.mfaChallenge`), and the profile is refetched so the app enters with
 * real server truth.
 */
export function useMfaChallenge() {
  const queryClient = useQueryClient();

  return useMutation<AuthenticatedSessionResult, ApiError, MfaChallengeCredentials>({
    mutationFn: authApi.mfaChallenge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
    onSuccess: () => {
      // Force fresh profile fetch so balance, level, role etc. are correct
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
    onSettled: () => {
      // Clear all cached data on logout (even if the API call fails,
      // e.g. due to an already-expired token returning 401)
      queryClient.clear();
      // Force redirect to login — ProtectedRoute may not re-evaluate
      // quickly enough after cache clear, so navigate explicitly
      window.location.href = '/login';
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
      toast.success('Profile updated successfully.');
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to update profile. Please try again.');
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
    { verified: boolean; user: { id: string; email: string; username: string } },
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
 * Hook to request password reset email.
 */
export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: authApi.forgotPassword,
  });
}

/**
 * Hook to reset password with token.
 */
export function useResetPassword() {
  return useMutation<{ message: string }, ApiError, { token: string; newPassword: string }>({
    mutationFn: ({ token, newPassword }) => authApi.resetPassword(token, newPassword),
  });
}

/**
 * Hook to change password for authenticated user.
 * Invalidates all sessions on success.
 */
export function useChangePassword() {
  return useMutation<{ message: string }, ApiError, { oldPassword: string; newPassword: string }>({
    mutationFn: ({ oldPassword, newPassword }) => authApi.changePassword(oldPassword, newPassword),
  });
}

/** Query key for the recovery-address read, shared by its consumers. */
export const EMAIL_CHANGE_STATUS_KEY = ['emailChangeStatus'] as const;

/**
 * Hook to read the signed-in account's recovery-address state
 * (Finding 9, Equoria-6p398.11).
 *
 * The surface needs this BEFORE it can ask for anything: a wrong password and a
 * missing second factor are both a bare 401 on the request endpoint, so whether
 * to show a code field cannot be inferred from a failure. It also carries the
 * live pending replacement, which is what makes a reloaded surface honest
 * instead of blank.
 *
 * `staleTime: 0` deliberately: a staged change must be visible on the next read
 * rather than after a cache window.
 */
export function useEmailChangeStatus(enabled = true) {
  return useQuery<EmailChangeStatus, ApiError>({
    queryKey: EMAIL_CHANGE_STATUS_KEY,
    queryFn: authApi.getEmailChangeStatus,
    retry: false,
    staleTime: 0,
    enabled,
  });
}

/**
 * Hook to stage a replacement recovery address.
 *
 * Success is NOT an identity change — nothing has moved yet — so the profile
 * cache is left alone. Only the recovery-address read is refreshed, which is
 * what turns the surface into its "a letter is waiting" state.
 */
export function useRequestEmailChange() {
  const queryClient = useQueryClient();

  return useMutation<EmailChangeRequestResult, ApiError, EmailChangeRequestCredentials>({
    mutationFn: authApi.requestEmailChange,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMAIL_CHANGE_STATUS_KEY });
    },
  });
}

/**
 * A short, NON-SECRET discriminator for a confirmation token.
 *
 * The token itself must never become a React Query cache key: a key is retained
 * for the entry's whole lifetime, is enumerable through the cache, and an
 * interrupted fetch would leave a still-live secret sitting in it. This is a
 * 32-bit FNV-1a fold — one-way in the only sense that matters here (it keeps at
 * most 32 bits of a 256-bit token, so it identifies "this link" without being
 * usable as one), and it is synchronous, which `crypto.subtle.digest` is not.
 *
 * A digest is used rather than a per-page-load id precisely because it is
 * STABLE: the same link re-opened (a browser Back, a remount) hits the same
 * cache entry instead of spending the single-use token a second time and
 * telling the player her own successful change had failed.
 */
function tokenFingerprint(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Hook to confirm a staged recovery address from the emailed link.
 *
 * Modelled as a ONE-SHOT QUERY rather than a mutation, deliberately. The
 * endpoint is a `GET` whose authority is the token in the URL, so "fetch it
 * once and show what came back" is exactly a query's shape — no imperative
 * trigger, no effect firing a mutation on mount, and the four representable
 * states come straight from the query.
 *
 * The token travels in the CLOSURE, never in the key (see `tokenFingerprint`).
 * Every refetch trigger is disabled because the link is single-use, and
 * `gcTime` is left bounded rather than `Infinity` so the closure holding the
 * token is released after the page is left instead of living as long as the
 * tab. `enabled` keeps a tokenless visit from spending a request at all.
 *
 * The identity moved and the backend stamped the address verified in the same
 * transaction, so profile and verification truth must be refetched from the
 * server rather than patched locally.
 */
export function useConfirmEmailChange(token: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<EmailChangeConfirmResult, ApiError>({
    queryKey: ['emailChangeConfirm', token ? tokenFingerprint(token) : null],
    queryFn: () => authApi.confirmEmailChange(token as string),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    // Explicit, and deliberately NOT Infinity: five minutes after the last
    // observer goes away the entry — and the queryFn closure that holds the
    // raw token — is collected.
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const confirmedEmail = query.data?.email;
  useEffect(() => {
    if (!confirmedEmail) return;
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['verificationStatus'] });
    queryClient.invalidateQueries({ queryKey: EMAIL_CHANGE_STATUS_KEY });
  }, [confirmedEmail, queryClient]);

  return query;
}

/**
 * Hook to delete the authenticated user's account.
 * Clears all cached data and redirects to login on success.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (userId: string) => authApi.deleteAccount(userId),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/login';
    },
  });
}
