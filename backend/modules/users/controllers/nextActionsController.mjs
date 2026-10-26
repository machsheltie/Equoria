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
 *   5. breed          — a Stallion, or a Mare off her breeding cooldown
 *   6. groom-foal      — a foal development record for a horse under 3 that has
 *                       not been groomed this Eastern game day
 *   7. visit-vet      — an injured horse, or one in bad health
 *      feed           — a horse in bad health (Equoria-cn6kt)
 *
 * Health gate (owner rulings 2026-10-22 Equoria-3tna6, 2026-10-23
 * Equoria-u0jop): bad health is the only consequence — a horse must be Fair or
 * better to train, breed or enter shows, so none of those is suggested for a
 * horse in Bad health. The gate is the one those actions apply:
 * utils/horseHealth.mjs hasBadHealth (was displayed health 'critical' only).
 *
 * Actions are emitted PER real entity (one train per trainable horse, one
 * breed per breedable horse, one visit-vet per injured horse, one groom-foal
 * per foal under 3). `compete` is a single opportunity action for the
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
 * Query budget: 4 round trips total (horses, foals under 3, open shows, and one
 * array-form `$transaction` holding the unviewed-results count + most-recent
 * lookup) — no per-horse N+1. Eligibility matching runs in-memory over those
 * result sets.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  ENTRY_RULE_HORSE_SELECT,
  evaluateEntryRules,
  loadActiveAssignments,
  loadActiveDisciplineTypes,
  loadHorsesWithConformationGroom,
} from '../../../utils/competitionEntryRules.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { gameDayBounds } from '../../../utils/gameTime.mjs';
import { maxActiveAgeYears, minActiveAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { getFeedHealth, hasBadHealth, hungerFeedingPlan } from '../../../utils/horseHealth.mjs';
import { damBreedingCooldownEndsAt } from '../../horses/index.mjs';

// Story 23.4 priority table. 1 = highest.
const SPEC_PRIORITY = Object.freeze({
  'claim-prize': 1,
  'check-results': 2,
  train: 3,
  compete: 4,
  breed: 5,
  'groom-foal': 6,
  'visit-vet': 7,
  // Equoria-cn6kt: feeding sits with the vet visit as care for a horse in bad health.
  feed: 7,
});

// Story 23.4 AC: "max 10 actions returned".
const maxActions = 10;

// The active ages for training / competing / breeding come from the one horse
// age policy (constants/horseAgePolicy.mjs: 3-20 inclusive; Equoria-2nacc). The
// horses schema stores `age` as an Int column.
const minActiveAge = minActiveAgeYears;

// Case-insensitive injured check — the canonical persisted value is 'Injured'
// (Horse.healthStatus default 'Excellent'). enterShow uses the same
// `String(x).toLowerCase() === 'injured'` form; the previous
// `=== 'injured' || === 'INJURED'` form here MISSED the real 'Injured' value.
const isInjured = healthStatus => String(healthStatus).toLowerCase() === 'injured';

// `age` is a nullable Int on Horse — a null age must not pass the gate.
const isActiveAge = age =>
  typeof age === 'number' && age >= minActiveAgeYears && age <= maxActiveAgeYears;

// The health gate breeding, training and show entry apply (Equoria-3tna6,
// Equoria-u0jop): displayed health (worse of feed and vet health) Bad.
const isInBadHealth = (h, now) => hasBadHealth(h, now);

const isTrainable = (h, now) =>
  isActiveAge(h.age) &&
  !isInjured(h.healthStatus) &&
  !isInBadHealth(h, now) &&
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
        // Displayed health (the bad-health gate, Equoria-3tna6).
        lastFedDate: true,
        hungerSince: true,
        lastVettedDate: true,
        // The entry rules (Equoria-576c0 B9): dateOfBirth, healthStatus, gaitScores.
        ...ENTRY_RULE_HORSE_SELECT,
      },
    });

    // Query 2 — foal development records of horses under 3 (game age).
    //
    // Equoria-fr2kg Q11 (owner ruling 2026-10-22): no isActive filter — the
    // legacy FoalDevelopment.isActive column never turns false. A horse is a
    // foal while its game age is under 3 (minActiveAge).
    //
    // Equoria-08luj (owner ruling 2026-10-26, q67): the home reminder lists only
    // horses not yet groomed today (Eastern game day), so a foal with a groom
    // interaction today is left out.
    //
    // 21R-PROD-BUG-1 (Equoria-j8s2): the FoalDevelopment model has a `foal`
    // relation (named `FoalDevelopmentFoal` via foalId FK); it does NOT have a
    // `horse` relation. Output `horseId` is sourced from `foalId` because that
    // is the canonical FK to horses.id. The defensive catch keeps the hub
    // usable on a transient foal-query error rather than failing the whole
    // response; real errors are still logged.
    let activeFoals = [];
    const today = gameDayBounds(now);
    try {
      activeFoals = await prisma.foalDevelopment.findMany({
        where: {
          foal: {
            userId,
            age: { lt: minActiveAge },
            groomInteractions: { none: { timestamp: { gte: today.start, lt: today.end } } },
          },
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
        // Ridden and conformation shows (Equoria-576c0.2): a conformation show is
        // offered only for a horse with a groom ready to handle it (below).
        where: { status: 'open', closeDate: { gt: now } },
        select: {
          id: true,
          name: true,
          discipline: true,
          showType: true,
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
    // The entry transaction's own rules (utils/competitionEntryRules,
    // Equoria-576c0 B9): age 3-20 from dateOfBirth, an eligible rider, Gaited
    // needs gaiting, not already entered, not injured. XP never gates entry (R9).
    if (horses.length > 0 && openShows.length > 0) {
      const horseIds = horses.map(h => h.id);
      const [assignments, activeTypes, groomReady, entries] = await Promise.all([
        loadActiveAssignments(prisma, horseIds),
        loadActiveDisciplineTypes(prisma, horseIds),
        loadHorsesWithConformationGroom(prisma, horseIds, userId, now),
        prisma.showEntry.findMany({
          where: { horseId: { in: horseIds }, showId: { in: openShows.map(s => s.id) } },
          select: { showId: true, horseId: true },
        }),
      ]);
      const entered = new Set(entries.map(e => `${e.showId}:${e.horseId}`));
      for (const show of openShows) {
        const eligible = horses.find(
          h =>
            !isInBadHealth(h, now) &&
            (show.showType !== 'conformation' || groomReady.has(h.id)) &&
            evaluateEntryRules({
              show,
              horse: h,
              assignment: assignments.get(h.id),
              alreadyEntered: entered.has(`${show.id}:${h.id}`),
              activeTypes: activeTypes.get(h.id),
              userId,
              now,
            }) === null,
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

    // ── breed (priority 5) — one per Stallion, and per Mare off her cooldown ──
    // The breeding guard's own rule (Equoria-kha18; owner rulings 2026-10-02 /
    // S-Q1 2026-10-16): only a mare has a cooldown, 7 Eastern game days from
    // lastBredDate. A breed action is only offered once it is over, so its
    // cooldownEndsAt is always null.
    for (const h of horses) {
      const sex = h.sex?.toLowerCase();
      if (
        (sex === 'mare' || sex === 'stallion') &&
        isActiveAge(h.age) &&
        !isInjured(h.healthStatus) &&
        !isInBadHealth(h, now)
      ) {
        if (damBreedingCooldownEndsAt(h, now) === null) {
          actions.push({
            type: 'breed',
            priority: SPEC_PRIORITY.breed,
            horseId: h.id,
            horseName: h.name,
            metadata: { cooldownEndsAt: null },
          });
        }
      }
    }

    // ── groom-foal (priority 6) — one per foal under 3 ───────────────────────
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

    // ── visit-vet + feed (priority 7) — care for injured / bad-health horses ──
    // Owner ruling 2026-10-22 (Equoria-cn6kt): a horse in Bad health is
    // suggested BOTH a vet visit and feeding. An injured horse keeps its vet
    // visit; a horse that is both gets one vet suggestion. Feeding is offered
    // only while the horse can still be fed today (the feed path refuses a
    // second feeding on the same Eastern game day).
    for (const h of horses) {
      const badHealth = isInBadHealth(h, now);
      if (isInjured(h.healthStatus) || badHealth) {
        // q28 (owner 2026-10-23): the hub line adds "and fed" when the horse is
        // hungry (hunger Fair or Bad).
        const hungry = ['Fair', 'Bad'].includes(getFeedHealth(h, now));
        actions.push({
          type: 'visit-vet',
          priority: SPEC_PRIORITY['visit-vet'],
          horseId: h.id,
          horseName: h.name,
          metadata: { healthStatus: h.healthStatus, needsFeeding: hungry },
        });
      }
      if (badHealth && hungerFeedingPlan(h, now).canFeed) {
        actions.push({
          type: 'feed',
          priority: SPEC_PRIORITY.feed,
          horseId: h.id,
          horseName: h.name,
          metadata: { displayedHealth: 'Bad' },
        });
      }
    }

    // Sort by spec priority ascending (V8 Array.sort is stable — insertion order
    // is preserved within a priority), cap at 10, then renumber the emitted
    // priority to a contiguous 1..N rank.
    actions.sort((a, b) => a.priority - b.priority);
    const topActions = actions.slice(0, maxActions).map((action, index) => ({
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
