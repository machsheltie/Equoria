/**
 * Staff capabilities and target guard — pure unit test (Equoria-puj1e.2)
 *
 * Proves the role → capability map, the staff-role check, the frozen
 * exports, and that staff tools cannot act on themselves or on other staff.
 */

import {
  hasCapability,
  isStaffRole,
  assertActionableTarget,
  ROLE_CAPABILITIES,
  STAFF_ROLES,
} from '../capabilities.mjs';
import AppError from '../../../errors/AppError.mjs';

describe('staff capabilities (Equoria-puj1e.2)', () => {
  describe('hasCapability', () => {
    it('grants moderator the moderator capabilities', () => {
      expect(hasCapability('moderator', 'warn')).toBe(true);
    });

    it('denies moderator admin-only capabilities', () => {
      expect(hasCapability('moderator', 'ban.ip')).toBe(false);
    });

    it('grants admin the admin-only capabilities', () => {
      expect(hasCapability('admin', 'roles.manage')).toBe(true);
    });

    it('grants admin the moderator capabilities except ticket.file', () => {
      expect(hasCapability('admin', 'warn')).toBe(true);
      expect(hasCapability('admin', 'ticket.file')).toBe(false);
    });

    it('denies non-staff roles every capability', () => {
      expect(hasCapability('user', 'warn')).toBe(false);
    });

    it('returns false for unknown roles and unknown capabilities without throwing', () => {
      expect(() => hasCapability('wizard', 'warn')).not.toThrow();
      expect(hasCapability('wizard', 'warn')).toBe(false);
      expect(hasCapability('admin', 'not.a.capability')).toBe(false);
      expect(hasCapability(undefined, undefined)).toBe(false);
    });

    it('does not treat inherited object keys as roles', () => {
      expect(hasCapability('constructor', 'warn')).toBe(false);
      expect(hasCapability('__proto__', 'warn')).toBe(false);
    });
  });

  describe('isStaffRole', () => {
    it('is true only for moderator and admin', () => {
      expect(isStaffRole('moderator')).toBe(true);
      expect(isStaffRole('admin')).toBe(true);
      expect(isStaffRole('user')).toBe(false);
      expect(isStaffRole('')).toBe(false);
      expect(isStaffRole(undefined)).toBe(false);
      expect(isStaffRole(null)).toBe(false);
    });
  });

  describe('frozen exports', () => {
    it('freezes STAFF_ROLES and ROLE_CAPABILITIES', () => {
      expect(Object.isFrozen(STAFF_ROLES)).toBe(true);
      expect(Object.isFrozen(ROLE_CAPABILITIES)).toBe(true);
      expect(STAFF_ROLES).toEqual(['moderator', 'admin']);
    });

    it('ignores attempts to add a role to the frozen capability map', () => {
      expect(() => {
        ROLE_CAPABILITIES.user = new Set(['warn']);
      }).toThrow();
      expect(ROLE_CAPABILITIES.user).toBeUndefined();
    });
  });

  describe('assertActionableTarget', () => {
    it('throws 403 when the actor targets themselves', () => {
      expect(() => assertActionableTarget({ actorId: 'a', targetUser: { id: 'a', role: 'user' } })).toThrow();
    });

    it('throws 403 when the target is a staff account', () => {
      expect(() => assertActionableTarget({ actorId: 'a', targetUser: { id: 'b', role: 'moderator' } })).toThrow();
    });

    it('throws an AppError with the exact message and status', () => {
      let caught;
      try {
        assertActionableTarget({ actorId: 'a', targetUser: { id: 'a', role: 'user' } });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect(caught.message).toBe('Staff tools cannot act on this account');
      expect(caught.statusCode).toBe(403);
    });

    it('does not throw for an ordinary other user', () => {
      expect(() => assertActionableTarget({ actorId: 'a', targetUser: { id: 'b', role: 'user' } })).not.toThrow();
    });
  });
});
