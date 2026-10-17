/**
 * Breeding-pair eligibility rules and the pregnancy-claim data, shared by every
 * path that starts a pregnancy (Equoria-q4uem.9).
 *
 * Extracted verbatim from horseFoalingController.createFoal so the own-pair
 * route (POST /horses/foals) and the stud-booking routes apply ONE set of rules
 * with ONE set of messages. Nothing here writes: the guarded claims stay inline
 * in each caller's transaction, where the lock-order sentinel can see them.
 *
 * Rules (unchanged; owner rulings cited where they exist):
 *   - neither horse in critical displayed health (Equoria-2e7e)
 *   - sire and dam are different horses, exactly 'Stallion' and 'Mare'
 *     (Equoria-mhdul)
 *   - both at least MIN_BREEDING_AGE_YEARS game-years old (PRD-08 s2.5)
 *   - the DAM is off cooldown: DAM_BREEDING_COOLDOWN_DAYS after lastBredDate.
 *     Mares only; stallions have no cooldown or limit (owner rulings 2026-07-02,
 *     2026-10-02, S2 2026-10-15; S-Q1 2026-10-16 keeps 7 days)
 *   - the foal's effective breed exists and has a breed profile (Equoria-6w3ur)
 *   - the dam is not already in foal (advisory; the guarded claim is the race
 *     guard — Equoria-9gsxg)
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { getHorseAgeDays, getHorseAgeYears } from '../../../utils/horseAge.mjs';
import {
  calendarDateDayIndex,
  gameCalendarDate,
  startOfGameDayIndex,
} from '../../../utils/gameTime.mjs';

/** Minimum breeding age in game-years (PRD-08 s2.5). 3 game-years = 21 real days. */
export const MIN_BREEDING_AGE_YEARS = 3;

/**
 * Dam cooldown in real days after conception (user decision 2026-07-02):
 * 1 game year = 7 real days, DAM only, stallions unrestricted.
 *
 * Anchor is lastBredDate (conception stamp, not foaling date).
 * Semantics: a mare bred any time on day D is breedable from 00:00 Eastern
 * on D+7 (mirrors the Equoria-vdw5 date-only, Eastern game clock convention).
 */
export const DAM_BREEDING_COOLDOWN_DAYS = 7;

function refuse(status, message, kind) {
  return { ok: false, status, message, kind };
}

/**
 * Check a sire/dam pair against every breeding rule, in the order createFoal
 * always applied them. Reads only (the breed row).
 *
 * @param {{ sire: object, dam: object, breedId?: unknown, client?: object }} params
 *   `client` may be a transaction client so the breed read joins the caller's tx.
 * @returns {Promise<{ ok: true, effectiveBreedId: number }
 *   | { ok: false, status: 400 | 500, message: string, kind: 'sire' | 'mare' | 'pair' | 'server' }>}
 */
export async function validateBreedingPair({ sire, dam, breedId, client = prisma }) {
  // Critical-health gate (Equoria-2e7e): mirrors conformationShowController's A12 check.
  if (getDisplayedHealth(sire) === 'critical') {
    logger.info(`[breedingPairRules] Rejected: sire ${sire.id} is in critical health`);
    return refuse(
      400,
      `${sire.name} is in critical health and cannot breed. Feed and vet to restore health.`,
      'sire',
    );
  }
  if (getDisplayedHealth(dam) === 'critical') {
    logger.info(`[breedingPairRules] Rejected: dam ${dam.id} is in critical health`);
    return refuse(
      400,
      `${dam.name} is in critical health and cannot breed. Feed and vet to restore health.`,
      'mare',
    );
  }

  // Guard 1: self-cross (CONTRIBUTING.md s4 pattern)
  if (Number(sire.id) === Number(dam.id)) {
    return refuse(400, 'Sire and dam cannot be the same horse', 'pair');
  }

  // Guard 2: sex validation
  if (sire.sex !== 'Stallion') {
    return refuse(400, `Sire must be a Stallion (${sire.name} is ${sire.sex})`, 'sire');
  }
  if (dam.sex !== 'Mare') {
    return refuse(400, `Dam must be a Mare (${dam.name} is ${dam.sex})`, 'mare');
  }

  // Guard 3: minimum breeding age (3 game-years = 21 real days).
  // Uses horseAge.mjs date-only, Eastern game clock arithmetic (Equoria-vdw5) — never inline math.
  const sireAgeYears = getHorseAgeYears(sire.dateOfBirth);
  if (sireAgeYears < MIN_BREEDING_AGE_YEARS) {
    return refuse(
      400,
      `${sire.name} is too young to breed (${sireAgeYears} game-year(s); minimum is ${MIN_BREEDING_AGE_YEARS})`,
      'sire',
    );
  }
  const damAgeYears = getHorseAgeYears(dam.dateOfBirth);
  if (damAgeYears < MIN_BREEDING_AGE_YEARS) {
    return refuse(
      400,
      `${dam.name} is too young to breed (${damAgeYears} game-year(s); minimum is ${MIN_BREEDING_AGE_YEARS})`,
      'mare',
    );
  }

  // Guard 4: dam cooldown (1 game year = 7 real days; user decision 2026-07-02).
  // Stallions are unrestricted. Null-check FIRST — getHorseAgeDays(null) returns 0
  // which would be < DAM_BREEDING_COOLDOWN_DAYS and block every first breeding (trap).
  if (dam.lastBredDate) {
    const daysSinceLastBred = getHorseAgeDays(dam.lastBredDate, new Date());
    if (daysSinceLastBred < DAM_BREEDING_COOLDOWN_DAYS) {
      const daysRemaining = DAM_BREEDING_COOLDOWN_DAYS - daysSinceLastBred;
      return refuse(
        400,
        `${dam.name} is on breeding cooldown for ${daysRemaining} more day(s) (one breeding per game year)`,
        'mare',
      );
    }
  }

  // ── BREED PRECONDITION (Equoria-6w3ur) ──────────────────────────────────
  // Validate the breed the foal will ACTUALLY be born with: a supplied breedId
  // is optional pending intent; otherwise the foaling job derives the breed
  // from the dam (`foalingService.createFoalFromPregnancy`). A null, unknown or
  // profile-less breed would make the foaling job throw SEVEN DAYS LATER and
  // retry forever (a permanently stuck pregnancy), so it is refused here,
  // BEFORE any claim stamps the cooldown.
  let normalizedBreedId = null;
  if (breedId !== undefined && breedId !== null && breedId !== '') {
    normalizedBreedId = Number.parseInt(breedId, 10);
    if (!Number.isInteger(normalizedBreedId) || normalizedBreedId <= 0) {
      return refuse(400, 'breedId must be a positive integer', 'pair');
    }
  }

  const effectiveBreedId = normalizedBreedId ?? dam.breedId ?? null;
  if (!Number.isInteger(effectiveBreedId) || effectiveBreedId <= 0) {
    logger.info(
      `[breedingPairRules] Rejected: dam ${dam.id} has no breed on record and no breedId was supplied`,
    );
    // COPY EDITORS — this message is REACHABLE and its wording is load-bearing
    // (Equoria-m9lz1 fix round 3, finding 5): it says only what is true — the
    // missing fact is on the mare's record — and promises no control the
    // breeding surface does not have.
    return refuse(
      400,
      `${dam.name} has no breed on record, so there is no telling what her foal would be. Her breed needs to be on her record before she can be bred.`,
      'mare',
    );
  }

  const breedRecord = await client.breed.findUnique({
    where: { id: effectiveBreedId },
    select: { name: true },
  });
  if (!breedRecord?.name) {
    return refuse(400, `No breed found for id ${effectiveBreedId}`, 'pair');
  }

  // The breed's NAME must have a usable profile: foaling calls the same loader
  // and throws on a missing profile. `getBreedProfile` throws rather than
  // returning null, so this asks "would foaling succeed?" with the very
  // function foaling will call.
  try {
    getBreedProfile(breedRecord.name);
  } catch (profileError) {
    // Only the loader's load-failure arms (breedProfileLoader.mjs) attach
    // `{ cause: JSON_LOAD_ERROR }`; genuine absence throws without a cause. A
    // broken profile SOURCE is a server outage (500), never the mare's fault.
    if (profileError.cause) {
      logger.error(
        `[breedingPairRules] Breed profile source unavailable while checking breed ${effectiveBreedId} ("${breedRecord.name}") — ${profileError.message}`,
      );
      return refuse(
        500,
        'Breed data is unavailable right now, so breeding cannot start. Try again later.',
        'server',
      );
    }

    logger.error(
      `[breedingPairRules] Rejected: breed ${effectiveBreedId} ("${breedRecord.name}") has no usable breed profile — ${profileError.message}`,
    );
    return refuse(
      400,
      `${breedRecord.name} has no breed profile on file, so a foal of that breed cannot be born yet.`,
      'pair',
    );
  }

  // Advisory "already in foal" check: a friendly 400 on the common path. The
  // race is closed by the caller's guarded claim (inFoalSinceDate: null in the
  // WHERE, count must be 1).
  if (dam.inFoalSinceDate) {
    return refuse(400, `${dam.name} is already in foal.`, 'mare');
  }

  return { ok: true, effectiveBreedId };
}

/**
 * The column values the guarded pregnancy claim writes on the dam. Everything
 * that must happen exactly once per pregnancy rides on that ONE statement:
 * the claim itself, the sire, the empty per-tier feed counters, the cooldown
 * stamp (date-only column: the Eastern date) and the pending foal intent —
 * the VALIDATED EFFECTIVE breed, pinned at conception (Equoria-m9lz1).
 *
 * @param {{ sireId: number, name?: string | null, effectiveBreedId: number, now: Date }} params
 */
export function pregnancyClaimData({ sireId, name, effectiveBreedId, now }) {
  return {
    inFoalSinceDate: now,
    pregnancySireId: sireId,
    pregnancyFeedingsByTier: {},
    lastBredDate: gameCalendarDate(now),
    pendingFoalName: name ?? null,
    pendingFoalBreedId: effectiveBreedId,
  };
}

/** Owner ruling S-Q4 (Stacey, 2026-10-16): the 409 every other breeding path answers. */
export function pendingRequestMessage(damName) {
  return `${damName} has a pending stud request. Cancel it before breeding her elsewhere.`;
}

/**
 * When a MARE's breeding cooldown ends, or null (Equoria-q4uem.9 slice 6).
 * Mares only — a stallion never has one (owner rulings 2026-10-02 / S-Q1
 * 2026-10-16). The same Eastern day arithmetic the breeding guard uses: she is
 * on cooldown while the Eastern game day is before bred-day +
 * DAM_BREEDING_COOLDOWN_DAYS, so it ends at 00:00 Eastern that day
 * (lastBredDate is a date-only column: calendarDateDayIndex, never UTC ms).
 *
 * @param {{ sex?: string, lastBredDate?: Date|string|null }} horse
 * @param {Date} [now]
 * @returns {string | null} ISO instant, or null when not a mare or not on cooldown
 */
export function damBreedingCooldownEndsAt(horse, now = new Date()) {
  if (horse?.sex !== 'Mare' || !horse.lastBredDate) {
    return null;
  }
  const ends = startOfGameDayIndex(
    calendarDateDayIndex(horse.lastBredDate) + DAM_BREEDING_COOLDOWN_DAYS,
  );
  return ends.getTime() > now.getTime() ? ends.toISOString() : null;
}

/**
 * The breeding-state fields the horse list and detail add (slice 6):
 * mare-only cooldown end, in-foal flag, and — for the horse's OWNER only —
 * the pending private stud request holding her (S-Q4). `pending` is the
 * PENDING BreedingRecord for this dam, or null; pass null for a viewer who
 * does not own the horse.
 *
 * @param {object} horse
 * @param {{ id: number, sireId: number|null, sireName: string } | null} pending
 * @param {Date} [now]
 */
export function breedingStateFields(horse, pending, now = new Date()) {
  return {
    breedingCooldownEndsAt: damBreedingCooldownEndsAt(horse, now),
    inFoal: Boolean(horse.inFoalSinceDate),
    pendingStudRequest: pending
      ? { id: pending.id, stallionId: pending.sireId, stallionName: pending.sireName }
      : null,
  };
}
