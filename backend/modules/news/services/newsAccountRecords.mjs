/**
 * News and a player's own data (Equoria-wbt8l; security review 2026-10-23).
 *
 * - Article 17 erasure: the signature snapshot (authorName, authorRoleLabel)
 *   must not outlive the account. Inside the erasure transaction, before the
 *   user row goes, the account's posts lose their signature; the foreign key
 *   then goes NULL by itself (onDelete: SetNull). The page signs an unsigned
 *   staff post "Equoria Staff".
 */

/**
 * Inside the erasure transaction, BEFORE the user row is deleted.
 * @param {object} tx - the erasure transaction client
 * @param {string} userId
 */
export async function scrubNewsSignaturesForErasureTx(tx, userId) {
  await tx.newsItem.updateMany({
    where: { authorUserId: userId },
    data: { authorName: null, authorRoleLabel: null },
  });
}
