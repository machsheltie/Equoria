/**
 * Linked accounts and busy addresses (Equoria-x5n89, owner rulings q123-q126).
 * Both routes run behind requireStaffCapability('accounts.linked.view'), which
 * only the Owner and Admins hold.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { accountsSharingDevice, flaggedAddresses } from '../services/linkedAccountsService.mjs';

const maxText = 100;
const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

/** GET /api/v1/staff/conduct/:userId/linked-accounts */
export async function getLinkedAccounts(req, res, next) {
  try {
    const { userId } = req.params;
    const player =
      typeof userId === 'string' && userId.length > 0 && userId.length <= maxText
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, role: true },
          })
        : null;
    if (!player) {
      return fail(res, 404, 'No such player', 'conductTargetNotFound');
    }
    return res.status(200).json({ player, accounts: await accountsSharingDevice(player.id) });
  } catch (error) {
    logger.error(`[staff] linked accounts failed: ${error.message}`);
    return next(error);
  }
}

/** GET /api/v1/staff/flagged-addresses */
export async function getFlaggedAddresses(req, res, next) {
  try {
    return res.status(200).json({ addresses: await flaggedAddresses() });
  } catch (error) {
    logger.error(`[staff] flagged addresses failed: ${error.message}`);
    return next(error);
  }
}
