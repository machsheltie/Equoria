/**
 * gdprAccountController.mjs
 *
 * Controllers for the authenticated, self-only GDPR account endpoints
 * (Equoria-s3rf):
 *   - GET  /api/v1/account/export  → Right to Access / Portability
 *   - POST /api/v1/account/delete  → CLOSED (Equoria-gfany), see below
 *
 * The export operates exclusively on `req.user.id` (set by
 * authenticateToken). There is no user-id path/query/body parameter, so
 * cross-user access is structurally impossible — a token can only ever
 * export its own account.
 */

import logger from '../../../utils/logger.mjs';
import { buildUserDataExport } from '../services/gdprAccountService.mjs';

/**
 * GET /api/v1/account/export
 * Returns the authenticated user's complete personal data as JSON.
 */
export const exportAccountData = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const data = await buildUserDataExport(req.user.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`[gdprAccountController] Data export generated for user ${req.user.id}`);

    // Encourage clients to treat this as a downloadable artifact.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="equoria-data-export-${req.user.id}.json"`,
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error(`[gdprAccountController.exportAccountData] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate data export' });
  }
};

/**
 * Refusal for every player-reachable account-deletion route —
 * `POST /api/v1/account/delete` and `DELETE /api/v1/users/:id`.
 *
 * OWNER RULING 2026-09-22 (Equoria-gfany): "Players cannot delete their
 * accounts." Scope ruled 2026-09-24: remove the Settings control and both
 * player-reachable routes; keep `eraseUserAccount()` for erasure an operator
 * runs by hand. Both routes answer with this one body, whatever the id,
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
