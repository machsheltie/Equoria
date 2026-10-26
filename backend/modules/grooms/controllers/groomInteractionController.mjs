/**
 * Groom Interaction Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: getGroomHorseSynergyPreview. Grooming itself ("groom horse") is
 * groomCareController / groomCareService; recordInteraction was retired.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getTemperamentGroomSynergy } from '../../horses/index.mjs';

/**
 * GET /api/grooms/:groomId/horses/:horseId/synergy
 * 31D-4 (Equoria-ictn): preview temperament-groom synergy for a groom/horse pair.
 * Returns the synergyModifier (e.g. 0.25 = +25%) along with the underlying
 * temperament + personality so the UI can render a chip BEFORE assigning.
 */
export async function getGroomHorseSynergyPreview(req, res) {
  try {
    const groomId = parseInt(req.params.groomId, 10);
    const horseId = parseInt(req.params.horseId, 10);

    if (Number.isNaN(groomId) || groomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'groomId must be a positive integer',
      });
    }
    if (Number.isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'horseId must be a positive integer',
      });
    }

    const [groom, horse] = await Promise.all([
      prisma.groom.findUnique({
        where: { id: groomId },
        select: { id: true, name: true, personality: true },
      }),
      prisma.horse.findUnique({
        where: { id: horseId },
        select: { id: true, name: true, temperament: true },
      }),
    ]);

    if (!groom) {
      return res.status(404).json({ success: false, message: 'Groom not found' });
    }
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    const synergyModifier = getTemperamentGroomSynergy(horse.temperament, groom.personality);
    const percent = `${synergyModifier >= 0 ? '+' : ''}${Math.round(synergyModifier * 100)}%`;
    const message =
      synergyModifier === 0
        ? 'No synergy'
        : `${percent} bonding (${horse.temperament || 'Unknown'} x ${groom.personality || 'Unknown'})`;

    return res.status(200).json({
      success: true,
      data: {
        synergyModifier,
        temperament: horse.temperament || null,
        personality: groom.personality || null,
        message,
      },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomHorseSynergyPreview] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute synergy preview',
    });
  }
}
