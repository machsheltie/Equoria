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
 * Every write here commits or rolls back together, and the score gain is an
 * in-database increment on the committed row value. The caller computes all
 * inputs (modifiers, XP amount) before calling. Training never writes a horse
 * stat (owner rulings 2026-10-19 and 2026-10-21).
 */
import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { addXpToUserCore } from '../../users/index.mjs';
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
}) {
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

        // disciplineScores[discipline] += increase, on the committed value.
        // A non-object column (null / array / scalar) starts from {} — the
        // same four-part guard asFlagObject applies on the read side.
        // RETURNING gives the score this increment produced, so the session's
        // log row records the real before/after pair (Equoria-ky2ob).
        const [scoreRow] = await tx.$queryRaw(Prisma.sql`
          UPDATE "horses" SET "disciplineScores" = jsonb_set(
            CASE WHEN jsonb_typeof("disciplineScores") = 'object' THEN "disciplineScores" ELSE '{}'::jsonb END,
            ARRAY[${discipline}]::text[],
            to_jsonb(COALESCE(("disciplineScores" ->> ${discipline})::numeric, 0) + ${disciplineScoreIncrease}),
            true)
          WHERE "id" = ${horseId}
          RETURNING ("disciplineScores" ->> ${discipline})::numeric AS "scoreAfter"`);

        // The columns hold whole scores; a legacy fractional score is not
        // representable, so that session records no pair rather than a
        // rounded one.
        const after = Number(scoreRow?.scoreAfter);
        const before = after - disciplineScoreIncrease;
        const recorded = Number.isInteger(after) && Number.isInteger(before);

        const trainingLog = await tx.trainingLog.create({
          data: {
            horseId,
            discipline,
            trainedAt: new Date(),
            scoreBefore: recorded ? before : null,
            scoreAfter: recorded ? after : null,
          },
        });

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
