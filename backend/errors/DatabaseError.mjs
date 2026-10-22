import AppError from './AppError.mjs';

/**
 * Database Error Class
 * Used for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500);

    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export default DatabaseError;
