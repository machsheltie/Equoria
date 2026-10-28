/**
 * Groom Roster Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: getUserGrooms, getGroomProfile. (getGroomDefinitions went with
 * GET /grooms/definitions, owner ruling 2026-10-28, q151, Equoria-a7f1p.)
 *
 * Equoria-bvddn.7: the player-built hire (POST /grooms/hire, client-chosen
 * name, skill and experience) is gone. Players never create grooms (owner,
 * 2026-10-21); they hire the game's grooms through /groom-marketplace/hire.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
// Equoria-fby1t (owner, 2026-09-14): the player may SEE a groom's age —
// `groomAgeYears` turns the stored `startAge` + `careerWeeks` into the one
// number a player reads.
import { groomAgeYears } from '../services/groomAgeService.mjs';

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
  return { ...rest, ageYears: groomAgeYears(groom) };
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
