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
 * Login completed: the backend issued the real session cookies and the
 * user-bound CSRF token.
 */
export interface AuthenticatedSessionResult {
  status: 'authenticated';
  user: AuthenticatedUser;
  csrfToken?: string;
}

/**
 * A login attempt resolves to a session. (It was a session-or-challenge union
 * until authenticator-app sign-in was removed, owner ruling 2026-10-29, q305.)
 */
export type LoginResult = AuthenticatedSessionResult;

/**
 * What the recovery-address surface must know before it asks for anything
 * (Finding 9, Equoria-6p398.11).
 *
 * `pending` is the single live staged replacement, so a reloaded
 * surface can say a letter is waiting instead of pretending nothing happened.
 */
export interface EmailChangeStatus {
  /** The confirmed address — still the live recovery identity. */
  email: string;
  emailVerified: boolean;
  pending: {
    /**
     * MASKED (`j***@example.com`). The backend never reports a staged address
     * in full through this read, so this value is for recognition only — never
     * send to it, never compare it against an address the player typed.
     */
    maskedEmail: string;
    expiresAt: string;
    /** When the resend cooldown lapses, from the backend's own constant. */
    resendAvailableAt: string;
  } | null;
}

/** Fresh authentication for a recovery-address change. */
export interface EmailChangeRequestCredentials {
  email: string;
  password: string;
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

/** Raw `data` block the session-issuing login endpoint returns. */
interface RawAuthResponse {
  user?: AuthenticatedUser;
  csrfToken?: string;
}

/**
 * Equoria-f6wfa: login rotates the auth cookies. The
 * CSRF token cached during the request itself is bound to the ANONYMOUS
 * identifier and is stale the moment the new auth cookie applies. Seed the
 * freshly-bound token so the FIRST authenticated mutation sends a matching
 * token instead of 403-ing (invalidCsrfToken) and relying on the apiClient's
 * one-shot retry to recover.
 */
function finalizeAuthenticatedSession(raw: RawAuthResponse): AuthenticatedSessionResult {
  if (raw?.csrfToken) {
    authSessionState.csrfToken = raw.csrfToken;
  }
  return { status: 'authenticated', user: raw.user as AuthenticatedUser, csrfToken: raw.csrfToken };
}

/**
 * Read a session-issuing auth response. An unrecognised shape is an error, not
 * a silent success.
 */
function readAuthResponse(raw: RawAuthResponse, endpointLabel: string): LoginResult {
  if (raw?.user?.id) {
    return finalizeAuthenticatedSession(raw);
  }
  throw {
    message: `${endpointLabel} returned no session.`,
    status: 'error',
    statusCode: 500,
  };
}

export const authApi = {
  /**
   * Login user.
   *
   * Resolves to the authenticated session. Sets httpOnly cookies automatically.
   */
  login: async (credentials: { email: string; password: string }): Promise<LoginResult> => {
    const result = await apiClient.post<RawAuthResponse>('/api/v1/auth/login', credentials);
    return readAuthResponse(result, 'Login');
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
      /** Equoria-nqky1: false when the account was created but no session opened. */
      sessionIssued?: boolean;
    }>('/api/v1/auth/register', userData);
    // Equoria-f6wfa: registration rotates the auth cookies. The CSRF token
    // cached during the register POST itself is bound to the ANONYMOUS
    // identifier; the very next mutation (e.g. advance-onboarding during the
    // onboarding wizard) would send that stale token and 403
    // (invalidCsrfToken). Seed the freshly-bound token returned in the
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
        role?: 'user' | 'owner' | 'admin' | 'moderator';
        /** Equoria-voasj: false until the player follows the emailed link. */
        emailVerified?: boolean;
        completedOnboarding?: boolean;
        onboardingStep?: number;
        /** Equoria-kd2dd: whether the one-time welcome note has been shown. */
        welcomeSeen?: boolean;
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
    /** The stable's own name (Equoria-kgush); never renames the account. */
    stableName?: string;
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
        stableName?: string | null;
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
    return apiClient.patch<{ preferences: UserPreferences }>(
      '/api/v1/auth/profile/preferences',
      updates
    );
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
   * Record that the player has seen the one-time welcome note (Equoria-kd2dd).
   * Idempotent: the server sets User.settings.welcomeSeen and nothing else.
   */
  markWelcomeSeen: () => apiClient.post<{ welcomeSeen: boolean }>('/api/v1/auth/welcome-seen', {}),

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
   * Requires fresh authentication: the current password. Nothing moves yet — the
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
};
