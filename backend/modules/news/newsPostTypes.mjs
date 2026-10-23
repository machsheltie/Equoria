/**
 * News post types (Equoria-wbt8l, owner rulings 2026-10-23).
 *
 * NewsItem.postType is a plain string column; this file is the only list of
 * values the backend writes or accepts. Who may write each staff type is the
 * staff capability policy's decision (mayPostNewsType below).
 *
 * STAFF types — written at the News Desk. The type is chosen first and decides
 * the post's fields:
 *   seasonalEvent   'Seasonal Events'      the month's event, large format:
 *                                          title, body, up to four captioned
 *                                          image tiles; publishes at the start
 *                                          of the 1st of its month (Eastern)
 *   headAdminLetter 'From The Head Admin'  the owner's letter: title, body
 *   adminLetter     'From Admin <name>'    a regular Admin's own letter,
 *                                          signed with their name and "Admin"
 *   update          'Updates'              title, body
 *   contest         'Contests'             title, body, optional closing day
 *
 * GAME types — written by the game at the start of an Eastern game day:
 *   newItem                   'New Items'  new store items
 *   clubNews                  'Club News'  elections opening, run-off results
 *   seasonalCompetitionOpen   seasonal event competitions opening
 *   seasonalCompetitionClose  seasonal event competitions closing
 *   seasonalCraft             the month's special craft
 * The three seasonal game types will be fed by a future Head Admin scheduler
 * (not built); the nightly job posts any entries it is given through
 * postGameNewsEntries (services/dailyNewsEntries.mjs).
 */

import { can } from '../staff/index.mjs';

export const STAFF_POST_TYPES = Object.freeze([
  'seasonalEvent',
  'headAdminLetter',
  'adminLetter',
  'update',
  'contest',
]);

export const GAME_POST_TYPES = Object.freeze([
  'newItem',
  'clubNews',
  'seasonalCompetitionOpen',
  'seasonalCompetitionClose',
  'seasonalCraft',
]);

/**
 * Who may write each staff type: the staff capability policy decides
 * (modules/staff/capabilities.mjs, one `news.<postType>` capability per type;
 * owner answers 2026-10-23). Seasonal events, Head Admin letters, updates and
 * contests are the owner's (Head Admin) alone; an Admin writes only their own
 * letter ('From Admin <name>'); moderators write nothing.
 */
/** Signature role label per staff role that may post News. */
const ROLE_LABELS = Object.freeze({ owner: 'Head Admin', admin: 'Admin' });

/**
 * @param {unknown} postType
 * @returns {boolean}
 */
export function isStaffPostType(postType) {
  return STAFF_POST_TYPES.includes(postType);
}

/**
 * @param {unknown} postType
 * @returns {boolean}
 */
export function isGamePostType(postType) {
  return GAME_POST_TYPES.includes(postType);
}

/**
 * Whether an account role may write a staff post type.
 * @param {unknown} role
 * @param {unknown} postType
 * @returns {boolean}
 */
export function mayPostNewsType(role, postType) {
  return isStaffPostType(postType) && can({ role }, `news.${postType}`);
}

/**
 * Whether a role may edit or remove any staff post, not only its own.
 * @param {unknown} role
 * @returns {boolean}
 */
export function mayManageAllNews(role) {
  return can({ role }, 'news.manageAll');
}

/**
 * Whether a role may use the News Desk at all.
 * @param {unknown} role
 * @returns {boolean}
 */
export function mayUseNewsDesk(role) {
  return can({ role }, 'news.post');
}

/**
 * The staff post types a role may write, in desk order (empty for players
 * and moderators).
 * @param {unknown} role
 * @returns {string[]}
 */
export function newsTypesForRole(role) {
  return STAFF_POST_TYPES.filter(postType => mayPostNewsType(role, postType));
}

/**
 * The signature label for a role that may post News, or null.
 * @param {unknown} role
 * @returns {string|null}
 */
export function newsRoleLabel(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role] : null;
}
