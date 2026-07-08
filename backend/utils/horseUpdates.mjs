import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';

// Equoria-709qm (slice 2): updateHorseEarnings + updateHorseRewards were removed
// here. They were legacy non-ledger money/earnings writers whose last production
// consumer (enterAndRunShow) was retired in slice 1 (commit cc0e2987b). They
// bypassed the atomic-predicate + ledger-row + SystemAccount-pairing invariant
// the economy layer now enforces, so leaving them exported invited a future
// feature to silently reintroduce the pre-hjzwt/kl16c unpaired-write defect class.
// Their absence is guarded by
// backend/__tests__/scripts/legacyMoneyWriterRemoved.sentinel.test.mjs.
//
// updateHorseStat remains ONLY because it is out of that slice's named scope
// (it is a stat writer, not a money writer). NOTE: it is itself now a
// production-orphan — a duplicate of the live horseModelService.updateHorseStat
// (re-exported via modules/horses/index.mjs, used by trainingController). Its
// removal is tracked separately as Equoria-rtw4h rather than bundled into the
// money-writer slice.

/**
 * Update horse stat after competition win
 * @param {number} horseId - Horse ID
 * @param {string} statName - Name of stat to increase
 * @param {number} increase - Amount to increase (default 1)
 * @returns {Object} - Updated horse object
 */
async function updateHorseStat(horseId, statName, increase = 1) {
  if (!horseId || typeof horseId !== 'number' || horseId <= 0) {
    throw new Error('Valid horse ID is required');
  }

  if (!statName || typeof statName !== 'string') {
    throw new Error('Valid stat name is required');
  }

  if (!increase || typeof increase !== 'number' || increase <= 0) {
    throw new Error('Valid increase amount is required');
  }

  // Validate stat name
  const validStats = [
    'speed',
    'stamina',
    'agility',
    'balance',
    'precision',
    'intelligence',
    'boldness',
    'flexibility',
    'obedience',
    'focus',
  ];

  if (!validStats.includes(statName)) {
    throw new Error(`Invalid stat name: ${statName}. Must be one of: ${validStats.join(', ')}`);
  }

  // Build dynamic update object
  const updateData = {
    [statName]: {
      increment: increase,
    },
  };

  const updatedHorse = await prisma.horse.update({
    where: { id: horseId },
    data: updateData,
    include: {
      breed: true,
      user: true,
      stable: true,
    },
  });

  logger.info(
    `[horseUpdates.updateHorseStat] Updated horse ${horseId} ${statName} by +${increase} (new value: ${updatedHorse[statName]})`,
  );
  return updatedHorse;
}

export { updateHorseStat };
