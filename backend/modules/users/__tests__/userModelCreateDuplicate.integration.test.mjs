/**
 * userModel.createUser — duplicate-constraint integration tests (Equoria-iqdc7)
 *
 * Defect: `createUser`'s catch block special-cased Prisma P2002 (unique-
 * constraint violation, i.e. duplicate email/username) but re-threw a brand
 * new `new Error('Duplicate value for ...')` that DROPPED the `.code`. The
 * global error handler keys off `err.code === 'P2002'` to render a clean
 * 409/400; with the code dropped, any non-auth create path that hits a
 * duplicate surfaced a generic 500 instead of a clean conflict.
 *
 * (The live auth-registration path has its own P2002 handling in
 * authController so it was fine — but the model fn itself was lossy. This is
 * the same defect class as updateUser, fixed in Equoria-g5x66.)
 *
 * Sentinel-positive: these tests assert the raw Prisma error (with
 * `.code === 'P2002'`) propagates UNWRAPPED. If the fix is reverted (the
 * P2002 branch re-wraps into `new Error(...)` / DatabaseError), `error.code`
 * becomes undefined and these assertions fail.
 *
 * Real DB, no mocks, scoped fixtures. We exercise `createUser` DIRECTLY at the
 * model layer (not via HTTP) so this test does not touch the users
 * controller/routes (owned by a parallel agent). The HTTP 400/409 mapping of a
 * P2002 `.code` is independently proven by the global errorHandler tests.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { createUser } from '../../../models/userModel.mjs';
import { DatabaseError } from '../../../errors/index.mjs';

const RUN_ID = `${randomBytes(4).toString('hex')}_${Math.floor(Math.random() * 100000)}`;
const PREFIX = `TestFixture-iqdc7_${RUN_ID}`;

const createdIds = [];

let existing;

beforeAll(async () => {
  existing = await createUser({
    username: `${PREFIX}_existing`,
    email: `${PREFIX.toLowerCase()}_existing@test.invalid`,
    password: 'x',
    firstName: 'Dup',
    lastName: 'Existing',
  });
  createdIds.push(existing.id);
}, 30000);

afterAll(async () => {
  // SCOPED cleanup — only the ids this suite created (CLAUDE.md §2).
  if (createdIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
}, 30000);

describe('userModel.createUser — Prisma P2002 propagation (Equoria-iqdc7)', () => {
  it('re-throws P2002 with .code preserved when creating a duplicate EMAIL', async () => {
    expect.assertions(3);
    try {
      // Same email as the existing fixture (different username) — email
      // unique-constraint hit.
      await createUser({
        username: `${PREFIX}_dupemail`,
        email: existing.email,
        password: 'x',
        firstName: 'Dup',
        lastName: 'Email',
      });
    } catch (error) {
      // The raw Prisma code MUST survive so the global error handler maps it
      // to 400/409 instead of a generic 500.
      expect(error.code).toBe('P2002');
      // It MUST NOT be wrapped into a generic DatabaseError (which drops .code).
      expect(error).not.toBeInstanceOf(DatabaseError);
      // The collision must be on the email field.
      expect(error.meta?.target).toEqual(expect.arrayContaining(['email']));
    }
  });

  it('re-throws P2002 with .code preserved when creating a duplicate USERNAME', async () => {
    expect.assertions(2);
    try {
      // Same username as the existing fixture (different email) — username
      // unique-constraint hit.
      await createUser({
        username: existing.username,
        email: `${PREFIX.toLowerCase()}_dupuser@test.invalid`,
        password: 'x',
        firstName: 'Dup',
        lastName: 'User',
      });
    } catch (error) {
      expect(error.code).toBe('P2002');
      expect(error).not.toBeInstanceOf(DatabaseError);
    }
  });
});
