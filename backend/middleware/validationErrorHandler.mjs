import { validationResult, matchedData } from 'express-validator';
import logger from '../utils/logger.mjs';

/**
 * Validation Error Handler Middleware
 * Processes express-validator validation results and prevents parameter pollution
 *
 * SECURITY: CWE-20 (Improper Input Validation)
 */
export function handleValidationErrors(req, res, next) {
  const getValidationResult = req.validationResult || validationResult;
  const errors = getValidationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();

    logger.warn('[Validation] Input validation failed', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      errors: errorArray.map(e => ({ field: e.path, message: e.msg })),
    });

    // Don't expose internal validation details in production (CWE-209)
    const safeErrors = process.env.NODE_ENV === 'production'
      ? [{ message: errorArray[0].msg }]
      : errorArray;

    return res.status(400).json({
      success: false,
      message: errorArray[0].msg,
      errors: safeErrors,
    });
  }

  next();
}

/**
 * Sanitize Request Data Middleware
 * Replaces req.body/query/params with only validated fields
 * Prevents parameter pollution and injection attacks
 *
 * SECURITY: CWE-20, CWE-79 (XSS Prevention)
 */
export function sanitizeRequestData(req, res, next) {
  const getValidationResult = req.validationResult || validationResult;
  const errors = getValidationResult(req);
  const getMatchedData = req.matchedData || matchedData;

  // Only sanitize if validation passed
  if (errors.isEmpty()) {
    // Get only validated and sanitized data
    const sanitized = getMatchedData(req, { includeOptionals: true });

    // Replace request data with sanitized versions
    // This prevents parameter pollution attacks
    if (Object.keys(sanitized).length > 0) {
      // Separate sanitized data by source
      const bodyData = {};
      const queryData = {};
      const paramData = {};

      for (const [key, value] of Object.entries(sanitized)) {
        if (req.body && key in req.body) { bodyData[key] = value; }
        if (req.query && key in req.query) { queryData[key] = value; }
        if (req.params && key in req.params) { paramData[key] = value; }
      }

      // Replace with sanitized data only
      if (Object.keys(bodyData).length > 0) { req.body = bodyData; }
      if (Object.keys(queryData).length > 0) { req.query = queryData; }
      if (Object.keys(paramData).length > 0) { req.params = paramData; }

      logger.debug('[Sanitization] Request data sanitized', {
        url: req.originalUrl,
        fieldsCount: Object.keys(sanitized).length,
      });
    }
  }

  next();
}
