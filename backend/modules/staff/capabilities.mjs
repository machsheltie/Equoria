/**
 * Staff capability map and actionable-target guard (Equoria-puj1e.2)
 *
 * Pure policy: no database access. Callers pass the actor id and the target
 * user record; this module decides whether the staff action may proceed.
 *
 * Owner ruling 2026-10-23 (Equoria-4tleh): three staff levels, held in the
 * existing `User.role` string — `owner` (Head Admin, the project owner),
 * `admin`, `moderator`. The owner holds every admin capability plus the
 * owner-only ones. Only the owner and admins use the News Desk (`news.post`);
 * only the owner sees hidden traits (`traits.hidden.view`).
 *
 * News post types (owner answers 2026-10-23, Equoria-wbt8l): one capability
 * per staff-written type, `news.<postType>`. Seasonal events, Head Admin
 * letters, updates and contests are the owner's alone; an Admin writes their
 * own letter (`news.adminLetter`, which the owner also holds as an admin
 * capability); moderators write nothing. `news.manageAll` lets the owner edit
 * or remove any staff post, not only her own. This module is the single
 * policy: staff routes ask through requireStaffCapability, the legacy admin
 * gates through satisfiesRole (requireRole in middleware/auth.mjs) and inline
 * checks through can().
 */

import AppError from '../../errors/AppError.mjs';

export const STAFF_ROLES = Object.freeze(['moderator', 'admin', 'owner']);
/** camelCase name for the same frozen list (Equoria-pjvp8 naming). */
export const staffRoles = STAFF_ROLES;

const MODERATOR = [
  'warn',
  'freeze',
  'ban.account',
  // Owner ruling 2026-10-23 (Equoria-i1hgt): moderators may also issue IP and
  // device bans; admins and the owner inherit them from this list.
  'ban.ip',
  'ban.device',
  'rename',
  'post.moderate',
  'post.review',
  'ticket.file',
  'log.view.own',
];
const adminOnly = [
  'ticket.resolve',
  'log.view.all',
  'view.identity',
  'roles.manage',
  'jobs.hold',
  'time-back',
  'horse.admin',
  'news.post',
  'news.adminLetter',
  // Equoria-c7mx0.1 (owner ruling 2026-10-23): quarantined shows are listed for
  // the Owner/Admin to resolve.
  'shows.quarantine.view',
  // Equoria-4q02c (owner ruling q01): a show entry's recorded luck roll and
  // score inputs are for the Owner and Admins only, never moderators or players.
  'results.scoreInputs.view',
];
const ownerOnly = [
  // Only the owner appoints admins, in the Steward's Office (Equoria-i1hgt).
  'roles.appointAdmin',
  'traits.hidden.view',
  'news.seasonalEvent',
  'news.headAdminLetter',
  'news.update',
  'news.contest',
  'news.manageAll',
];

// Private and frozen (STAFF-CR-12): no importer can reach a mutable copy of
// the policy. Callers ask through hasCapability and capabilitiesFor only.
const ADMIN = [...MODERATOR.filter(c => c !== 'ticket.file'), ...adminOnly];
const ROLE_CAPABILITIES = Object.freeze({
  moderator: Object.freeze([...MODERATOR]),
  admin: Object.freeze([...ADMIN]),
  owner: Object.freeze([...ADMIN, ...ownerOnly]),
});

/** The role's own frozen list, or null. Inherited keys are never roles. */
function listFor(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_CAPABILITIES, role)
    ? ROLE_CAPABILITIES[role]
    : null;
}

/**
 * True only for the three staff roles. Never throws.
 * @param {unknown} role
 * @returns {boolean}
 */
export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

/**
 * Whether a role holds a capability. Unknown roles and unknown capabilities
 * return false. Only own properties are consulted, so inherited keys such as
 * 'constructor' or '__proto__' are never treated as roles.
 * @param {unknown} role
 * @param {unknown} cap
 * @returns {boolean}
 */
export function hasCapability(role, cap) {
  return listFor(role)?.includes(cap) ?? false;
}

/**
 * A fresh frozen copy of a role's capabilities; empty for any other role.
 * @param {unknown} role
 * @returns {readonly string[]}
 */
export function capabilitiesFor(role) {
  return Object.freeze([...(listFor(role) ?? [])]);
}

/**
 * Whether an account (anything with a `role`, e.g. `req.user`) holds a
 * capability. Missing accounts and roles fail closed.
 * @param {{ role?: unknown } | null | undefined} user
 * @param {unknown} cap
 * @returns {boolean}
 */
export function can(user, cap) {
  return hasCapability(user?.role, cap);
}

/**
 * The staff roles holding a capability, in STAFF_ROLES order (frozen).
 * @param {unknown} cap
 * @returns {readonly string[]}
 */
export function rolesWithCapability(cap) {
  return Object.freeze(STAFF_ROLES.filter(role => hasCapability(role, cap)));
}

/**
 * Whether an account's role satisfies a required role (requireRole): its own
 * role, or a staff role holding every capability of the required staff role.
 * So the owner passes every admin gate; no other role is widened (an admin
 * lacks ticket.file, so it does not pass a moderator gate, and nobody but the
 * owner passes an owner gate).
 * @param {unknown} role the account's role
 * @param {unknown} required the role the gate names
 * @returns {boolean}
 */
export function satisfiesRole(role, required) {
  if (typeof role !== 'string' || role === '' || typeof required !== 'string') {
    return false;
  }
  if (role === required) {
    return true;
  }
  const needed = listFor(required);
  const held = listFor(role);
  return needed !== null && held !== null && needed.every(cap => held.includes(cap));
}

/**
 * Throws 403 when a staff tool may not act on the target: the actor is the
 * target, or the target is itself a staff account.
 * @param {{ actorId: string, targetUser: { id: string, role: string } }} params
 * @returns {void}
 */
export function assertActionableTarget({ actorId, targetUser }) {
  if (targetUser.id === actorId || isStaffRole(targetUser.role)) {
    throw new AppError('Staff tools cannot act on this account', 403);
  }
}

const TARGET_REFUSALS = Object.freeze({
  owner: Object.freeze({
    code: 'STAFF_TARGET_OWNER',
    message: 'No one can act on the owner.',
  }),
  staff: Object.freeze({
    code: 'STAFF_TARGET_STAFF',
    message: 'Moderators and admins cannot act on another moderator or admin.',
  }),
  self: Object.freeze({
    code: 'STAFF_TARGET_SELF',
    message: 'You cannot act on your own account.',
  }),
});

/**
 * The refusal for a staff action on a target account, or null when the action
 * may proceed (owner ruling 2026-10-23, Equoria-i1hgt): nobody can act on the
 * owner, and a moderator or admin can never act on another moderator or admin
 * (only the owner can). Acting on oneself is refused too. The refusal carries a
 * machine code for the API and an authored message, never the code, for a person.
 * Pure policy, like assertActionableTarget; callers pass the actor and the
 * target as read under their own lock.
 * @param {{ actor: { id: string, role: string }, targetUser: { id: string, role: string } }} params
 * @returns {{ code: string, message: string } | null}
 */
export function staffTargetRefusal({ actor, targetUser }) {
  if (targetUser.role === 'owner') {
    return TARGET_REFUSALS.owner;
  }
  if (targetUser.id === actor.id) {
    return TARGET_REFUSALS.self;
  }
  if (isStaffRole(targetUser.role) && actor.role !== 'owner') {
    return TARGET_REFUSALS.staff;
  }
  return null;
}
