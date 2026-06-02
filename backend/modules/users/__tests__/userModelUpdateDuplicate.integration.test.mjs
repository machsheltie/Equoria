/**
 * userModel.updateUser — duplicate-constraint integration tests (Equoria-g5x66)
 *
 * Defect: `updateUser`'s catch block only special-cased Prisma P2025
 * (record-not-found). Every other error — including P2002 (unique-constraint
 * violation, i.e. duplicate email/username) — was wrapped into a generic
 * `DatabaseError` that DROPPED the `.code`. The global error handler keys off
 * `err.code === 'P2002'` to render a clean 409/400; with the code dropped, a
 * duplicate-email/username update surfaced as a 500.
 *
 * Sentinel-positive: these tests assert the raw Prisma error (with
 * `.code === 'P2002'`) propagates UNWRAPPED. If the fix is reverted (the
 * P2002 branch removed so the error is wrapped into DatabaseError again),
 * `error.code` becomes undefined and `error instanceof DatabaseError` is true,
 * and these assertions fail.
 *
 * Real DB, no mocks, scoped fixtures. We exercise `updateUser` DIRECTLY at the
 * model layer (not via HTTP) so this test does not touch the users
 * controller/routes (owned by a parallel agent). The HTTP 400/409 mapping of a
 * P2002 `.code` is independently proven by the global errorHandler tests
 * (backend/tests/middleware/errorHandler.test.mjs,
 * backend/modules/services/__tests__/errorHandler.test.mjs); this test proves
 * the model now hands that handler the `.code` it needs.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { updateUser } from '../services/userModelService.mjs';
import { DatabaseError } from '../../../errors/index.mjs';

const RUN_ID = `${randomBytes(4).toString('hex')}_${Math.floor(Math.random() * 100000)}`;
const PREFIX = `TestFixture-g5x66_${RUN_ID}`;

const createdIds = [];

let userA;
let userB;

beforeAll(async () => {
  userA = await prisma.user.create({
    data: {
      username: `${PREFIX}_a`,
      email: `${PREFIX.toLowerCase()}_a@test.invalid`,
      password: 'x',
      firstName: 'Dup',
      lastName: 'A',
    },
  });
  createdIds.push(userA.id);

  userB = await prisma.user.create({
    data: {
      username: `${PREFIX}_b`,
      email: `${PREFIX.toLowerCase()}_b@test.invalid`,
      password: 'x',
      firstName: 'Dup',
      lastName: 'B',
    },
  });
  createdIds.push(userB.id);
}, 30000);

afterAll(async () => {
  // SCOPED cleanup — only the ids this suite created (CLAUDE.md §2).
  if (createdIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
}, 30000);

describe('userModel.updateUser — Prisma P2002 propagation (Equoria-g5x66)', () => {
  it('re-throws P2002 with .code preserved when updating to a duplicate EMAIL', async () => {
    expect.assertions(3);
    try {
      // Attempt to set userB's email to userA's email — unique-constraint hit.
      await updateUser(userB.id, { email: userA.email });
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

  it('re-throws P2002 with .code preserved when updating to a duplicate USERNAME', async () => {
    expect.assertions(2);
    try {
      await updateUser(userB.id, { username: userA.username });
    } catch (error) {
      expect(error.code).toBe('P2002');
      expect(error).not.toBeInstanceOf(DatabaseError);
    }
  });

  it('still returns null for P2025 (record-not-found) — unchanged behaviour', async () => {
    const result = await updateUser('00000000-0000-0000-0000-000000000000', {
      firstName: 'Nope',
    });
    expect(result).toBeNull();
  });
});
