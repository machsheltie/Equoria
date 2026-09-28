/**
 * HTTP transport types for the Equoria API client.
 *
 * These describe the wire-level error and envelope shapes used by the
 * transport layer (`./apiClient`). They are intentionally separate from
 * domain response types, which live with their domain clients.
 */

/** Canonical error shape thrown by the transport on any non-2xx / network failure. */
export interface ApiError {
  message: string;
  status: string;
  statusCode: number;
  retryAfter?: number; // Seconds to wait before retrying (for 429)
  /**
   * True only on the 401 the transport throws after the refresh-token attempt
   * FAILED — the session is dead, not merely an expired access token
   * (Equoria-bvddn.29). A 401 that survives a successful refresh, or a 401 from
   * a pre-session endpoint (login, MFA challenge), never carries this flag.
   */
  sessionExpired?: boolean;
}

/**
 * Canonical success envelope returned by the backend.
 *
 * The canonical envelope is `{ success: true, message, data }`. The legacy
 * `{ status: 'success', ... }` shape was retired from authController in
 * Equoria-1i70; both are kept optional here for backward-compat while any
 * straggling endpoints get migrated.
 */
export interface ApiResponse<T> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
}
