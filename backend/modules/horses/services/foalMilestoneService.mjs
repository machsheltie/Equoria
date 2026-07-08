/**
 * foalMilestoneService (BB.3 — Equoria-oey96.18)
 *
 * DETECTION + PERSISTENCE of foal developmental milestones. This is the
 * write/detection half of BB.3; the read half (surfacing the persisted store
 * as Array<{ id, timestamp }> on GET /foals/:id/development) shipped in
 * Equoria-oey96.17 (foalModel.getFoalDevelopment / toCompletedMilestonesArray).
 *
 * The store is the EXISTING `FoalDevelopment.completedMilestones` JSONB column
 * (schema default `"{}"`). No migration is required — the column already
 * exists and oey96.17 already reads it; this module is what finally WRITES it
 * from real gameplay state. Storage shape (unchanged from oey96.17's read
 * contract): a JSONB map `{ <milestoneId>: <ISO timestamp> }`. Because the
 * store is keyed by milestone id, a milestone is STRUCTURALLY unable to appear
 * twice — idempotency is guaranteed by construction, and `detect*` only ever
 * ADDS a key when it is absent, preserving the original achievement timestamp.
 *
 * Canonical milestone ids (docs/epics.md BB.3):
 *   bond-25 / bond-50 / bond-75 / bond-100  — Horse.bondScore crosses a threshold
 *   stage-weanling / stage-yearling / stage-two-year-old — foal enters an age stage
 *   graduation      — foal reaches age 3 game-years (21 real days)
 *   first-trait     — the foal's first epigenetic trait is discovered/expressed
 *
 * CADENCE — GAME-YEAR CLOCK (Equoria-oey96.16): the stage/graduation day
 * boundaries are the SAME real-day boundaries computeAgeStage uses; they are
 * imported from foalAgeUtils (single source of truth) so this detector can
 * never drift from the stage computation.
 *
 * BOND SOURCE — `Horse.bondScore` (NOT `FoalDevelopment.bondingLevel`). This is
 * deliberate: the product decision behind Equoria-507mt/g89vy set bond to start
 * at 0 ("unbonded — earned via grooming") and built the current enrichment path
 * on `Horse.bondScore`. The legacy `FoalDevelopment.bondingLevel` still carries
 * a @default(50) — counting it would falsely fire bond-25 AND bond-50 on every
 * fresh foal the moment its development row is created. `Horse.bondScore`'s
 * @default(0) makes the empty state honest.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import {
  STAGE_WEANLING_MIN_DAYS,
  STAGE_YEARLING_MIN_DAYS,
  STAGE_TWO_YEAR_OLD_MIN_DAYS,
  STAGE_GRADUATION_DAYS,
} from '../../../utils/foalAgeUtils.mjs';

// Bond thresholds → canonical milestone id (docs/epics.md BB.3).
export const BOND_MILESTONE_THRESHOLDS = Object.freeze([
  Object.freeze({ id: 'bond-25', threshold: 25 }),
  Object.freeze({ id: 'bond-50', threshold: 50 }),
  Object.freeze({ id: 'bond-75', threshold: 75 }),
  Object.freeze({ id: 'bond-100', threshold: 100 }),
]);

// Age-stage entry milestones → the real-day boundary at which the foal ENTERS
// that stage. Boundaries come from foalAgeUtils so they can never drift from
// computeAgeStage (Equoria-oey96.16).
export const STAGE_MILESTONES = Object.freeze([
  Object.freeze({ id: 'stage-weanling', minDays: STAGE_WEANLING_MIN_DAYS }),
  Object.freeze({ id: 'stage-yearling', minDays: STAGE_YEARLING_MIN_DAYS }),
  Object.freeze({ id: 'stage-two-year-old', minDays: STAGE_TWO_YEAR_OLD_MIN_DAYS }),
]);

export const GRADUATION_MILESTONE_ID = 'graduation';
export const FIRST_TRAIT_MILESTONE_ID = 'first-trait';

/**
 * Four-part JSONB guard (CONTRIBUTING.md § JSONB): Prisma returns JSONB as a
 * value that may be null / a primitive / an array / an object. Return a fresh
 * plain object copy of the milestone store, or `{}` for any non-object shape.
 *
 * @param {import('@prisma/client').Prisma.JsonValue} store
 * @returns {Record<string, unknown>}
 */
function readMilestoneStore(store) {
  if (store === null || store === undefined || typeof store !== 'object' || Array.isArray(store)) {
    return {};
  }
  return { ...store };
}

/**
 * Whether the foal has at least one DISCOVERED/expressed epigenetic trait.
 *
 * Two real, persisted representations count as "discovered":
 *   - `epigeneticFlags` (String[]) — flags expressed through foal care (empty
 *     at birth; a non-empty list means care applied a real flag).
 *   - `epigeneticModifiers.positive` / `.negative` — VISIBLE (revealed) traits.
 *     `hidden` is intentionally excluded — a hidden trait is not yet discovered.
 *
 * @param {{ epigeneticFlags?: unknown, epigeneticModifiers?: unknown }} horse
 * @returns {boolean}
 */
function hasDiscoveredEpigeneticTrait(horse) {
  if (Array.isArray(horse.epigeneticFlags) && horse.epigeneticFlags.length > 0) {
    return true;
  }
  const mods = horse.epigeneticModifiers;
  if (mods !== null && mods !== undefined && typeof mods === 'object' && !Array.isArray(mods)) {
    const positive = Array.isArray(mods.positive) ? mods.positive : [];
    const negative = Array.isArray(mods.negative) ? mods.negative : [];
    if (positive.length > 0 || negative.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * PURE detection: given the foal's real state, return the ids of every
 * milestone the foal has REACHED (regardless of whether it is already
 * recorded). The caller decides which of these are new.
 *
 * @param {{ ageDays: number, bondScore: number, hasDiscoveredTrait: boolean }} state
 * @returns {string[]}
 */
export function computeReachedMilestones({ ageDays, bondScore, hasDiscoveredTrait }) {
  const reached = [];

  for (const { id, threshold } of BOND_MILESTONE_THRESHOLDS) {
    if (bondScore >= threshold) {
      reached.push(id);
    }
  }

  for (const { id, minDays } of STAGE_MILESTONES) {
    if (ageDays >= minDays) {
      reached.push(id);
    }
  }

  if (ageDays >= STAGE_GRADUATION_DAYS) {
    reached.push(GRADUATION_MILESTONE_ID);
  }

  if (hasDiscoveredTrait) {
    reached.push(FIRST_TRAIT_MILESTONE_ID);
  }

  return reached;
}

/**
 * Detect the foal's currently-reached milestones from REAL persisted state and
 * append any that are not already recorded to `FoalDevelopment.completedMilestones`.
 *
 * EXACTLY-ONCE: the store is a JSONB object keyed by milestone id, and a key is
 * only written when absent (its original timestamp is preserved). Re-running on
 * unchanged state is a pure no-op (no keys added, no write) — a milestone can
 * never be celebrated twice.
 *
 * The read+merge+write runs inside a single transaction that RE-READS the store
 * so a concurrent writer's already-recorded milestones are merged, not clobbered.
 * Uses `upsert` so the enrichment write path (which never touches
 * FoalDevelopment) still gets a row created on first milestone.
 *
 * Server-side timestamps only (never client-supplied).
 *
 * @param {number|string} foalId
 * @param {{ now?: Date, client?: import('@prisma/client').PrismaClient }} [opts]
 * @returns {Promise<{ newMilestones: string[], completedMilestones: Record<string, unknown> }>}
 */
export async function detectAndRecordFoalMilestones(
  foalId,
  { now = new Date(), client = prisma } = {},
) {
  const parsedFoalId = parseInt(foalId, 10);
  if (!Number.isInteger(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }

  const horse = await client.horse.findUnique({
    where: { id: parsedFoalId },
    select: {
      id: true,
      dateOfBirth: true,
      bondScore: true,
      epigeneticFlags: true,
      epigeneticModifiers: true,
    },
  });

  if (!horse) {
    throw new AppError('Foal not found', 404);
  }

  const reached = computeReachedMilestones({
    ageDays: getHorseAgeDays(horse.dateOfBirth, now),
    bondScore: horse.bondScore ?? 0,
    hasDiscoveredTrait: hasDiscoveredEpigeneticTrait(horse),
  });

  const timestamp = now.toISOString();

  return client.$transaction(async tx => {
    const dev = await tx.foalDevelopment.findUnique({
      where: { foalId: parsedFoalId },
      select: { completedMilestones: true },
    });

    const store = readMilestoneStore(dev?.completedMilestones);
    const newMilestones = [];

    for (const id of reached) {
      if (!Object.prototype.hasOwnProperty.call(store, id)) {
        store[id] = timestamp;
        newMilestones.push(id);
      }
    }

    if (newMilestones.length === 0) {
      // Idempotent no-op: nothing new to record, so no write at all.
      return { newMilestones, completedMilestones: store };
    }

    await tx.foalDevelopment.upsert({
      where: { foalId: parsedFoalId },
      create: { foalId: parsedFoalId, completedMilestones: store },
      update: { completedMilestones: store },
    });

    logger.info(
      `[foalMilestoneService] Recorded foal ${parsedFoalId} milestones: ${newMilestones.join(', ')}`,
    );

    return { newMilestones, completedMilestones: store };
  });
}
