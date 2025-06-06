/**
 * Standardized API Response Utility
 * Ensures consistent response format across all endpoints
 */

export class ApiResponse {
  constructor(success, message, data = null, meta = null) {
    this.success = success;
    this.message = message;
    if (data !== null) {
      this.data = data;
    }
    if (meta !== null) {
      this.meta = meta;
    }
    this.timestamp = new Date().toISOString();
  }

  static success(message, data = null, meta = null) {
    return new ApiResponse(true, message, data, meta);
  }

  static error(message, data = null, meta = null) {
    return new ApiResponse(false, message, data, meta);
  }

  static created(message, data = null, meta = null) {
    return new ApiResponse(true, message, data, { ...meta, statusCode: 201 });
  }

  static notFound(message = 'Resource not found', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 404 });
  }

  static badRequest(message = 'Bad request', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 400 });
  }

  static unauthorized(message = 'Unauthorized', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 401 });
  }

  static forbidden(message = 'Forbidden', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 403 });
  }

  static conflict(message = 'Resource conflict', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 409 });
  }

  static validationError(message = 'Validation failed', errors = []) {
    return new ApiResponse(false, message, null, {
      statusCode: 400,
      validationErrors: errors,
    });
  }

  static serverError(message = 'Internal server error', data = null) {
    return new ApiResponse(false, message, data, { statusCode: 500 });
  }

  // Pagination helper
  static paginated(message, data, pagination) {
    const meta = {
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1,
      },
    };
    return new ApiResponse(true, message, data, meta);
  }
}

/**
 * Express middleware to send standardized responses
 */
export const responseHandler = (req, res, next) => {
  // Add helper methods to response object
  res.apiSuccess = (message, data = null, meta = null) => {
    const response = ApiResponse.success(message, data, meta);
    return res.status(200).json(response);
  };

  res.apiError = (message, statusCode = 500, data = null) => {
    const response = ApiResponse.error(message, data, { statusCode });
    return res.status(statusCode).json(response);
  };

  res.apiCreated = (message, data = null, meta = null) => {
    const response = ApiResponse.created(message, data, meta);
    return res.status(201).json(response);
  };

  res.apiNotFound = (message = 'Resource not found', data = null) => {
    const response = ApiResponse.notFound(message, data);
    return res.status(404).json(response);
  };

  res.apiBadRequest = (message = 'Bad request', data = null) => {
    const response = ApiResponse.badRequest(message, data);
    return res.status(400).json(response);
  };

  res.apiUnauthorized = (message = 'Unauthorized', data = null) => {
    const response = ApiResponse.unauthorized(message, data);
    return res.status(401).json(response);
  };

  res.apiForbidden = (message = 'Forbidden', data = null) => {
    const response = ApiResponse.forbidden(message, data);
    return res.status(403).json(response);
  };

  res.apiConflict = (message = 'Resource conflict', data = null) => {
    const response = ApiResponse.conflict(message, data);
    return res.status(409).json(response);
  };

  res.apiValidationError = (message = 'Validation failed', errors = []) => {
    const response = ApiResponse.validationError(message, errors);
    return res.status(400).json(response);
  };

  res.apiPaginated = (message, data, pagination) => {
    const response = ApiResponse.paginated(message, data, pagination);
    return res.status(200).json(response);
  };

  next();
};

export default ApiResponse;
