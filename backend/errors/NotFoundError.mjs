import AppError from './AppError.mjs';

/**
 * Not Found Error Class
 * Used when requested resources are not found
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;

    super(message, 404);

    this.name = 'NotFoundError';
    this.resource = resource;
    this.resourceId = id;
  }
}

export default NotFoundError;
