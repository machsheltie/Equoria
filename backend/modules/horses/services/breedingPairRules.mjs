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
 *   - both horses Fair or better: neither in Bad displayed health (Equoria-2e7e;
 *     owner ruling 2026-10-23, Equoria-u0jop — was 'critical' only)
 *   - sire and dam are different horses, exactly 'Stallion' and 'Mare'
 *     (Equoria-mhdul)
 *   - both between minBreedingAgeYears (3) and maxBreedingAgeYears (20)
 *     game-years old, inclusive; a retired horse (21+) cannot breed (owner
 *     ruling, Stacey 2026-10-23, Equoria-e7tgc.4)
 *   - the DAM is off cooldown: DAM_BREEDING_COOLDOWN_DAYS after lastBredDate.
 *     Mares only; stallions have no cooldown or limit (owner rulings 2026-07-02,
 *     2026-10-02, S2 2026-10-15; S-Q1 2026-10-16 keeps 7 days)
 *   - sire and dam are the SAME breed, and the foal is always born that breed
 *     (owner ruling, Stacey 2026-10-20, Equoria-5nwwf). Nobody chooses a foal's
 *     breed; there are no grade horses and no crossbreeds.
 *   - the foal's breed exists and has a breed profile (Equoria-6w3ur)
 *   - the dam is not already in foal (advisory; the guarded claim is the race
 *     guard — Equoria-9gsxg)
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import { maxActiveAgeYears, minActiveAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { badHealthMessage, hasBadHealth } from '../../../utils/horseHealth.mjs';
import { getHorseAgeDays, getHorseAgeYears } from '../../../utils/horseAge.mjs';
import {
  calendarDateDayIndex,
  gameCalendarDate,
  startOfGameDayIndex,
} from '../../../utils/gameTime.mjs';

/** Minimum breeding age in game-years (PRD-08 s2.5). 3 game-years = 21 real days. */
export const minBreedingAgeYears = minActiveAgeYears;

/**
 * Maximum breeding age in game-years, inclusive (owner ruling, Stacey
 * 2026-10-23, Equoria-e7tgc.4): mares and stallions breed only at 3-20; at 21
 * a horse is retired and cannot breed. The same last year as the active-age
 * window in constants/horseAgePolicy.mjs.
 */
export const maxBreedingAgeYears = maxActiveAgeYears;

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
 * @param {{ sire: object, dam: object, client?: object }} params
 *   `client` may be a transaction client so the breed read joins the caller's tx.
 * @returns {Promise<{ ok: true }
 *   | { ok: false, status: 400 | 500, message: string, kind: 'sire' | 'mare' | 'pair' | 'server' }>}
 */
export async function validateBreedingPair({ sire, dam, client = prisma }) {
  // Health gate (Equoria-2e7e, Equoria-u0jop): both horses Fair or better.
  if (hasBadHealth(sire)) {
    logger.info(`[breedingPairRules] Rejected: sire ${sire.id} is in Bad health`);
    return refuse(400, badHealthMessage(sire.name, 'breed'), 'sire');
  }
  if (hasBadHealth(dam)) {
    logger.info(`[breedingPairRules] Rejected: dam ${dam.id} is in Bad health`);
    return refuse(400, badHealthMessage(dam.name, 'breed'), 'mare');
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

  // Guard 3: breeding age window, 3-20 game-years inclusive (3 game-years = 21
  // real days; owner ruling 2026-10-23 closes the top at 20 for both sexes).
  // Uses horseAge.mjs date-only, Eastern game clock arithmetic (Equoria-vdw5) — never inline math.
  const sireAgeYears = getHorseAgeYears(sire.dateOfBirth);
  if (sireAgeYears < minBreedingAgeYears) {
    return refuse(
      400,
      `${sire.name} is too young to breed (${sireAgeYears} game-year(s); minimum is ${minBreedingAgeYears})`,
      'sire',
    );
  }
  if (sireAgeYears > maxBreedingAgeYears) {
    return refuse(
      400,
      `${sire.name} is retired and can no longer breed (${sireAgeYears} game-years; horses breed until ${maxBreedingAgeYears})`,
      'sire',
    );
  }
  const damAgeYears = getHorseAgeYears(dam.dateOfBirth);
  if (damAgeYears < minBreedingAgeYears) {
    return refuse(
      400,
      `${dam.name} is too young to breed (${damAgeYears} game-year(s); minimum is ${minBreedingAgeYears})`,
      'mare',
    );
  }
  if (damAgeYears > maxBreedingAgeYears) {
    return refuse(
      400,
      `${dam.name} is retired and can no longer breed (${damAgeYears} game-years; horses breed until ${maxBreedingAgeYears})`,
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

  // ── SAME BREED, AND THE FOAL'S BREED (Equoria-5nwwf; Equoria-6w3ur) ──────
  // Owner ruling (Stacey, 2026-10-20): sire and dam must be the same breed and
  // the foal is born that breed. There is no caller-chosen breed and no
  // authorised-crossbreed exception. Because Gaited is inherited only through
  // the breed, this rule also keeps Gaited inside its breed.
  //
  // The foal's breed must also be one foaling can build: a null, unknown or
  // profile-less breed would make the foaling job throw SEVEN DAYS LATER and
  // retry forever (a permanently stuck pregnancy), so it is refused here,
  // BEFORE any claim stamps the cooldown.
  const foalBreedId = dam.breedId ?? null;
  if (!Number.isInteger(foalBreedId) || foalBreedId <= 0) {
    logger.info(`[breedingPairRules] Rejected: dam ${dam.id} has no breed on record`);
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

  if (sire.breedId !== foalBreedId) {
    logger.info(
      `[breedingPairRules] Rejected: sire ${sire.id} (breed ${sire.breedId ?? 'none'}) and dam ${dam.id} (breed ${foalBreedId}) are different breeds`,
    );
    return refuse(
      400,
      `${dam.name} and ${sire.name} are not the same breed. A mare and stallion must be the same breed to breed.`,
      'pair',
    );
  }

  const breedRecord = await client.breed.findUnique({
    where: { id: foalBreedId },
    select: { name: true },
  });
  if (!breedRecord?.name) {
    return refuse(400, `No breed found for id ${foalBreedId}`, 'pair');
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
        `[breedingPairRules] Breed profile source unavailable while checking breed ${foalBreedId} ("${breedRecord.name}") — ${profileError.message}`,
      );
      return refuse(
        500,
        'Breed data is unavailable right now, so breeding cannot start. Try again later.',
        'server',
      );
    }

    logger.error(
      `[breedingPairRules] Rejected: breed ${foalBreedId} ("${breedRecord.name}") has no usable breed profile — ${profileError.message}`,
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

  return { ok: true };
}

/**
 * The column values the guarded pregnancy claim writes on the dam. Everything
 * that must happen exactly once per pregnancy rides on that ONE statement:
 * the claim itself, the sire, the empty per-tier feed counters, the cooldown
 * stamp (date-only column: the Eastern date) and the pending foal name. The
 * foal's breed is NOT stored: it is always the parents' breed, read at foaling
 * (Equoria-5nwwf).
 *
 * @param {{ sireId: number, name?: string | null, now: Date }} params
 */
export function pregnancyClaimData({ sireId, name, now }) {
  return {
    inFoalSinceDate: now,
    pregnancySireId: sireId,
    pregnancyFeedingsByTier: {},
    lastBredDate: gameCalendarDate(now),
    pendingFoalName: name ?? null,
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
  // Case-insensitive, as next-actions reads sex (Equoria-kha18 review).
  if (String(horse?.sex).toLowerCase() !== 'mare' || !horse.lastBredDate) {
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
