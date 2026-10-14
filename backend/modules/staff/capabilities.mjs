/**
 * Staff capability map and actionable-target guard (Equoria-puj1e.2)
 *
 * Pure policy: no database access. Callers pass the actor id and the target
 * user record; this module decides whether the staff action may proceed.
 */

import AppError from '../../errors/AppError.mjs';

export const STAFF_ROLES = Object.freeze(['moderator', 'admin']);

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
const ADMIN_ONLY = [
  'ticket.resolve',
  'log.view.all',
  'ban.ip',
  'ban.device',
  'view.identity',
  'roles.manage',
  'jobs.hold',
  'time-back',
  'horse.admin',
];

// Private and frozen (STAFF-CR-12): no importer can reach a mutable copy of
// the policy. Callers ask through hasCapability and capabilitiesFor only.
const ROLE_CAPABILITIES = Object.freeze({
  moderator: Object.freeze([...MODERATOR]),
  admin: Object.freeze([...MODERATOR.filter(c => c !== 'ticket.file'), ...ADMIN_ONLY]),
});

/** The role's own frozen list, or null. Inherited keys are never roles. */
function listFor(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_CAPABILITIES, role)
    ? ROLE_CAPABILITIES[role]
    : null;
}

/**
 * True only for the two staff roles. Never throws.
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
