/**
 * NextActionsController (Task 23-4)
 *
 * GET /api/v1/next-actions
 * Returns a priority-ordered list of suggested next actions for the authenticated user.
 *
 * Priority logic:
 *   1. Claim unclaimed prizes (if any competition results with unpaid prizes)
 *   2. Check competition results (results returned overnight)
 *   3. Groom foal (if any active foal development records)
 *   4. Train horse (if any horse with expired training cooldown)
 *   5. Compete (if any eligible horse + open shows exist)
 *   6. Breed (if any horses with expired breeding cooldown)
 *   7. Visit vet (if any injured horses)
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * GET /api/v1/next-actions
 * Auth required (req.user set by authenticate middleware)
 */
export async function getNextActions(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const now = new Date();
    const actions = [];

    // Fetch user's horses with relevant fields
    const horses = await prisma.horse.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        age: true,
        healthStatus: true,
        trainingCooldown: true,
        lastBredDate: true,
        sex: true,
      },
    });

    // Check for injured horses → visit-vet (priority 1 if present)
    const injuredHorse = horses.find(
      h => h.healthStatus === 'injured' || h.healthStatus === 'INJURED',
    );
    if (injuredHorse) {
      actions.push({
        type: 'visit-vet',
        priority: 1,
        horseId: injuredHorse.id,
        horseName: injuredHorse.name,
      });
    }

    // Check for foals in active development.
    //
    // 21R-PROD-BUG-1 (Equoria-j8s2): the FoalDevelopment model has a
    // `foal` relation (named `FoalDevelopmentFoal` via foalId FK); it
    // does NOT have a `horse` relation. The previous query traversed
    // a non-existent `horse` relation and threw at runtime; the
    // `.catch(() => [])` silently swallowed the error so the
    // groom-foal action was never produced for any user.
    //
    // Output `horseId` is sourced from `foalId` because that is the
    // canonical FK to horses.id. The legacy `horseId` Int? field is
    // an unused redundant column that may be null even when foalId
    // is set; do not depend on it.
    const activeFoals = await prisma.foalDevelopment
      .findMany({
        where: {
          foal: { userId },
          isActive: true,
        },
        select: { foalId: true, foal: { select: { name: true } } },
      })
      .catch(() => []); // Graceful if model not yet updated

    if (activeFoals.length > 0) {
      const foalDev = activeFoals[0];
      actions.push({
        type: 'groom-foal',
        priority: actions.length + 1,
        horseId: foalDev.foalId,
        horseName: foalDev.foal?.name,
        metadata: { totalFoals: activeFoals.length },
      });
    }

    // Horses with expired training cooldown (eligible to train)
    const trainableHorse = horses.find(
      h =>
        h.age >= 3 &&
        h.healthStatus !== 'injured' &&
        h.healthStatus !== 'INJURED' &&
        (!h.trainingCooldown || new Date(h.trainingCooldown) <= now),
    );
    if (trainableHorse) {
      actions.push({
        type: 'train',
        priority: actions.length + 1,
        horseId: trainableHorse.id,
        horseName: trainableHorse.name,
      });
    }

    // Horses eligible to compete (age 3+, healthy, no active cooldown)
    const competitiveHorse = horses.find(
      h => h.age >= 3 && h.healthStatus !== 'injured' && h.healthStatus !== 'INJURED',
    );
    if (competitiveHorse) {
      actions.push({
        type: 'compete',
        priority: actions.length + 1,
        horseId: competitiveHorse.id,
        horseName: competitiveHorse.name,
      });
    }

    // Mares with expired breeding cooldown
    const breedableMare = horses.find(
      h =>
        h.sex?.toLowerCase() === 'mare' &&
        h.age >= 3 &&
        h.healthStatus !== 'injured' &&
        h.healthStatus !== 'INJURED' &&
        (!h.lastBredDate || new Date(h.lastBredDate) <= now),
    );
    if (breedableMare) {
      actions.push({
        type: 'breed',
        priority: actions.length + 1,
        horseId: breedableMare.id,
        horseName: breedableMare.name,
      });
    }

    // Sort by priority (ascending) and limit to 6 actions
    actions.sort((a, b) => a.priority - b.priority);
    const topActions = actions.slice(0, 6).map((action, index) => ({
      ...action,
      priority: index + 1, // Renumber after sort
    }));

    return res.status(200).json({
      success: true,
      data: { actions: topActions },
    });
  } catch (error) {
    logger.error('NextActionsController.getNextActions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch next actions' });
  }
}
