/**
 * NextActionsController (Task 23-4 / Equoria-oey96.28)
 *
 * GET /api/v1/next-actions
 * Returns a priority-ordered list of suggested next actions for the
 * authenticated user, sourced entirely from real persisted state.
 *
 * Priority contract implemented by this controller (1 = highest):
 *   1. claim-prize    — unclaimed competition prizes            (NOT emitted; out of scope for oey96.28)
 *   2. check-results  — a CompetitionResult on one of the user's horses that
 *                       still has `viewedAt` NULL
 *   3. train          — a horse whose training cooldown expired
 *   4. compete        — an OPEN show the user has an eligible horse for
 *   5. breed          — a Mare OR Stallion off the 30-day breeding cooldown
 *   6. groom-foal      — an active foal development record
 *   7. visit-vet      — an injured horse
 *
 * Actions are emitted PER real entity (one train per trainable horse, one
 * breed per breedable horse, one visit-vet per injured horse, one groom-foal
 * per active foal). `compete` is a single opportunity action for the
 * most-urgent open show the user can actually enter, and `check-results` is a
 * single aggregate action carrying the unviewed COUNT plus the most recent
 * unviewed result's show — the player goes to one results surface regardless
 * of how many results are waiting, so N cards would be N copies of one errand.
 *
 * The list is sorted by the priority above, capped at 10, then the emitted
 * `priority` is renumbered to a contiguous 1..N rank (the Hub gold-accents the
 * priority===1 card).
 *
 * NOT emitted (deliberately, sourced-from-real-data rule — Constitution §2):
 *   - `claim-prize`  (spec priority 1): out of scope for Equoria-oey96.28;
 *     unimplemented, tracked in Equoria-1e6no (product question: are prizes
 *     auto-credited, or is there an unclaimed-prize state to source from?).
 *
 * `check-results` (spec priority 2) WAS in this list until 2026-09-21: it could
 * not be sourced because CompetitionResult had no viewed/seen column. The owner
 * approved that migration on 2026-09-21 (Equoria-oey96.28), so it is now emitted
 * from the real `CompetitionResult.viewedAt` column
 * (20260921120000_oey9628_add_competition_result_viewed_at). The write that
 * clears it is POST /api/v1/competition/results/viewed.
 *
 * Query budget: 4 round trips total (horses, active foals, open shows, and one
 * array-form `$transaction` holding the unviewed-results count + most-recent
 * lookup) — no per-horse N+1. Eligibility matching runs in-memory over those
 * result sets.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  getHorseXpLevel,
  isHorseWithinLevelBracket,
} from '../../../utils/horseCompetitionLevel.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

// Story 23.4 priority table. 1 = highest.
const SPEC_PRIORITY = Object.freeze({
  'claim-prize': 1,
  'check-results': 2,
  train: 3,
  compete: 4,
  breed: 5,
  'groom-foal': 6,
  'visit-vet': 7,
});

// Story 23.4 AC: "max 10 actions returned".
const MAX_ACTIONS = 10;

// Minimum active age for training / competing / breeding (mirrors enterShow /
// trainingController — the horses schema stores `age` as an Int column).
const MIN_ACTIVE_AGE = 3;

// 30-day breeding cooldown, in ms. This mirrors the canonical rule in
// backend/middleware/gameIntegrity.mjs (`breedingCooldown = 30 days`). Both
// sites inline the literal; extracting one shared constant is filed as
// Equoria-igx6d.
const BREEDING_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

// Case-insensitive injured check — the canonical persisted value is 'Injured'
// (Horse.healthStatus default 'Excellent'). enterShow uses the same
// `String(x).toLowerCase() === 'injured'` form; the previous
// `=== 'injured' || === 'INJURED'` form here MISSED the real 'Injured' value.
const isInjured = healthStatus => String(healthStatus).toLowerCase() === 'injured';

// `age` is a nullable Int on Horse — a null age must not pass the gate.
const isActiveAge = age => typeof age === 'number' && age >= MIN_ACTIVE_AGE;

const isTrainable = (h, now) =>
  isActiveAge(h.age) &&
  !isInjured(h.healthStatus) &&
  (!h.trainingCooldown || new Date(h.trainingCooldown) <= now);

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
    const nowMs = now.getTime();
    const actions = [];

    // Query 1 — user's horses with the fields every action type needs.
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
        horseXp: true,
      },
    });

    // Query 2 — foals in active development.
    //
    // 21R-PROD-BUG-1 (Equoria-j8s2): the FoalDevelopment model has a `foal`
    // relation (named `FoalDevelopmentFoal` via foalId FK); it does NOT have a
    // `horse` relation. Output `horseId` is sourced from `foalId` because that
    // is the canonical FK to horses.id. The defensive catch keeps the hub
    // usable on a transient foal-query error rather than failing the whole
    // response; real errors are still logged.
    let activeFoals = [];
    try {
      activeFoals = await prisma.foalDevelopment.findMany({
        where: {
          foal: { userId },
          isActive: true,
        },
        select: { foalId: true, foal: { select: { name: true, dateOfBirth: true } } },
      });
    } catch (foalErr) {
      logger.warn('nextActionsController: foalDevelopment query failed', {
        userId,
        error: foalErr.message,
      });
    }

    // Query 3 — currently-open shows (Equoria-oey96.28: `compete` is now gated
    // on a real open show the user can enter, making the header contract true).
    // The set is naturally bounded by the 7-day entry window + nightly
    // execution cron; ordered by closeDate asc so the most-urgent show wins.
    let openShows = [];
    try {
      openShows = await prisma.show.findMany({
        where: { status: 'open', closeDate: { gt: now } },
        select: {
          id: true,
          name: true,
          discipline: true,
          levelMin: true,
          levelMax: true,
          closeDate: true,
        },
        orderBy: { closeDate: 'asc' },
      });
    } catch (showErr) {
      logger.warn('nextActionsController: open-shows query failed', {
        userId,
        error: showErr.message,
      });
    }

    // Query 4 — unviewed competition results (Equoria-oey96.28). Ownership is
    // expressed through the horse relation: a result belongs to the player who
    // owns the horse that ran. The array form of `$transaction` is a single
    // read-only round trip (the same posture the retryable-transaction sentinel
    // records for read-only array-form sites — a 503-vs-500 on a hub read is not
    // meaningful, so it is deliberately not wrapped). The defensive catch keeps
    // the hub usable on a transient failure, as the foal and show queries do.
    let unviewedResultCount = 0;
    let mostRecentUnviewed = null;
    try {
      const [count, mostRecent] = await prisma.$transaction([
        prisma.competitionResult.count({ where: { viewedAt: null, horse: { userId } } }),
        prisma.competitionResult.findFirst({
          where: { viewedAt: null, horse: { userId } },
          orderBy: [{ runDate: 'desc' }, { id: 'desc' }],
          select: { showId: true, showName: true, runDate: true },
        }),
      ]);
      unviewedResultCount = count;
      mostRecentUnviewed = mostRecent;
    } catch (resultErr) {
      logger.warn('nextActionsController: unviewed-results query failed', {
        userId,
        error: resultErr.message,
      });
    }

    // ── check-results (priority 2) — one aggregate action ────────────────────
    if (unviewedResultCount > 0 && mostRecentUnviewed) {
      actions.push({
        type: 'check-results',
        priority: SPEC_PRIORITY['check-results'],
        metadata: {
          count: unviewedResultCount,
          showId: mostRecentUnviewed.showId,
          showName: mostRecentUnviewed.showName,
          // Normalised to a controller-owned Date for the same cross-realm
          // serialisation reason as `train`'s cooldownEndsAt below.
          runDate: mostRecentUnviewed.runDate ? new Date(mostRecentUnviewed.runDate) : null,
        },
      });
    }

    // ── train (priority 3) — one per trainable horse ─────────────────────────
    for (const h of horses) {
      if (isTrainable(h, now)) {
        actions.push({
          type: 'train',
          priority: SPEC_PRIORITY.train,
          horseId: h.id,
          horseName: h.name,
          // Normalise to a controller-owned Date so it serialises to an ISO
          // string in every runtime (a raw Prisma DateTime can cross-realm to
          // `{}` under the VM-modules test loader).
          metadata: { cooldownEndsAt: h.trainingCooldown ? new Date(h.trainingCooldown) : null },
        });
      }
    }

    // ── compete (priority 4) — the most-urgent open show the user can enter ───
    // Reuses the canonical show-entry eligibility (age >= 3, not injured, horse
    // XP-bracket level within the show's [levelMin, levelMax]) from
    // horseCompetitionLevel.mjs so this path can't drift from enterShow.
    const competeReadyHorses = horses.filter(h => isActiveAge(h.age) && !isInjured(h.healthStatus));
    if (competeReadyHorses.length > 0) {
      for (const show of openShows) {
        const eligible = competeReadyHorses.find(h =>
          isHorseWithinLevelBracket(getHorseXpLevel(h.horseXp), show.levelMin, show.levelMax),
        );
        if (eligible) {
          actions.push({
            type: 'compete',
            priority: SPEC_PRIORITY.compete,
            horseId: eligible.id,
            horseName: eligible.name,
            metadata: {
              showId: show.id,
              showName: show.name,
              discipline: show.discipline,
              closeDate: show.closeDate ? new Date(show.closeDate) : null,
            },
          });
          break; // one compete suggestion — the soonest-closing enterable show
        }
      }
    }

    // ── breed (priority 5) — one per Mare/Stallion off the 30-day cooldown ────
    for (const h of horses) {
      const sex = h.sex?.toLowerCase();
      if (
        (sex === 'mare' || sex === 'stallion') &&
        isActiveAge(h.age) &&
        !isInjured(h.healthStatus)
      ) {
        const lastBredMs = h.lastBredDate ? new Date(h.lastBredDate).getTime() : null;
        const offCooldown = lastBredMs === null || nowMs - lastBredMs >= BREEDING_COOLDOWN_MS;
        if (offCooldown) {
          actions.push({
            type: 'breed',
            priority: SPEC_PRIORITY.breed,
            horseId: h.id,
            horseName: h.name,
            metadata: {
              cooldownEndsAt:
                lastBredMs === null ? null : new Date(lastBredMs + BREEDING_COOLDOWN_MS),
            },
          });
        }
      }
    }

    // ── groom-foal (priority 6) — one per active foal ────────────────────────
    for (const foalDev of activeFoals) {
      const foalAge = foalDev.foal?.dateOfBirth
        ? getHorseAgeDays(foalDev.foal.dateOfBirth, now)
        : null;
      actions.push({
        type: 'groom-foal',
        priority: SPEC_PRIORITY['groom-foal'],
        horseId: foalDev.foalId,
        horseName: foalDev.foal?.name,
        metadata: { foalAge },
      });
    }

    // ── visit-vet (priority 7) — one per injured horse ───────────────────────
    for (const h of horses) {
      if (isInjured(h.healthStatus)) {
        actions.push({
          type: 'visit-vet',
          priority: SPEC_PRIORITY['visit-vet'],
          horseId: h.id,
          horseName: h.name,
          metadata: { healthStatus: h.healthStatus },
        });
      }
    }

    // Sort by spec priority ascending (V8 Array.sort is stable — insertion order
    // is preserved within a priority), cap at 10, then renumber the emitted
    // priority to a contiguous 1..N rank.
    actions.sort((a, b) => a.priority - b.priority);
    const topActions = actions.slice(0, MAX_ACTIONS).map((action, index) => ({
      ...action,
      priority: index + 1,
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
