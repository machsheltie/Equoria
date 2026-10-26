/**
 * Equoria-0o7ib — erasing an account also removes its user_presence row.
 *
 * user_presence has NO foreign key to User on purpose (Equoria-vc5x1: the
 * activity stamp must never lock the User row), so deleting the user does not
 * cascade to it. The erasure service must delete it explicitly or the erased
 * account's last-active time survives.
 *
 * Real database, no mocks, id-scoped fail-loud cleanup.
 *
 * @module modules/users/__tests__/gdprPresenceErasure.integration
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';

const PREFIX = 'TestFixture-0o7ib';
const tag = () => randomBytes(6).toString('hex');

async function makeUser(label) {
  const t = tag();
  return prisma.user.create({
    data: {
      username: `${PREFIX}-${label}-${t}`,
      email: `${PREFIX}-${label}-${t}@example.com`.toLowerCase(),
      password: 'irrelevant-not-a-login-test',
      firstName: '0o7ib',
      lastName: label,
      money: 0,
      settings: {},
    },
  });
}

describe('Equoria-0o7ib — erasure removes the presence row', () => {
  const cleanup = createCleanupTracker();

  afterEach(() => cleanup.run(), 30000);

  it('deletes the erased account presence row and leaves another account untouched', async () => {
    const subject = await makeUser('subject');
    const bystander = await makeUser('bystander');
    cleanup.add(
      () => prisma.userPresence.deleteMany({ where: { userId: { in: [subject.id, bystander.id] } } }),
      'presence',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [subject.id, bystander.id] } } }), 'users');

    const lastActiveAt = new Date();
    await prisma.userPresence.createMany({
      data: [
        { userId: subject.id, lastActiveAt },
        { userId: bystander.id, lastActiveAt },
      ],
    });

    await expect(eraseUserAccount(subject.id)).resolves.toEqual({ deleted: true });

    expect(await prisma.user.findUnique({ where: { id: subject.id } })).toBeNull();
    expect(await prisma.userPresence.findUnique({ where: { userId: subject.id } })).toBeNull();
    expect(await prisma.userPresence.findUnique({ where: { userId: bystander.id } })).not.toBeNull();
  }, 60000);
});
