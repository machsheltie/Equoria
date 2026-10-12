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

export const ROLE_CAPABILITIES = Object.freeze({
  moderator: new Set(MODERATOR),
  admin: new Set([...MODERATOR.filter(c => c !== 'ticket.file'), ...ADMIN_ONLY]),
});

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
  if (typeof role !== 'string' || !Object.hasOwn(ROLE_CAPABILITIES, role)) {
    return false;
  }
  return ROLE_CAPABILITIES[role].has(cap);
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
