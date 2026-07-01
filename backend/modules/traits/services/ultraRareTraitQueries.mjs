/**
 * Ultra-rare trait route data-access helpers
 *
 * Wraps the three prisma calls used by ultraRareTraitRoutes.mjs so the
 * routes layer no longer imports prisma directly (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Event type used to persist the intentional "a lineage analysis was performed
 * for this horse's pedigree" signal (Equoria-245bt). Stored as a row in the
 * existing UltraRareTraitEvent per-horse event log (no schema migration).
 * `traitName: '_lineage_analysis'` and `traitTier: 'meta'` mark it as a
 * process/meta event rather than a trait-acquisition event, so the horse-traits
 * enrichment path (which reads the horse's ultraRareTraits JSONB, not events by
 * name) is unaffected.
 */
export const LINEAGE_ANALYSIS_EVENT_TYPE = 'lineage_analysis';

/**
 * Persist the intentional lineage-analysis signal for a horse.
 *
 * This is set from a DELIBERATE user action — running the lineage-analysis
 * compute (GET /api/breeding/lineage-analysis/:stallionId/:mareId) for a
 * horse's pedigree. It is NOT an incidental side effect of reading a horse row:
 * it only fires when the user explicitly requests a pedigree analysis for that
 * specific horse. The row is idempotent-friendly (multiple analyses simply
 * append more rows; the reveal reader only needs "does at least one exist").
 *
 * @param {number} horseId - Horse whose pedigree was analyzed
 * @param {object} [metadata] - JSONB-safe context (e.g. { pairedWith, generations })
 * @returns {Promise<object>} the created event row
 */
export async function recordLineageAnalysisPerformed(horseId, metadata = {}) {
  return prisma.ultraRareTraitEvent.create({
    data: {
      horseId,
      traitName: '_lineage_analysis',
      traitTier: 'meta',
      eventType: LINEAGE_ANALYSIS_EVENT_TYPE,
      triggerConditions: metadata,
      success: true,
      notes: 'Lineage analysis performed for horse pedigree',
    },
  });
}

/**
 * Persist the intentional lineage-analysis signal for BOTH horses of an analyzed
 * breeding pair (Equoria-245bt). Best-effort + logged: a signal-write failure
 * must never fail the caller's primary lineage-analysis response.
 *
 * @param {number} stallionId
 * @param {number} mareId
 * @param {number} generations - pedigree depth analyzed
 */
export async function recordLineageAnalysisForPair(stallionId, mareId, generations) {
  try {
    await Promise.all([
      recordLineageAnalysisPerformed(stallionId, {
        pairedWith: mareId,
        generations,
        role: 'stallion',
      }),
      recordLineageAnalysisPerformed(mareId, { pairedWith: stallionId, generations, role: 'mare' }),
    ]);
  } catch (err) {
    logger.error(
      `[ultraRareTraitQueries.recordLineageAnalysisForPair] signal persist failed: ${err.message}`,
    );
  }
}

/**
 * Query whether an intentional lineage analysis has ever been performed for a
 * horse's pedigree. Sources the `conditions.lineageAnalysisPerformed` signal
 * that flows into the rare-trait perk reveal (Equoria-245bt).
 *
 * @param {number} horseId
 * @returns {Promise<boolean>} true if at least one lineage-analysis event exists
 */
export async function hasLineageAnalysisBeenPerformed(horseId) {
  const existing = await prisma.ultraRareTraitEvent.findFirst({
    where: { horseId, eventType: LINEAGE_ANALYSIS_EVENT_TYPE },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Record an `ultraRareTraitEvent` row for a single evaluation result.
 *
 * @param {object} params
 * @param {number} params.horseId
 * @param {{ name: string, tier: string, baseChance?: number }} params.result
 * @param {object} params.evaluationContext - JSONB-safe context object
 */
export async function logUltraRareTraitEvaluation({ horseId, result, evaluationContext }) {
  return prisma.ultraRareTraitEvent.create({
    data: {
      horseId,
      traitName: result.name,
      traitTier: result.tier,
      eventType: 'evaluation_triggered',
      baseChance: result.baseChance || null,
      finalChance: result.baseChance || null, // Would be modified by groom perks
      triggerConditions: evaluationContext,
      success: true,
      notes: `Trait ${result.tier} evaluation completed`,
    },
  });
}

/**
 * Fetch the horse row + recent ultraRareTraitEvents needed by the
 * `GET /api/ultra-rare-traits/horse/:horseId` response. Returns `null`
 * if the row no longer exists (e.g. deleted after middleware ran).
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export async function getHorseWithUltraRareTraits(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      ultraRareTraits: true,
      ultraRareTraitEvents: {
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Fetch the groom row needed by the rare-trait perk assignment endpoint.
 * Returns `null` if the row no longer exists.
 *
 * @param {number} groomId
 * @returns {Promise<object|null>}
 */
export async function getGroomForRareTraitPerks(groomId) {
  return prisma.groom.findUnique({
    where: { id: groomId },
    select: {
      id: true,
      name: true,
      experience: true,
      personality: true,
      epigeneticInfluenceType: true,
      bonusTraitMap: true,
    },
  });
}
