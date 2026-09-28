/**
 * The write side of one training session, as a single transaction
 * (Equoria-bvddn.17).
 *
 * A training session used to be separate autocommit writes (cooldown claim,
 * TrainingLog insert, a read-then-write of the discipline score, a
 * read-then-write of the gained stat, and the owner XP award), so a failure
 * part-way spent the week's cooldown with no gain, and a concurrent stat write
 * (e.g. a show payout) was overwritten by training's stale absolute value.
 *
 * Every write here commits or rolls back together, and the score and stat
 * gains are in-database increments on the committed row value. The caller
 * computes all inputs (modifiers, RNG rolls, XP amount) before calling.
 */
import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { addXpToUserCore } from '../../users/index.mjs';
import { HORSE_STAT_VALUES } from '../../../constants/schema.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';

// Thrown inside the transaction when the atomic cooldown claim loses the race,
// so every write already made in it rolls back; caught by identity below.
const COOLDOWN_CLAIM_LOST = Symbol('trainingCooldownClaimLost');

/**
 * @param {object} p
 * @param {number} p.horseId - parsed integer horse id
 * @param {string|null} p.ownerId - user to receive XP (null: no XP award)
 * @param {string} p.horseName
 * @param {string} p.discipline
 * @param {number} p.xpAmount - owner XP (>= 1)
 * @param {Date} p.cooldownNow - claim succeeds if trainingCooldown is null or <= this
 * @param {Date} p.nextEligible - the new trainingCooldown value
 * @param {number} p.disciplineScoreIncrease
 * @param {{stat:string, amount:number}|null} p.statGain
 * @returns {Promise<{trainingLog:object, updatedHorse:object, xpCore:object|null}|null>}
 *   null when the cooldown claim lost (nothing was written).
 */
export async function commitTrainingSession({
  horseId,
  ownerId,
  horseName,
  discipline,
  xpAmount,
  cooldownNow,
  nextEligible,
  disciplineScoreIncrease,
  statGain,
}) {
  // The stat column name is interpolated as an SQL identifier, so it must be a
  // real horse stat (the caller's map is hardcoded, but fail closed).
  if (statGain && !HORSE_STAT_VALUES.includes(statGain.stat)) {
    throw new Error(`Invalid stat name: ${statGain.stat}`);
  }

  try {
    return await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        // Lock order User -> Horse (codebase convention). The owner XP award is
        // part of the same session (Equoria-jvi3u's tx-aware core), so it is
        // written FIRST: if the cooldown claim then loses, or any later write
        // fails, the XP and its audit row roll back with everything else.
        let xpCore = null;
        if (ownerId) {
          xpCore = await addXpToUserCore(
            tx,
            ownerId,
            xpAmount,
            `Trained horse ${horseName} in ${discipline}`,
          );
        }

        // Equoria-0ihyi: atomic cooldown claim. Only the first racer flips
        // trainingCooldown forward and gets count===1; a loser rolls back.
        const claim = await tx.horse.updateMany({
          where: {
            id: horseId,
            OR: [{ trainingCooldown: null }, { trainingCooldown: { lte: cooldownNow } }],
          },
          data: { trainingCooldown: nextEligible },
        });
        if (claim.count === 0) {
          throw COOLDOWN_CLAIM_LOST;
        }

        const trainingLog = await tx.trainingLog.create({
          data: { horseId, discipline, trainedAt: new Date() },
        });

        // disciplineScores[discipline] += increase, on the committed value.
        // A non-object column (null / array / scalar) starts from {} — the
        // same four-part guard asFlagObject applies on the read side.
        await tx.$executeRaw(Prisma.sql`
          UPDATE "horses" SET "disciplineScores" = jsonb_set(
            CASE WHEN jsonb_typeof("disciplineScores") = 'object' THEN "disciplineScores" ELSE '{}'::jsonb END,
            ARRAY[${discipline}]::text[],
            to_jsonb(COALESCE(("disciplineScores" ->> ${discipline})::numeric, 0) + ${disciplineScoreIncrease}),
            true)
          WHERE "id" = ${horseId}`);

        if (statGain) {
          // stat += amount, capped at 100 in the database; a stat already at
          // or above 100 is left untouched (never lowered).
          const statCol = Prisma.raw(`"${statGain.stat}"`);
          await tx.$executeRaw(Prisma.sql`
            UPDATE "horses"
            SET ${statCol} = CASE WHEN ${statCol} >= 100 THEN ${statCol}
                                  ELSE LEAST(${statCol} + ${statGain.amount}, 100) END
            WHERE "id" = ${horseId}`);
        }

        const updatedHorse = await tx.horse.findUnique({
          where: { id: horseId },
          include: { breed: true, user: true, stable: true },
        });

        return { trainingLog, updatedHorse, xpCore };
      }),
      { message: 'The stable is busy right now, please try training again in a moment.' },
    );
  } catch (txError) {
    if (txError === COOLDOWN_CLAIM_LOST) {
      return null;
    }
    throw txError;
  }
}
