/**
 * Authentication API client (Equoria-jog8w, Equoria-aodym slice 2).
 *
 * Owns the UserPreferences shape (Story 21S-5) alongside the authApi surface
 * that reads/writes it. All endpoints rely on httpOnly cookies for auth.
 */

import { apiClient } from '../http/apiClient.js';
import authSessionState from '../authSessionState.js';

/**
 * User preference shape persisted server-side and surfaced on /settings.
 * Must stay aligned with ALLOWED_PREFERENCE_KEYS in
 * backend/modules/auth/controllers/authController.mjs (Story 21S-5).
 */
export interface UserPreferences {
  // Email notifications
  emailCompetition: boolean;
  emailBreeding: boolean;
  emailSystem: boolean;
  // In-app notifications
  inAppTraining: boolean;
  inAppAchievements: boolean;
  inAppNews: boolean;
  // Display / accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  compactCards: boolean;
  // Sound
  soundEnabled: boolean;
}

/** The account behind a completed authentication, as the auth endpoints return it. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
}

/**
 * Login/second-factor completed: the backend issued the real session cookies
 * and the user-bound CSRF token.
 */
export interface AuthenticatedSessionResult {
  status: 'authenticated';
  user: AuthenticatedUser;
  csrfToken?: string;
}

/**
 * Login verified the password but issued NO session because the account has a
 * second factor enrolled (authController.login, Equoria-2vwwh). The challenge
 * token is short-lived and belongs in transient memory only — never storage,
 * a URL, or a log.
 */
export interface MfaChallengeRequiredResult {
  status: 'mfa_required';
  mfaChallengeToken: string;
}

/**
 * A login attempt resolves to exactly one of two outcomes. Callers must branch
 * on `status`; a challenge is never a user (Finding 7, Equoria-6p398.7).
 */
export type LoginResult = AuthenticatedSessionResult | MfaChallengeRequiredResult;

/**
 * What the recovery-address surface must know before it asks for anything
 * (Finding 9, Equoria-6p398.11).
 *
 * `POST /auth/email-change/request` refuses a wrong password and a missing or
 * wrong TOTP with the SAME bare 401, so a client cannot infer from a failure
 * whether the account carries a second factor. `secondFactorRequired` is that
 * missing fact. `pending` is the single live staged replacement, so a reloaded
 * surface can say a letter is waiting instead of pretending nothing happened.
 */
export interface EmailChangeStatus {
  /** The confirmed address — still the live recovery identity. */
  email: string;
  emailVerified: boolean;
  secondFactorRequired: boolean;
  pending: { email: string; expiresAt: string } | null;
}

/** Fresh authentication for a recovery-address change. */
export interface EmailChangeRequestCredentials {
  email: string;
  password: string;
  /** Required only when `secondFactorRequired` is true. */
  totpToken?: string;
}

/** What the backend reports after staging (never the token itself). */
export interface EmailChangeRequestResult {
  pendingEmail: string;
  expiresAt: string;
  delivered: boolean;
  /**
   * False when the heads-up to the CURRENT address could not be sent. The
   * change is staged either way; the surface says so rather than hiding it.
   */
  noticeDelivered: boolean;
}

/** The account after a confirmed recovery-address change. */
export interface EmailChangeConfirmResult {
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
}

/** Second-factor proof: a TOTP from the authenticator app, or a recovery code. */
export type MfaChallengeCredentials =
  | { mfaChallengeToken: string; token: string; recoveryCode?: never }
  | { mfaChallengeToken: string; recoveryCode: string; token?: never };

/** Raw `data` block the two session-issuing auth endpoints can return. */
interface RawAuthResponse {
  user?: AuthenticatedUser;
  csrfToken?: string;
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
}

/**
 * Equoria-f6wfa: login and the MFA challenge both rotate the auth cookies. The
 * CSRF token cached during the request itself is bound to the ANONYMOUS
 * identifier and is stale the moment the new auth cookie applies. Seed the
 * freshly-bound token so the FIRST authenticated mutation sends a matching
 * token instead of 403-ing (INVALID_CSRF_TOKEN) and relying on the apiClient's
 * one-shot retry to recover. Both paths must finalize the session identically.
 */
function finalizeAuthenticatedSession(raw: RawAuthResponse): AuthenticatedSessionResult {
  if (raw?.csrfToken) {
    authSessionState.csrfToken = raw.csrfToken;
  }
  return { status: 'authenticated', user: raw.user as AuthenticatedUser, csrfToken: raw.csrfToken };
}

/**
 * Read a session-issuing auth response without ever casting a challenge into a
 * user. An unrecognised shape is an error, not a silent success.
 */
function readAuthResponse(raw: RawAuthResponse, endpointLabel: string): LoginResult {
  if (raw?.mfaRequired === true && typeof raw.mfaChallengeToken === 'string') {
    // Deliberately NOT seeding CSRF: no session exists yet.
    return { status: 'mfa_required', mfaChallengeToken: raw.mfaChallengeToken };
  }
  if (raw?.user?.id) {
    return finalizeAuthenticatedSession(raw);
  }
  throw {
    message: `${endpointLabel} returned neither a session nor a second-factor challenge.`,
    status: 'error',
    statusCode: 500,
  };
}

export const authApi = {
  /**
   * Login user.
   *
   * Resolves to a discriminated union: an authenticated session, or the MFA
   * challenge the backend issues instead of a session for an enrolled account.
   * Sets httpOnly cookies automatically on the authenticated branch.
   */
  login: async (credentials: { email: string; password: string }): Promise<LoginResult> => {
    const result = await apiClient.post<RawAuthResponse>('/api/v1/auth/login', credentials);
    return readAuthResponse(result, 'Login');
  },

  /**
   * Complete the second factor of login (POST /api/v1/auth/mfa/challenge).
   *
   * Public endpoint: it consumes the short-lived challenge token from `login`
   * plus either a TOTP `token` or a single-use `recoveryCode`, and on success
   * issues the same session triple as an ordinary login
   * (authSessionService.issueAuthenticatedSession).
   *
   * `token` stays a string end-to-end so a leading zero survives.
   */
  mfaChallenge: async (
    credentials: MfaChallengeCredentials
  ): Promise<AuthenticatedSessionResult> => {
    const result = await apiClient.post<RawAuthResponse>('/api/v1/auth/mfa/challenge', credentials);
    if (!result?.user?.id) {
      throw {
        message: 'The second factor was accepted but no session was issued.',
        status: 'error',
        statusCode: 500,
      };
    }
    return finalizeAuthenticatedSession(result);
  },

  /**
   * Register new user
   * Sets httpOnly cookies automatically
   */
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    // Equoria-iqzn / Equoria-9tlha: ISO date string (YYYY-MM-DD) sent to
    // the server-authoritative COPPA age gate at POST /api/v1/auth/register.
    dateOfBirth?: string;
  }) => {
    const result = await apiClient.post<{
      user: {
        id: string;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
        money: number;
        level: number;
        xp: number;
      };
      // 21R-AUTH-3: the backend seeds a CSRF cookie + returns the matching
      // token (already bound to the new user.id) on successful registration.
      csrfToken?: string;
    }>('/api/v1/auth/register', userData);
    // Equoria-f6wfa: registration rotates the auth cookies. The CSRF token
    // cached during the register POST itself is bound to the ANONYMOUS
    // identifier; the very next mutation (e.g. advance-onboarding during the
    // onboarding wizard) would send that stale token and 403
    // (INVALID_CSRF_TOKEN). Seed the freshly-bound token returned in the
    // register response so the first post-registration mutation succeeds
    // without depending on the apiClient's 403 retry.
    if (result?.csrfToken) {
      authSessionState.csrfToken = result.csrfToken;
    }
    return result;
  },

  /**
   * Get current user profile
   * Uses httpOnly cookies for authentication
   */
  getProfile: () => {
    return apiClient.get<{
      user: {
        id: string;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
        money?: number;
        level?: number;
        xp?: number;
        role?: 'user' | 'admin' | 'moderator';
        completedOnboarding?: boolean;
        onboardingStep?: number;
        /** Story 21S-5: canonical persisted preferences field. */
        preferences?: Partial<UserPreferences>;
        /** @deprecated Legacy JSONB columns — prefer preferences above. */
        notifications?: Record<string, boolean | string | number> | null;
        /** @deprecated Legacy JSONB columns — prefer preferences above. */
        display?: Record<string, boolean | string | number> | null;
      };
    }>('/api/v1/auth/profile');
  },

  /**
   * Update user profile
   * Supports updating username/bio plus notification and display preferences.
   * Preference payloads are merged into User.settings on the backend and persist
   * across sessions and devices (production parity with beta testing).
   *
   * `email` is deliberately NOT part of this payload. The address is the
   * account's recovery identity, so it moves only through the staged
   * request/confirm flow below; the backend answers a changed address here with
   * 403 (Finding 5, Equoria-6p398.5). Keeping the field typed here only invited
   * callers to write a request that can never succeed.
   */
  updateProfile: (updates: {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    notifications?: Record<string, boolean | string | number>;
    display?: Record<string, boolean | string | number>;
  }) => {
    return apiClient.put<{
      user: {
        id: string;
        username: string;
        email: string;
        bio?: string;
        avatarUrl?: string;
        notifications?: Record<string, boolean | string | number> | null;
        display?: Record<string, boolean | string | number> | null;
      };
    }>('/api/v1/auth/profile', updates);
  },

  /**
   * Update user preferences (Story 21S-5)
   *
   * Merge-updates the authenticated user's notification + display
   * preferences. Unknown keys are rejected server-side.
   */
  updatePreferences: (updates: Partial<UserPreferences>) => {
    return apiClient.patch<{
      status: string;
      data: { preferences: UserPreferences };
    }>('/api/v1/auth/profile/preferences', updates);
  },

  /**
   * Logout user
   * Clears httpOnly cookies
   */
  logout: () => {
    return apiClient.post<{ message: string }>('/api/v1/auth/logout');
  },

  /**
   * Refresh access token
   * Uses httpOnly refresh token cookie automatically
   */
  refreshToken: () => {
    return apiClient.post<{ message: string }>('/api/v1/auth/refresh-token');
  },

  /**
   * Verify email with token
   * Token comes from email link
   */
  verifyEmail: (token: string) => {
    return apiClient.get<{
      verified: boolean;
      user: {
        id: string;
        email: string;
        username: string;
      };
    }>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  /**
   * Resend verification email
   * Requires authentication
   */
  resendVerification: () => {
    return apiClient.post<{
      emailSent: boolean;
      expiresAt: string;
    }>('/api/v1/auth/resend-verification');
  },

  /**
   * Get email verification status
   * Requires authentication
   */
  getVerificationStatus: () => {
    return apiClient.get<{
      verified: boolean;
      email: string;
      verifiedAt: string | null;
    }>('/api/v1/auth/verification-status');
  },

  /**
   * Mark authenticated user's onboarding as complete.
   */
  completeOnboarding: () =>
    apiClient.post<{ completedOnboarding: boolean }>('/api/v1/auth/complete-onboarding', {}),

  /**
   * Advance the authenticated user's onboarding step by 1.
   * Optionally sends horse customization data (name, breedId, gender).
   * Sets completedOnboarding: true when step 10 is reached.
   */
  advanceOnboarding: (horseData?: { horseName?: string; breedId?: number; gender?: string }) =>
    apiClient.post<{ step: number; completed: boolean }>(
      '/api/v1/auth/advance-onboarding',
      horseData ?? {}
    ),

  /**
   * Request password reset email.
   */
  forgotPassword: (email: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', { email });
  },

  /**
   * Reset password with token.
   */
  resetPassword: (token: string, newPassword: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/reset-password', {
      token,
      newPassword,
    });
  },

  /**
   * Read the recovery-address state of the signed-in account
   * (GET /api/v1/auth/email-change/status, Finding 9).
   *
   * Session-gated, read-only, and about the caller's own account only.
   */
  getEmailChangeStatus: () => {
    return apiClient.get<EmailChangeStatus>('/api/v1/auth/email-change/status');
  },

  /**
   * Stage a replacement recovery address
   * (POST /api/v1/auth/email-change/request, Finding 5).
   *
   * Requires fresh authentication: the current password always, plus a current
   * TOTP when the account carries a second factor. Nothing moves yet — the
   * confirmed address stays the live recovery identity until the link mailed to
   * the replacement is opened.
   */
  requestEmailChange: (credentials: EmailChangeRequestCredentials) => {
    return apiClient.post<EmailChangeRequestResult>(
      '/api/v1/auth/email-change/request',
      credentials
    );
  },

  /**
   * Confirm a staged recovery address from the emailed link
   * (GET /api/v1/auth/email-change/confirm, Finding 5).
   *
   * Public: the link is opened from the mailbox of the REPLACEMENT address,
   * routinely in another browser. Authority is the one-time token alone.
   */
  confirmEmailChange: (token: string) => {
    return apiClient.get<EmailChangeConfirmResult>(
      `/api/v1/auth/email-change/confirm?token=${encodeURIComponent(token)}`
    );
  },

  /**
   * Change password for authenticated user.
   * Requires current password and new password.
   * Invalidates all sessions on success (CWE-613).
   */
  changePassword: (oldPassword: string, newPassword: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  /**
   * Delete authenticated user's account.
   * Requires user ID. Permanently removes all user data.
   */
  deleteAccount: (userId: string) => {
    return apiClient.delete<{ message: string }>(`/api/v1/users/${userId}`);
  },
};
