import AppError from './AppError.mjs';

/**
 * Database Error Class
 * Used for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    // Not operational: callers interpolate raw driver text into the message
    // (e.g. `Lookup failed: ${error.message}`), so the global error handler
    // must not send it to the client (Equoria-ot1mo).
    super(message, 500, false);

    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export default DatabaseError;
