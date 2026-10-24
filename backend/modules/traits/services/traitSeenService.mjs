/**
 * Per-viewer "seen" marker for the first-view trait glow (Equoria-lylhb).
 *
 * A revealed trait glows once, the first time its owner views it (owner rulings
 * 2026-10-16 and 2026-10-19). The marker is private to the viewer and lives in
 * User.settings.seenTraits, keyed by horse id, as the list of trait keys the
 * viewer has already seen. It is server-owned: the generic settings update
 * allow-list does not admit it, and it never reaches another player.
 *
 * Only revealed (public) traits are ever recorded; a hidden trait is never
 * named here.
 */

import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';

/**
 * The trait keys this viewer has already seen on one horse.
 *
 * @param {unknown} settings - User.settings (any shape; Json may be null or odd)
 * @param {number} horseId
 * @returns {Set<string>}
 */
export function seenTraitKeys(settings, horseId) {
  const doc =
    settings !== null && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const seen = doc.seenTraits;
  if (seen === null || typeof seen !== 'object' || Array.isArray(seen)) {
    return new Set();
  }
  const list = seen[String(horseId)];
  return new Set(Array.isArray(list) ? list.filter(k => typeof k === 'string') : []);
}

/**
 * Record that the viewer has now seen these (revealed) traits on this horse.
 * One atomic jsonb statement; the horse's list is rewritten with the visible
 * keys, which only ever grow (a revealed trait is public forever).
 *
 * @param {object} client - prisma or a transaction client
 * @param {string} userId
 * @param {number} horseId
 * @param {string[]} visibleKeys - the horse's revealed trait keys
 * @returns {Promise<number>} rows affected (0 when the user is gone)
 */
export async function markTraitsSeen(client, userId, horseId, visibleKeys) {
  return updateUserSettingsPaths(client, userId, {
    merge: { seenTraits: { [String(horseId)]: [...new Set(visibleKeys)] } },
  });
}
