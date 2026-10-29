/**
 * gdprAccountController.mjs
 *
 * Controller for the authenticated account endpoint (Equoria-s3rf):
 *   - POST /api/v1/account/delete  → CLOSED (Equoria-gfany), see below
 *
 * GET /api/v1/account/export was removed by owner ruling 2026-10-28 (q157,
 * Equoria-a7f1p): players get no account data download.
 */

import logger from '../../../utils/logger.mjs';

/**
 * Refusal for every player-reachable account-deletion route —
 * `POST /api/v1/account/delete` and `DELETE /api/v1/users/:id`.
 *
 * OWNER RULING 2026-09-22 (Equoria-gfany): "Players cannot delete their
 * accounts." Scope ruled 2026-09-24: remove the Settings control and both
 * player-reachable routes. 2026-09-25 the owner went further — no account is
 * deleted at all, not on request and not by an operator — so the erasure
 * service is gone too (Equoria-81uop). Both routes answer with this one body, whatever the id,
 * password or payload, so neither can be used as an existence or ownership
 * oracle. It sits behind `authenticateToken` (anonymous is still 401).
 *
 * Locked by __tests__/accountDeletionClosed.integration.test.mjs, whose
 * matcher needs the words "cannot be deleted" — reword the message with it.
 */
export const refuseAccountDeletion = (req, res) => {
  logger.warn(
    `[gdprAccountController] Rejected account deletion by user ${req.user?.id} (Equoria-gfany)`,
  );
  return res.status(403).json({
    success: false,
    message: 'Accounts cannot be deleted.',
  });
};
