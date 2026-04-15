/**
 * ShowController (Epic BACKEND-A)
 *
 * Handles player-created shows with 7-day entry windows and overnight execution.
 *
 * BA-2: POST /api/v1/shows/create
 * BA-3: GET  /api/v1/shows        — browse open shows (paginated)
 * BA-3: POST /api/v1/shows/:id/enter — enter a horse in a show
 * BA-4: POST /api/v1/shows/execute — cron-triggered overnight execution
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const VALID_DISCIPLINES = [
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Roping',
  'Team Penning',
  'Rodeo',
  'Hunter',
  'Saddleseat',
  'Endurance',
  'Eventing',
  'Dressage',
  'Show Jumping',
  'Vaulting',
  'Polo',
  'Cross Country',
  'Combined Driving',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Steeplechase',
  'Racing',
  'Harness Racing',
];

// ── BA-2: Create a show ────────────────────────────────────────────────────────

export async function createShow(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { name, discipline, entryFee = 0, maxEntries, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: 'Show name must be at least 2 characters' });
    }
    if (!discipline || !VALID_DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ success: false, message: 'Invalid discipline' });
    }
    if (typeof entryFee !== 'number' || entryFee < 0 || entryFee > 100_000) {
      return res.status(400).json({ success: false, message: 'Entry fee must be 0–100,000' });
    }

    const openDate = new Date();
    const closeDate = new Date(openDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const show = await prisma.show.create({
      data: {
        name: name.trim(),
        discipline,
        entryFee,
        maxEntries: maxEntries ?? null,
        description: description ?? null,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: closeDate,
        status: 'open',
        openDate,
        closeDate,
        createdByUserId: userId,
      },
    });

    logger.info(`Show created: ${show.name} (id=${show.id}) by user ${userId}`);
    return res.status(201).json({ success: true, data: { show } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'A show with that name already exists' });
    }
    logger.error('showController.createShow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create show' });
  }
}

// ── BA-3: Browse shows ─────────────────────────────────────────────────────────

export async function getShows(req, res) {
  try {
    const { status = 'open', discipline, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (discipline) {
      where.discipline = discipline;
    }

    const [shows, total] = await Promise.all([
      prisma.show.findMany({
        where,
        orderBy: { closeDate: 'asc' },
        skip,
        take: limitNum,
        include: {
          _count: { select: { entries: true } },
        },
      }),
      prisma.show.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        shows: shows.map(s => ({
          ...s,
          entryCount: s._count.entries,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('showController.getShows error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch shows' });
  }
}

// ── BA-3: Enter a show ─────────────────────────────────────────────────────────

export async function enterShow(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const showId = parseInt(req.params.id, 10);
    const { horseId } = req.body;

    if (!horseId || typeof horseId !== 'number') {
      return res.status(400).json({ success: false, message: 'horseId is required' });
    }

    // Load show
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { _count: { select: { entries: true } } },
    });

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    if (show.status !== 'open') {
      return res
        .status(409)
        .json({ success: false, message: 'This show is no longer accepting entries' });
    }
    if (show.closeDate && new Date(show.closeDate) <= new Date()) {
      return res.status(409).json({ success: false, message: 'Entry period has closed' });
    }
    if (show.maxEntries && show._count.entries >= show.maxEntries) {
      return res.status(409).json({ success: false, message: 'Show is full' });
    }

    // Verify horse ownership
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { id: true, name: true, userId: true, age: true, health: true },
    });

    if (!horse || horse.userId !== userId) {
      return res
        .status(403)
        .json({ success: false, message: 'Horse not found or not owned by you' });
    }
    if (horse.age < 3) {
      return res
        .status(400)
        .json({ success: false, message: 'Horse must be at least 3 years old to compete' });
    }
    if (horse.health === 'injured' || horse.health === 'INJURED') {
      return res.status(400).json({ success: false, message: 'Injured horses cannot compete' });
    }

    // Check entry fee
    if (show.entryFee > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
      if (!user || user.money < show.entryFee) {
        return res
          .status(402)
          .json({ success: false, message: 'Insufficient funds for entry fee' });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { money: { decrement: show.entryFee } },
      });
    }

    // Create entry (unique constraint handles duplicate entry)
    const entry = await prisma.showEntry.create({
      data: { showId, horseId, userId, feePaid: show.entryFee },
    });

    logger.info(`Horse ${horseId} entered show ${showId} by user ${userId}`);
    return res.status(201).json({ success: true, data: { entry, horseName: horse.name } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'Horse is already entered in this show' });
    }
    logger.error('showController.enterShow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to enter show' });
  }
}

// ── BA-4: Overnight show execution ────────────────────────────────────────────

/**
 * Executes all shows where closeDate <= now && status === 'open'.
 * Sets status = 'completed', executedAt = now.
 * Awards prizes and XP for each entry.
 * Sets firstEverWin milestone flag if applicable.
 *
 * Called by the scheduled task or POST /api/v1/shows/execute (admin).
 */
export async function executeClosedShows(req, res) {
  try {
    const now = new Date();

    // Find all shows ready to execute
    const shows = await prisma.show.findMany({
      where: { status: 'open', closeDate: { lte: now } },
      include: {
        entries: {
          include: {
            horse: {
              select: {
                id: true,
                name: true,
                userId: true,
                speed: true,
                stamina: true,
                agility: true,
                balance: true,
                precision: true,
                boldness: true,
              },
            },
          },
        },
      },
    });

    let totalExecuted = 0;

    for (const show of shows) {
      await prisma.show.update({ where: { id: show.id }, data: { status: 'executing' } });

      const entries = show.entries;
      if (entries.length === 0) {
        await prisma.show.update({
          where: { id: show.id },
          data: { status: 'completed', executedAt: now },
        });
        continue;
      }

      // Score each entry
      const scored = entries.map(entry => {
        const h = entry.horse;
        const base =
          ((h.speed ?? 50) +
            (h.stamina ?? 50) +
            (h.agility ?? 50) +
            (h.precision ?? 50) +
            (h.boldness ?? 50)) /
          5;
        const luck = (Math.random() - 0.5) * 18; // ±9%
        return { entry, score: Math.max(0, Math.round(base + luck)) };
      });

      // Sort descending by score
      scored.sort((a, b) => b.score - a.score);

      const totalPrize = Math.max(0, show.prize);
      const prizeSlots = [0.5, 0.3, 0.2]; // 1st/2nd/3rd shares

      const resultOps = scored.map(async ({ entry, score }, i) => {
        const placement = i + 1;
        const prizeShare = prizeSlots[i] ?? 0;
        const prize = Math.floor(totalPrize * prizeShare);

        // Create competition result
        await prisma.competitionResult.create({
          data: {
            score,
            placement: `${placement}`,
            discipline: show.discipline,
            runDate: now,
            showName: show.name,
            prizeWon: prize,
            horseId: entry.horseId,
            showId: show.id,
          },
        });

        // Award prize money
        if (prize > 0) {
          await prisma.user.update({
            where: { id: entry.userId },
            data: { money: { increment: prize } },
          });
        }

        // Set firstEverWin milestone if 1st place
        if (placement === 1) {
          const user = await prisma.user.findUnique({
            where: { id: entry.userId },
            select: { settings: true },
          });
          const settings = user?.settings ?? {};
          const milestones = settings.milestones ?? {};
          if (!milestones.firstWin) {
            await prisma.user.update({
              where: { id: entry.userId },
              data: {
                settings: {
                  ...settings,
                  milestones: { ...milestones, firstWin: now.toISOString() },
                },
              },
            });
          }
        }
      });

      await Promise.all(resultOps);

      await prisma.show.update({
        where: { id: show.id },
        data: { status: 'completed', executedAt: now },
      });

      totalExecuted++;
      logger.info(`Executed show: ${show.name} (id=${show.id}), ${entries.length} entries`);
    }

    const message = `Executed ${totalExecuted} show(s)`;
    logger.info(message);

    if (res) {
      return res.status(200).json({ success: true, data: { executed: totalExecuted, message } });
    }
  } catch (error) {
    logger.error('showController.executeClosedShows error:', error);
    if (res) {
      return res.status(500).json({ success: false, message: 'Execution failed' });
    }
  }
}
