/**
 * What a birth writes about itself, inside the foaling transaction
 * (split from foalingService.mjs to keep it under the 600-line cap).
 *
 * - foalBornPayload: the foalBorn notification's payload (the notice links the
 *   foal's name to its horse page, Equoria-nzl9e).
 * - linkBreedingRecordToFoalTx: the breeding record names its foal (Equoria-wnlf0).
 *
 * @module modules/horses/services/foalBirthRecords
 */

/** The foalBorn notification payload. */
export function foalBornPayload(foal, dam, sire) {
  return { foalName: foal.name, foalId: foal.id, damName: dam.name, sireName: sire.name };
}

/**
 * Equoria-wnlf0 (audit BRE-11): name the foal on the breeding that made it — the
 * dam's latest COMPLETED record for this sire with no foal yet (written at
 * conception by an own pair, a public booking or an approved private request).
 * A pregnancy older than breeding records has none; then nothing is linked.
 * Runs inside the foaling transaction, after the dam's row is claimed.
 */
export async function linkBreedingRecordToFoalTx(tx, { damId, sireId, foalId }) {
  const record = await tx.breedingRecord.findFirst({
    where: { damId, sireId, status: 'COMPLETED', foalId: null },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  if (record) {
    await tx.breedingRecord.update({ where: { id: record.id }, data: { foalId } });
  }
}
