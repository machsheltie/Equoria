/**
 * HTTP transport layer for the Equoria Frontend API client.
 *
 * Handles all HTTP requests with httpOnly cookie authentication.
 * Automatically includes credentials for cookie-based auth.
 *
 * Security: Uses httpOnly cookies to prevent XSS attacks (tokens not in localStorage)
 *
 * Features:
 * - Auto-retry on 401 with token refresh
 * - CSRF token injection + 403 retry for mutations
 * - Rate limiting (429) with Retry-After support
 * - Comprehensive error handling
 *
 * This module owns ONLY the transport core. Domain endpoint wrappers and
 * their response types live in `frontend/src/lib/api/<domain>.ts`. The
 * compatibility barrel `frontend/src/lib/api-client.ts` re-exports everything
 * here so existing import sites keep working unchanged.
 */

import authSessionState from '../authSessionState.js';
import type { ApiError, ApiResponse } from './types.js';

// Nullish coalescing: empty string = relative URLs (correct for monolithic deploy).
// Set VITE_API_URL only for split-deploy scenarios.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Single promise acts as deduplication lock — no separate boolean flag needed.
// All concurrent 401 callers await the same promise until it settles.
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the access token using the refresh token cookie
 */
export async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in flight, every caller shares the same promise.
  if (refreshPromise) {
    return refreshPromise;
  }

  // Create the refresh promise *before* any async work so concurrent callers
  // that arrive between now and the first await see it immediately.
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // New access token issued — invalidate cached CSRF so the next mutation
        // fetches a fresh token bound to the new session context.
        authSessionState.invalidate();
      } else {
        // Refresh rejected — session is dead; wipe all cached state.
        authSessionState.clear();
      }
      return response.ok;
    } catch {
      authSessionState.clear(); // Network error — treat as session dead
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    // Clear AFTER the promise settles so all concurrent awaiters resolve first.
    refreshPromise = null;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCsrfToken(): Promise<string> {
  if (authSessionState.csrfToken) return authSessionState.csrfToken;
  if (authSessionState.csrfFetching) return authSessionState.csrfFetching;

  authSessionState.csrfFetching = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/csrf-token`, {
        credentials: 'include',
      });
      const data = await res.json();
      authSessionState.csrfToken = data.csrfToken || '';
      return authSessionState.csrfToken;
    } catch {
      return '';
    } finally {
      authSessionState.csrfFetching = null;
    }
  })();

  return authSessionState.csrfFetching;
}

/**
 * Base fetch wrapper with cookie credentials
 * Features: Auto-retry on 401, Rate limiting (429) handling, CSRF token injection
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Story 21S-2 (finalized on master): CSRF test-skip-header branch removed from
  // production frontend code. The client always acquires a real CSRF token for
  // mutations, matching beta/production behavior. Playwright exercises the real
  // CSRF round trip end-to-end; Vitest unit tests mock api-client at the module
  // boundary so this path is not exercised during unit-test runs.
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method || 'GET').toUpperCase()
  );

  // Fetch CSRF token for all mutations — no test bypasses in production code
  const csrfHeader: Record<string, string> = {};
  if (isMutation) {
    const token = await getCsrfToken();
    if (token) csrfHeader['X-CSRF-Token'] = token;
  }

  const config: RequestInit = {
    ...options,
    cache: 'no-store', // Auth state changes must never be served from browser HTTP cache
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
      ...options.headers,
    },
    credentials: 'include', // CRITICAL: Send httpOnly cookies with request
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized - attempt token refresh once
    if (response.status === 401 && retryCount === 0) {
      // Don't retry refresh endpoint itself
      if (!endpoint.includes('/refresh')) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the original request
          return fetchWithAuth<T>(endpoint, options, retryCount + 1);
        }
      }
      // Refresh failed, throw 401 error
      throw {
        message: 'Session expired. Please log in again.',
        status: 'error',
        statusCode: 401,
      } as ApiError;
    }

    // Handle 403 CSRF error — refresh token and retry once
    if (response.status === 403 && retryCount === 0 && isMutation) {
      const body = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (body?.code === 'INVALID_CSRF_TOKEN') {
        authSessionState.invalidate();
        return fetchWithAuth<T>(endpoint, options, retryCount + 1);
      }
    }

    // Handle 429 Rate Limiting
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;

      throw {
        message: 'Too many requests. Please try again later.',
        status: 'error',
        statusCode: 429,
        retryAfter,
      } as ApiError;
    }

    // Handle other non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
        status: 'error',
        statusCode: response.status,
      }));

      throw {
        message: errorData.message || 'An error occurred',
        status: errorData.status || 'error',
        statusCode: response.status,
      } as ApiError;
    }

    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
    }

    const data: ApiResponse<T> = await response.json();

    // Return data property if it exists, otherwise return the whole response
    return (data.data !== undefined ? data.data : data) as T;
  } catch (error) {
    // Re-throw ApiError
    if ((error as ApiError).statusCode) {
      throw error;
    }

    // Network errors
    throw {
      message: error instanceof Error ? error.message : 'Network error',
      status: 'error',
      statusCode: 0,
    } as ApiError;
  }
}

/**
 * API Client methods — thin verb wrappers over `fetchWithAuth`.
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  },
};
