/**
 * Error Classes Export
 * Centralized export for all custom error classes
 */

import AppError from './AppError.mjs';
import ValidationError from './ValidationError.mjs';
import DatabaseError from './DatabaseError.mjs';
import NotFoundError from './NotFoundError.mjs';
import AuthorizationError from './AuthorizationError.mjs';
// Equoria-oey96.8: shared roster-cap error thrown by rider + trainer hire paths.
import { RosterCapExceededError } from './RosterCapExceededError.mjs';
// Equoria-bvddn.19: shared stale-marketplace-offer error thrown by groom + rider +
// trainer hire paths.
import { StaleOfferError } from './StaleOfferError.mjs';

export {
  AppError,
  ValidationError,
  DatabaseError,
  NotFoundError,
  AuthorizationError,
  RosterCapExceededError,
  StaleOfferError,
};
