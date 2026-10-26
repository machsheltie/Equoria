/**
 * Staff capabilities and target guard — pure unit test (Equoria-puj1e.2)
 *
 * Proves the role → capability map, the staff-role check, that the policy
 * cannot be mutated by an importer (STAFF-CR-12), and that staff tools cannot act on themselves or on other staff.
 */

import * as capabilities from '../capabilities.mjs';
import {
  hasCapability,
  isStaffRole,
  assertActionableTarget,
  staffTargetRefusal,
  capabilitiesFor,
  can,
  rolesWithCapability,
  satisfiesRole,
  STAFF_ROLES,
} from '../capabilities.mjs';
import AppError from '../../../errors/AppError.mjs';

describe('staff capabilities (Equoria-puj1e.2)', () => {
  describe('hasCapability', () => {
    it('grants moderator the moderator capabilities', () => {
      expect(hasCapability('moderator', 'warn')).toBe(true);
    });

    it('denies moderator admin-only capabilities', () => {
      // Owner ruling 2026-10-23 (Equoria-i1hgt): moderators may issue IP and
      // device bans, so ban.ip is no longer admin-only. Was asserting ban.ip.
      expect(hasCapability('moderator', 'ticket.resolve')).toBe(false);
      expect(hasCapability('moderator', 'roles.manage')).toBe(false);
    });

    it('lets moderators and admins issue IP and device bans (Equoria-i1hgt)', () => {
      for (const role of ['moderator', 'admin', 'owner']) {
        expect(hasCapability(role, 'ban.ip')).toBe(true);
        expect(hasCapability(role, 'ban.device')).toBe(true);
      }
      expect(hasCapability('user', 'ban.ip')).toBe(false);
    });

    it('lets only the owner manage staff roles, admins and moderators alike (q76)', () => {
      expect(hasCapability('owner', 'roles.manage')).toBe(true);
      expect(hasCapability('admin', 'roles.manage')).toBe(false);
      expect(hasCapability('moderator', 'roles.manage')).toBe(false);
      expect(hasCapability('owner', 'roles.appointAdmin')).toBe(false);
    });

    it('grants admin the admin-only capabilities', () => {
      expect(hasCapability('admin', 'ticket.resolve')).toBe(true);
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
      expect(capabilitiesFor('admin')).toContain('ticket.resolve');
      expect(capabilitiesFor('owner')).toContain('roles.manage');
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
      // Owner ruling 2026-10-23 (Equoria-4tleh): three staff levels. Was
      // ['moderator', 'admin'] under the 2026-10-06 two-role contract.
      expect(STAFF_ROLES).toEqual(['moderator', 'admin', 'owner']);
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

  // Owner ruling 2026-10-23 (Equoria-4tleh): Owner (Head Admin), Admin,
  // Moderator. Only Owner and Admin post News; only the Owner sees hidden traits.
  describe('three staff levels (Equoria-4tleh)', () => {
    it('makes owner a staff role', () => {
      expect(isStaffRole('owner')).toBe(true);
    });

    it('gives the owner every admin capability', () => {
      for (const cap of capabilitiesFor('admin')) {
        expect(hasCapability('owner', cap)).toBe(true);
      }
    });

    it('lets owner and admin post News, never a moderator or a player', () => {
      expect(hasCapability('owner', 'news.post')).toBe(true);
      expect(hasCapability('admin', 'news.post')).toBe(true);
      expect(hasCapability('moderator', 'news.post')).toBe(false);
      expect(hasCapability('user', 'news.post')).toBe(false);
    });

    it('lets only the owner see hidden traits', () => {
      expect(hasCapability('owner', 'traits.hidden.view')).toBe(true);
      expect(hasCapability('admin', 'traits.hidden.view')).toBe(false);
      expect(hasCapability('moderator', 'traits.hidden.view')).toBe(false);
      expect(hasCapability('user', 'traits.hidden.view')).toBe(false);
    });

    it('can(user, cap) reads the account role and fails closed on anything else', () => {
      expect(can({ role: 'owner' }, 'traits.hidden.view')).toBe(true);
      expect(can({ role: 'admin' }, 'news.post')).toBe(true);
      expect(can({ role: 'moderator' }, 'news.post')).toBe(false);
      expect(can({ role: 'user' }, 'warn')).toBe(false);
      expect(can(null, 'warn')).toBe(false);
      expect(can(undefined, 'warn')).toBe(false);
      expect(can({}, 'warn')).toBe(false);
    });

    it('lists the roles that hold a capability', () => {
      expect(rolesWithCapability('ticket.resolve')).toEqual(['admin', 'owner']);
      expect(rolesWithCapability('traits.hidden.view')).toEqual(['owner']);
      expect(rolesWithCapability('ticket.file')).toEqual(['moderator']);
      expect(rolesWithCapability('not.a.capability')).toEqual([]);
      expect(Object.isFrozen(rolesWithCapability('warn'))).toBe(true);
    });

    it('lets the owner satisfy an admin role gate, and nothing else widens', () => {
      expect(satisfiesRole('owner', 'admin')).toBe(true);
      expect(satisfiesRole('admin', 'admin')).toBe(true);
      expect(satisfiesRole('moderator', 'admin')).toBe(false);
      expect(satisfiesRole('user', 'admin')).toBe(false);
      expect(satisfiesRole('admin', 'owner')).toBe(false);
      expect(satisfiesRole('moderator', 'moderator')).toBe(true);
      expect(satisfiesRole('user', 'user')).toBe(true);
      expect(satisfiesRole(undefined, 'admin')).toBe(false);
      expect(satisfiesRole('constructor', 'admin')).toBe(false);
      expect(satisfiesRole('', '')).toBe(false);
    });

    it('protects the owner from staff tools like any other staff account', () => {
      expect(() => assertActionableTarget({ actorId: 'a', targetUser: { id: 'b', role: 'owner' } })).toThrow();
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

describe('staffTargetRefusal (Equoria-i1hgt)', () => {
  const actor = role => ({ id: 'actor', role });
  const target = role => ({ id: 'target', role });

  it('refuses a moderator or admin acting on a moderator or admin', () => {
    for (const actorRole of ['moderator', 'admin']) {
      for (const targetRole of ['moderator', 'admin']) {
        expect(staffTargetRefusal({ actor: actor(actorRole), targetUser: target(targetRole) })?.code).toBe(
          'staffTargetStaff',
        );
      }
    }
  });

  it('refuses anyone acting on the owner, the owner included', () => {
    for (const actorRole of ['moderator', 'admin', 'owner']) {
      expect(staffTargetRefusal({ actor: actor(actorRole), targetUser: target('owner') })?.code).toBe(
        'staffTargetOwner',
      );
    }
    expect(
      staffTargetRefusal({ actor: { id: 'x', role: 'owner' }, targetUser: { id: 'x', role: 'owner' } })?.code,
    ).toBe('staffTargetOwner');
  });

  it('refuses acting on oneself and allows acting on a player', () => {
    expect(
      staffTargetRefusal({ actor: { id: 'x', role: 'admin' }, targetUser: { id: 'x', role: 'admin' } })?.code,
    ).toBe('staffTargetSelf');
    for (const actorRole of ['moderator', 'admin', 'owner']) {
      expect(staffTargetRefusal({ actor: actor(actorRole), targetUser: target('user') })).toBeNull();
    }
  });

  it('lets the owner act on a moderator or an admin', () => {
    expect(staffTargetRefusal({ actor: actor('owner'), targetUser: target('moderator') })).toBeNull();
    expect(staffTargetRefusal({ actor: actor('owner'), targetUser: target('admin') })).toBeNull();
  });

  it('gives every refusal an authored message, never the code', () => {
    const refusal = staffTargetRefusal({ actor: actor('moderator'), targetUser: target('admin') });
    expect(refusal.message).toMatch(/\s/);
    expect(refusal.message).not.toContain('staffTarget');
  });
});
