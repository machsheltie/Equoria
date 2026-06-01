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
