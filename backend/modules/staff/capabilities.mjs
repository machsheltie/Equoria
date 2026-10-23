/**
 * Staff capability map and actionable-target guard (Equoria-puj1e.2)
 *
 * Pure policy: no database access. Callers pass the actor id and the target
 * user record; this module decides whether the staff action may proceed.
 *
 * Owner ruling 2026-10-23 (Equoria-4tleh): three staff levels, held in the
 * existing `User.role` string — `owner` (Head Admin, the project owner),
 * `admin`, `moderator`. The owner holds every admin capability plus the
 * owner-only ones. Only the owner and admins post News (`news.post`); only the
 * owner sees hidden traits (`traits.hidden.view`). This module is the single
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
  'rename',
  'post.moderate',
  'post.review',
  'ticket.file',
  'log.view.own',
];
const adminOnly = [
  'ticket.resolve',
  'log.view.all',
  'ban.ip',
  'ban.device',
  'view.identity',
  'roles.manage',
  'jobs.hold',
  'time-back',
  'horse.admin',
  'news.post',
];
const ownerOnly = ['traits.hidden.view'];

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
