/**
 * Groom Roster Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: getUserGrooms, getGroomProfile, getGroomRosterLimit, releaseGroom. (getGroomDefinitions went with
 * GET /grooms/definitions, owner ruling 2026-10-28, q151, Equoria-a7f1p.)
 *
 * Equoria-bvddn.7: the player-built hire (POST /grooms/hire, client-chosen
 * name, skill and experience) is gone. Players never create grooms (owner,
 * 2026-10-21); they hire the game's grooms through /groom-marketplace/hire.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
// Equoria-fby1t (owner, 2026-09-14): the player may SEE a groom's age —
// `groomAgeYears` turns the stored `startAge` + `careerWeeks` into the one
// number a player reads.
import { groomAgeYears } from '../services/groomAgeService.mjs';
import { staffLabels } from '../../../utils/staffPublicView.mjs';
import {
  ensureGrowthProfileTx,
  revealedGrowthView,
} from '../../../services/staffGrowthService.mjs';
import { ENGAGEMENT_END_REASONS, releaseGroomTx } from '../services/groomEngagementService.mjs';
import { MAX_GROOMS_PER_USER } from '../../../config/groomConfig.mjs';

const GROOM_LIST_SELECT = {
  id: true,
  name: true,
  // Equoria-fby1t: selected so the age can be COMPUTED; both are stripped from the
  // response by `withAgeYears` below, because a player reads an age in years, not
  // two counters to add up (Equoria-maeba retired the career-weeks reading).
  startAge: true,
  careerWeeks: true,
  speciality: true,
  experience: true,
  skillLevel: true,
  // Owner ruling 2026-10-28 (q229): the roster shows the groom's stars; the old 1-10
  // level is gone.
  starLevel: true,
  personality: true,
  sessionRate: true,
  isActive: true,
  imageUrl: true,
  userId: true,
};

/**
 * Replace the two stored counters with the one number the player reads.
 *
 * Equoria-fby1t: the age is NOT the secret field — the RETIREMENT age is, and it
 * lives in its own table so no groom read can return it (Equoria-m9lz1, I3). This
 * one is a character attribute like `personality`. `null` means the age is not yet
 * known (a groom predating Equoria-ypb7d whose first weekly pass has not run); the
 * surface shows an em dash rather than pretending they are newborn.
 */
function withAgeYears(groom) {
  const { startAge: _startAge, careerWeeks: _careerWeeks, ...rest } = groom;
  return { ...rest, ageYears: groomAgeYears(groom), ...staffLabels('groom', groom) };
}

/**
 * GET /api/grooms/user/:userId
 * Get all grooms for a user
 */
export async function getUserGrooms(req, res) {
  try {
    const { userId } = req.params;
    const { limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });

    logger.info(`[groomController.getUserGrooms] Getting grooms for user ${userId}`);

    const where = { userId };
    const [grooms, totalGrooms] = await Promise.all([
      prisma.groom.findMany({
        where,
        select: {
          ...GROOM_LIST_SELECT,
          groomAssignments: {
            where: { isActive: true },
            select: { id: true, foal: { select: { id: true, name: true } } },
          },
          _count: {
            select: {
              groomAssignments: true,
              groomInteractions: true,
            },
          },
        },
        orderBy: [{ isActive: 'desc' }, { skillLevel: 'desc' }, { experience: 'desc' }],
        take: limit,
        skip,
      }),
      prisma.groom.count({ where }),
    ]);

    // Equoria-fby1t: every groom's identity carries their age.
    const groomsWithAge = grooms.map(withAgeYears);

    res.status(200).json({
      success: true,
      message: `Retrieved ${grooms.length} grooms for user`,
      userId,
      grooms: groomsWithAge,
      activeGrooms: groomsWithAge.filter(g => g.isActive),
      totalGrooms,
      pagination: { total: totalGrooms, limit, offset: skip, hasMore: skip + limit < totalGrooms },
    });
  } catch (error) {
    logger.error(`[groomController.getUserGrooms] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user grooms',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * Get groom profile including personality information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGroomProfile(req, res) {
  try {
    const { id } = req.params;
    const groomId = parseInt(id, 10);

    if (isNaN(groomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
      });
    }

    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomAssignments: {
          where: { isActive: true },
          include: {
            foal: {
              select: {
                id: true,
                name: true,
                temperament: true,
                bondScore: true,
              },
            },
          },
        },
      },
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
      });
    }

    // Calculate personality compatibility with current assignments
    const { calculatePersonalityCompatibility } =
      await import('../../../utils/groomPersonalityTraitBonus.mjs');
    const personalityCompatibility = groom.groomAssignments
      .map(assignment => {
        if (assignment.foal.temperament) {
          const compatibility = calculatePersonalityCompatibility(
            groom.personality,
            assignment.foal.temperament,
            assignment.foal.bondScore,
          );

          // Owner ruling 2026-10-28 (q164, Equoria-2wdp8): the player learns
          // whether the pairing suits, never the table, modifiers or bond
          // threshold behind it.
          return {
            foalId: assignment.foal.id,
            foalName: assignment.foal.name,
            foalTemperament: assignment.foal.temperament,
            suitsFoal: compatibility.isMatch,
          };
        }
        return null;
      })
      .filter(Boolean);

    const profile = {
      id: groom.id,
      name: groom.name,
      speciality: groom.speciality,
      experience: groom.experience,
      skillLevel: groom.skillLevel,
      personality: groom.personality,
      // Equoria-fby1t: the groom's age, in the same breath as the rest of who they
      // are. Not the hidden retirement age, which is absent from this read by
      // construction — `findUnique` does not `include` the schedule relation.
      ageYears: groomAgeYears(groom),
      sessionRate: groom.sessionRate,
      bio: groom.bio,
      imageUrl: groom.imageUrl,
      isActive: groom.isActive,
      hiredDate: groom.hiredDate,
      availability: groom.availability,
      currentAssignments: groom.groomAssignments.length,
      personalityCompatibility,
      // Equoria-no441: authored words beside the stored values.
      ...staffLabels('groom', groom),
      // Owner rulings 2026-10-28 (q160, Equoria-xlw03): the groom's level, personality
      // and only the hidden items its level has revealed. A groom made before growth
      // existed gets its profile now, revealed to match its level.
      growth: await (async () => {
        await withRetryableTxMapping(
          prisma.$transaction(tx => ensureGrowthProfileTx(tx, 'groom', groom.id)),
          { message: 'Grooms are busy right now, please retry in a moment.' },
        );
        return revealedGrowthView(prisma, 'groom', groom);
      })(),
    };

    logger.info(`[groomController.getGroomProfile] Retrieved profile for groom ${groomId}`);

    res.json({
      success: true,
      groom: profile,
    });
  } catch (error) {
    logger.error(`[groomController.getGroomProfile] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve groom profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/v1/grooms/roster-cap
 * How many grooms the player may hold and how many working grooms they have: the same
 * cap and count the hire paths enforce (retired grooms do not count). The groom page
 * shows the Release button when the roster is full (owner ruling 2026-10-29, q285).
 */
export async function getGroomRosterLimit(req, res) {
  try {
    const activeGrooms = await prisma.groom.count({
      where: { userId: req.user.id, retired: false },
    });
    res.status(200).json({
      success: true,
      message: 'Groom roster limit retrieved',
      data: { rosterCap: MAX_GROOMS_PER_USER, activeGrooms },
    });
  } catch (error) {
    logger.error(`[groomController.getGroomRosterLimit] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get the groom limit', data: null });
  }
}

/**
 * POST /api/v1/grooms/:id/release
 *
 * Owner ruling 2026-10-29 (q285, Equoria-hwboq): the player releases one of their
 * grooms with one click, with no confirmation page and no receipt. The groom goes back
 * to the grooms-for-hire pool like every other leaver: at its current level with its
 * reveals intact (q177), its open engagement closed and its active assignments ended
 * (releaseGroomTx). Only a working groom on the caller's own staff can be released;
 * anything else is 404, so another stable's groom is never confirmed to exist.
 */
export async function releaseGroom(req, res) {
  const userId = req.user.id;
  const groomId = Number.parseInt(req.params.id, 10);
  try {
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const groom = await tx.groom.findFirst({
          where: { id: groomId, userId, retired: false },
          select: { id: true },
        });
        if (!groom) {
          const notFound = new Error('Groom not found');
          notFound.status = 404;
          throw notFound;
        }
        await releaseGroomTx(tx, {
          groomId,
          userId,
          reason: ENGAGEMENT_END_REASONS.RELEASED,
          notify: false,
        });
      }),
      { message: 'Grooms are busy right now, please retry in a moment.' },
    );
    logger.info(`[groomController.releaseGroom] Groom ${groomId} released by user ${userId}`);
    res.status(200).json({ success: true, message: 'Groom released', data: { groomId } });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[groomController.releaseGroom] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to release groom', data: null });
  }
}
