/**
 * Staff capabilities and target guard — pure unit test (Equoria-puj1e.2)
 *
 * Proves the role → capability map, the staff-role check, that the policy
 * cannot be mutated by an importer (STAFF-CR-12), and that staff tools cannot act on themselves or on other staff.
 */

import * as capabilities from '../capabilities.mjs';
import { hasCapability, isStaffRole, assertActionableTarget, capabilitiesFor, STAFF_ROLES } from '../capabilities.mjs';
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

  describe('capabilitiesFor', () => {
    it("lists a role's capabilities, and nothing for a non-staff or inherited role", () => {
      expect(capabilitiesFor('moderator')).toContain('ticket.file');
      expect(capabilitiesFor('admin')).toContain('roles.manage');
      expect(capabilitiesFor('admin')).not.toContain('ticket.file');
      expect(capabilitiesFor('user')).toEqual([]);
      expect(capabilitiesFor('constructor')).toEqual([]);
      expect(capabilitiesFor(undefined)).toEqual([]);
    });

    it('agrees with hasCapability for every listed capability', () => {
      for (const role of STAFF_ROLES) {
        for (const cap of capabilitiesFor(role)) {
          expect(hasCapability(role, cap)).toBe(true);
        }
      }
    });
  });

  // STAFF-CR-12: the policy must not be mutable by any importer.
  describe('the policy cannot be changed at runtime', () => {
    it('exports only functions and frozen arrays of strings, never a Set, Map or open object', () => {
      for (const [name, value] of Object.entries(capabilities)) {
        if (typeof value === 'function') {
          continue;
        }
        expect({ name, isArray: Array.isArray(value), frozen: Object.isFrozen(value) }).toEqual({
          name,
          isArray: true,
          frozen: true,
        });
        expect(value.every(item => typeof item === 'string')).toBe(true);
      }
      expect(STAFF_ROLES).toEqual(['moderator', 'admin']);
    });

    it('a list handed out cannot grant a capability, to that caller or to any other', () => {
      const mine = capabilitiesFor('moderator');
      expect(Object.isFrozen(mine)).toBe(true);
      expect(() => mine.push('roles.manage')).toThrow();
      expect(() => {
        mine[0] = 'roles.manage';
      }).toThrow();
      expect(() => STAFF_ROLES.push('user')).toThrow();

      expect(hasCapability('moderator', 'roles.manage')).toBe(false);
      expect(capabilitiesFor('moderator')).not.toContain('roles.manage');
      expect(isStaffRole('user')).toBe(false);
    });

    it('hands each caller a fresh list', () => {
      expect(capabilitiesFor('admin')).not.toBe(capabilitiesFor('admin'));
      expect(capabilitiesFor('admin')).toEqual(capabilitiesFor('admin'));
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
