/**
 * Shared request validators for two-parent breeding endpoints (Equoria-1aoqa).
 *
 * CONTRIBUTING.md: breeding or two-parent operations reject the same horse as
 * both parents before database work. The mare-id validator carries that check,
 * so it runs in the validation chain (a 400 from validateRequest) before any
 * handler looks a horse up, and every endpoint uses the one definition.
 */

import { body, param } from 'express-validator';

export const selfCrossMessage = 'Stallion and mare cannot be the same horse';

/** Throws when the mare id names the same horse as the request's stallion id. */
function differsFromStallion(value, { req }) {
  const stallionId = req.body?.stallionId ?? req.params?.stallionId;
  if (Number(value) === Number(stallionId)) {
    throw new Error(selfCrossMessage);
  }
  return true;
}

/** `mareId` in the JSON body: a positive integer that is not the stallion. */
export const mareIdInBody = () =>
  body('mareId')
    .isInt({ min: 1 })
    .withMessage('Valid mare ID is required')
    .bail()
    .custom(differsFromStallion);

/** `:mareId` route parameter: a positive integer that is not `:stallionId`. */
export const mareIdInParams = () =>
  param('mareId')
    .isInt({ min: 1 })
    .withMessage('Valid mare ID is required')
    .bail()
    .custom(differsFromStallion);
