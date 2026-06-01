/**
 * Shared validation middleware for groomRoutes.mjs sub-routers.
 *
 * Extracted from backend/modules/grooms/routes/groomRoutes.mjs as part of the
 * god-file split (refs Equoria-8mdpc, mirroring the Equoria-y8u2j horseRoutes
 * pattern). Originally inlined as a single `handleValidationErrors` const;
 * centralizing here so every groom sub-router (retirement, legacy, talents)
 * reuses one source of truth for the express-validator result handler.
 *
 * Behaviour MUST remain identical to the original inline definition — this is
 * a byte-compatible extraction, not a refactor.
 */

import { validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';

/**
 * Validation middleware for handling validation errors.
 * Returns 400 with the errors array if any express-validator rule failed.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};
