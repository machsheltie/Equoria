import { query } from 'express-validator';
import { handleValidationErrors } from './validationErrorHandler.mjs';

/**
 * Ping Validation Middleware
 * Validates query parameters for ping endpoint
 */
export const validatePing = [
  query('name')
    .optional()
    .isString()
    .withMessage('Name must be a string')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Name must be between 2 and 30 characters')
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage('Name can only contain letters, numbers, and spaces'),
  handleValidationErrors,
];
