/**
 * gdprAccountController.mjs
 *
 * Controllers for the authenticated, self-only GDPR account endpoints
 * (Equoria-s3rf):
 *   - GET  /api/v1/account/export  → Right to Access / Portability
 *   - POST /api/v1/account/delete  → Right to Erasure
 *
 * Both operate exclusively on `req.user.id` (set by authenticateToken).
 * There is no user-id path/query/body parameter, so cross-user access is
 * structurally impossible — a token can only ever export or erase its own
 * account. Fail-closed: any unexpected error returns a non-2xx and never
 * leaks another user's data or performs a partial delete (the erase runs
 * in a single transaction).
 */

import logger from '../../../utils/logger.mjs';
import {
  buildUserDataExport,
  verifyAccountPassword,
  eraseUserAccount,
} from '../services/gdprAccountService.mjs';

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
 * POST /api/v1/account/delete
 * Permanently erases the authenticated user's account. Requires the
 * account password in the request body as a destructive-action
 * confirmation.
 */
export const deleteAccount = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { password } = req.body ?? {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation is required to delete your account',
      });
    }

    const verification = await verifyAccountPassword(req.user.id, password);
    if (!verification.ok) {
      if (verification.reason === 'not_found') {
        // Account already gone (idempotent path).
        return res.status(404).json({ success: false, message: 'Account not found' });
      }
      // missing_password / bad_password
      logger.warn(
        `[gdprAccountController] Failed delete confirmation for user ${req.user.id} (${verification.reason})`,
      );
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    const result = await eraseUserAccount(req.user.id);
    if (!result.deleted) {
      // Race: deleted between verify and erase. Idempotent-safe.
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    logger.info(`[gdprAccountController] Account ${req.user.id} erased (GDPR right-to-erasure)`);
    return res.status(200).json({
      success: true,
      message: 'Your account and associated personal data have been permanently deleted.',
    });
  } catch (error) {
    logger.error(`[gdprAccountController.deleteAccount] Error: ${error.message}`);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to delete account. No data was removed.' });
  }
};
