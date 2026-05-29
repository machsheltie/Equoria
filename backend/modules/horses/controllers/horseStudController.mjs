/**
 * Horse Stud Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns stud-listing endpoints (Equoria-q072).
 * No behavior changes — functions moved verbatim.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * List a stallion at stud (Equoria-q072).
 * POST /api/v1/horses/:id/stud-listing
 * Body: { studFee: number (non-negative integer) }
 */
export async function listHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.listHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    if (req.horse.sex !== 'Stallion') {
      return res.status(400).json({
        success: false,
        message: 'Only stallions can be listed at stud',
      });
    }

    const studFee = Number(req.body?.studFee);
    if (!Number.isFinite(studFee) || !Number.isInteger(studFee) || studFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'studFee must be a non-negative integer',
      });
    }

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { studStatus: 'At Public Stud', studFee },
      select: { id: true, name: true, sex: true, studStatus: true, studFee: true },
    });

    logger.info(
      `[horseController.listHorseAtStud] horse ${updated.id} listed at stud for fee ${studFee}`,
    );

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} listed at stud`,
      data: updated,
    });
  } catch (error) {
    logger.error(
      `[horseController.listHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to list horse at stud' });
  }
}

/**
 * Unlist a stallion from stud (Equoria-q072).
 * DELETE /api/v1/horses/:id/stud-listing
 */
export async function unlistHorseAtStud(req, res) {
  try {
    if (!req.horse) {
      logger.error(
        '[horseController.unlistHorseAtStud] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { studStatus: 'Not at Stud', studFee: 0 },
      select: { id: true, name: true, sex: true, studStatus: true, studFee: true },
    });

    logger.info(`[horseController.unlistHorseAtStud] horse ${updated.id} unlisted from stud`);

    return res.status(200).json({
      success: true,
      message: `Horse ${updated.name} unlisted from stud`,
      data: updated,
    });
  } catch (error) {
    logger.error(
      `[horseController.unlistHorseAtStud] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({ success: false, message: 'Failed to unlist horse from stud' });
  }
}
