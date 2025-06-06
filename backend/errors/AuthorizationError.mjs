/**
 * Authorization Error Class
 *
 * Custom error class for authorization-related errors.
 * Used when a user attempts to access resources they don't have permission for.
 */

import AppError from './AppError.mjs';

class AuthorizationError extends AppError {
  constructor(message = 'Authorization failed') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export default AuthorizationError;
