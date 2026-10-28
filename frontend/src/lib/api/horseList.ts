/**
 * The horse list's own types (Equoria-apik2). They live beside types.ts, not in it:
 * types.ts is at its file-size limit.
 */

import type { HorseSummary } from './types.js';

/**
 * One horse as `GET /api/v1/horses` (the list) sends it (Equoria-apik2).
 *
 * The list serializer (backend/modules/horses/routes/horseRoutes.mjs over
 * HORSE_LIST_SELECT in services/horseRouteQueries.mjs) sends a narrower row than
 * the detail read: no nested `stats`, no `disciplineScores`, no `gender`, `level`,
 * `description`, `traits`, `parentIds` or `tack`, and none of the other
 * detail-only care/pregnancy fields. It does send `imageUrl`, `lastShod` and
 * `trainingCooldown` (Equoria-9spb2, owner ruling 2026-10-23): the stable list
 * view's portrait, Shod chip and Cooldown column read them. It sends
 * `lastGroomed` (Equoria-y9kdl): the Needs Care counts read it. Typing the list as HorseSummary let a list
 * consumer read any of those and get a silent `undefined`. The list is its own
 * type so a read of an absent field fails the type check.
 *
 * It is HorseSummary less what the list does not carry; every remaining field has
 * the type the detail read gives it.
 */
export type HorseListItemDto = Omit<
  HorseSummary,
  | 'stats'
  | 'disciplineScores'
  | 'gender'
  | 'level'
  | 'description'
  | 'traits'
  | 'parentIds'
  | 'tack'
  | 'earnings'
  | 'equippedFeedType'
  | 'pregnancySireId'
  | 'pregnancyFeedingsByTier'
>;

/**
 * A horse a card or row renders, whether it came from the list or the detail
 * read (Equoria-apik2). The list item plus the fields only the detail read
 * carries, optional: a card fed by the list gets none of them, so it must (and
 * HorseCard, Index and the tack shop do) handle their absence.
 */
export type HorseCardData = HorseListItemDto & Partial<Omit<HorseSummary, keyof HorseListItemDto>>;
