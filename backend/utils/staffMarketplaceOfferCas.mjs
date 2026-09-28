/**
 * Compare-and-swap removal of one offer from `staff_marketplace_state.offers`
 * (Equoria-bvddn.19 — groom/rider/trainer hires removed the offer OUTSIDE the
 * hire transaction, using an offer list read before it).
 *
 * ── The defect this exists to close ─────────────────────────────────────────
 * Every hire controller used to run its whole `$transaction` (create the
 * staff row, debit money, write the ledger row) and only AFTER it committed,
 * separately, do:
 *
 *     const updatedOffers = offers.filter((_, i) => i !== index);
 *     await prisma.staffMarketplaceState.update({ ..., data: { offers: updatedOffers } });
 *
 * `offers` there is the list read before the hire transaction even opened.
 * Two concurrent hires of the SAME offer both pass their own pre-tx read,
 * both open a hire transaction, both commit (nothing in either transaction
 * touched the offer list), and both then write `offers.filter(...)` computed
 * from their own stale snapshot — the second writer's filter simply omits a
 * DIFFERENT index than the first believes it removed, so the offer the first
 * writer "removed" reappears. Both buyers are charged for the same offer, and
 * hiring two DIFFERENT offers concurrently can resurrect one already hired by
 * a third request in between, because the last writer's stale snapshot wins.
 *
 * ── The mechanism ────────────────────────────────────────────────────────────
 * A single UPDATE whose WHERE clause pins the offer list to the EXACT value
 * this caller read (`"offers" = expected::jsonb`), run inside the SAME hire
 * `$transaction` as the money debit and the staff-row create. jsonb equality
 * is Postgres's own canonical structural comparison (order-independent for
 * object keys, so a decode/reencode round trip cannot cause a false
 * mismatch), and the UPDATE's own row lock is all the concurrency control
 * needed — no SELECT ... FOR UPDATE. If a concurrent request already changed
 * the row (hired the same offer, hired a different offer, or refreshed the
 * marketplace) since this caller's read, zero rows match and the caller MUST
 * treat that as a conflict and roll the whole hire back: no staff row, no
 * charge, no ledger entry, surfaced as 409. This is the same primitive
 * `updateUserSettingsPaths` (backend/utils/userSettingsPaths.mjs) uses for
 * `User.settings` — a different table here (`staff_marketplace_state` has no
 * sub-path structure; the whole `offers` column is being compare-and-swapped)
 * but the same idiom: bind the caller's stale-or-fresh read as the
 * precondition, never trust it as the current truth.
 *
 * @module utils/staffMarketplaceOfferCas
 */

import { Prisma } from '../../packages/database/prismaClient.mjs';

/**
 * Remove one offer from a user's persisted marketplace offer list, but only
 * if the list still equals the snapshot the caller read before the hire
 * transaction opened.
 *
 * @param {object} client - MUST be the interactive transaction client (`tx`)
 *   for the surrounding hire `$transaction` — passing the bare `prisma`
 *   singleton would run this CAS outside the transaction it exists to
 *   protect, reintroducing the exact defect this closes.
 * @param {object} options
 * @param {string} options.userId
 * @param {string} options.staffType - 'groom' | 'rider' | 'trainer'
 * @param {unknown[]} options.expectedOffers - The offer array exactly as read
 *   before the hire transaction opened (the precondition).
 * @param {unknown[]} options.updatedOffers - `expectedOffers` with the hired
 *   offer removed — what gets written when the precondition still holds.
 * @returns {Promise<number>} Rows affected: 1 on success, 0 when the row does
 *   not exist or the offer list no longer matches `expectedOffers`. Callers
 *   MUST check this and roll back (throw) on anything other than 1.
 */
export async function removeMarketplaceOfferCas(
  client,
  { userId, staffType, expectedOffers, updatedOffers },
) {
  if (!client || typeof client.$executeRaw !== 'function') {
    throw new Error('removeMarketplaceOfferCas: a Prisma client or tx client is required');
  }
  if (!userId || !staffType) {
    throw new Error('removeMarketplaceOfferCas: userId and staffType are required');
  }

  const expectedJson = JSON.stringify(expectedOffers ?? []);
  const updatedJson = JSON.stringify(updatedOffers ?? []);

  return client.$executeRaw(Prisma.sql`
    UPDATE "staff_marketplace_state"
    SET "offers" = ${updatedJson}::jsonb
    WHERE "userId" = ${userId}
      AND "staffType" = ${staffType}
      AND "offers" = ${expectedJson}::jsonb`);
}

export default removeMarketplaceOfferCas;
