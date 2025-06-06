import { validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';

/**
 * Validation Error Handler Middleware
 * Processes express-validator validation results
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();

    logger.warn('Validation errors occurred', {
      url: req.originalUrl,
      method: req.method,
      errors: errorArray,
    });

    return res.status(400).json({
      success: false,
      message: errorArray[0].msg, // Use the first error message
      errors: errorArray,
    });
  }

  next();
}
