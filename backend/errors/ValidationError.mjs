import AppError from './AppError.mjs';

/**
 * Validation Error Class
 * Used for input validation failures
 */
class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 400);

    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export default ValidationError;
