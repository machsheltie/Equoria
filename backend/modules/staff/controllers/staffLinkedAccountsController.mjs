/**
 * Linked accounts and busy addresses (Equoria-x5n89, owner rulings q123-q126).
 * Both routes run behind requireStaffCapability('accounts.linked.view'), which
 * only the Owner and Admins hold.
 *
 * Equoria-puj1e.4 (owner ruling q102): a player's sign-in history and the
 * accounts seen on the same addresses, behind requireStaffCapability('view.identity'),
 * also the Owner and Admins only.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  accountsSharingAddress,
  accountsSharingDevice,
  flaggedAddresses,
  loginHistory,
} from '../services/linkedAccountsService.mjs';

const maxText = 100;
const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

/** The player named by :userId, or null for an unknown or malformed id. */
const findPlayer = userId =>
  typeof userId === 'string' && userId.length > 0 && userId.length <= maxText
    ? prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, role: true },
      })
    : null;

/** GET /api/v1/staff/conduct/:userId/linked-accounts */
export async function getLinkedAccounts(req, res, next) {
  try {
    const player = await findPlayer(req.params.userId);
    if (!player) {
      return fail(res, 404, 'No such player', 'conductTargetNotFound');
    }
    return res.status(200).json({ player, accounts: await accountsSharingDevice(player.id) });
  } catch (error) {
    logger.error(`[staff] linked accounts failed: ${error.message}`);
    return next(error);
  }
}

/** GET /api/v1/staff/conduct/:userId/login-history */
export async function getLoginHistory(req, res, next) {
  try {
    const player = await findPlayer(req.params.userId);
    if (!player) {
      return fail(res, 404, 'No such player', 'conductTargetNotFound');
    }
    const [sightings, sameAddress] = await Promise.all([
      loginHistory(player.id),
      accountsSharingAddress(player.id),
    ]);
    return res.status(200).json({ player, sightings, sameAddress });
  } catch (error) {
    logger.error(`[staff] login history failed: ${error.message}`);
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
