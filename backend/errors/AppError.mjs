/**
 * Custom Application Error Class
 * Provides structured error handling with proper HTTP status codes.
 *
 * `instanceof AppError` is FRAGILE across module-cache duplication: if the
 * AppError module is loaded via two different paths (e.g., once by
 * production code and once via `jest.unstable_mockModule(...)`), the two
 * class references are distinct objects and `instanceof` returns false
 * for an instance from the "other" copy — silently corrupting any
 * defense that branches on it (the silent-catch fix in
 * `backend/middleware/requestBodySecurity.mjs` is one such defense; a
 * mock-module test that imports a different errors path would cause
 * legitimate AppError throws from the scanner to be wrapped as
 * "scanner failure" instead of propagating cleanly).
 *
 * Fix: tag every instance with a registry symbol (`Symbol.for(...)`).
 * The global symbol registry shares the symbol across module-cache
 * duplicates, so `instance[APP_ERROR_MARKER] === true` works regardless
 * of which copy of this module created the instance. Use the static
 * `AppError.isAppError(value)` helper for new check sites; existing
 * `instanceof AppError` call sites continue to work for the common case.
 *
 * Filed via review of 21R-SEC-3-FOLLOW-1 (Equoria-ixqg).
 */

// Symbol.for(...) — shared via the global registry, survives module
// duplication. Exported so test code can manually tag instances if
// asserting on the marker directly.
export const APP_ERROR_MARKER = Symbol.for('Equoria.AppError');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;

    // Tag the instance with the registry symbol so isAppError() works
    // even if a different copy of this module created the instance.
    this[APP_ERROR_MARKER] = true;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Cross-module-cache-safe replacement for `error instanceof AppError`.
   * Returns true for any value tagged with APP_ERROR_MARKER, regardless
   * of which AppError class reference produced it. Use this in security
   * boundaries where module-mock tests can otherwise silently corrupt
   * the instanceof check.
   */
  static isAppError(value) {
    return value !== null && typeof value === 'object' && value[APP_ERROR_MARKER] === true;
  }
}

export default AppError;
