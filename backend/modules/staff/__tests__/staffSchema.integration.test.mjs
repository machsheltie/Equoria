/**
 * Staff foundation schema — real-DB integration (Equoria-puj1e.1)
 *
 * Proves every staff model persists, and that the permanent staff action log
 * survives: its actor foreign key is Restrict, so a user who has acted as
 * staff cannot be deleted out from under the log.
 */

import { randomBytes } from 'crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('Staff foundation schema (Equoria-puj1e.1)', () => {
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const createdUserIds = [];
  const cleanup = createCleanupTracker();
  let admin;
  let mod;

  const makeUser = async (tag, role) => {
    const u = await prisma.user.create({
      data: {
        username: `TestFixture-puj1e1-${tag}-${ts}`,
        email: `TestFixture-puj1e1-${tag}-${ts}@example.com`,
        password: 'not-a-real-hash',
        firstName: 'TestFixture',
        lastName: 'Puj1e1',
        dateOfBirth: new Date('1990-01-01'),
        role,
      },
    });
    createdUserIds.push(u.id);
    return u;
  };

  beforeAll(async () => {
    admin = await makeUser('admin', 'admin');
    mod = await makeUser('mod', 'moderator');
  }, 60000);

  afterAll(async () => {
    const scope = { in: createdUserIds };
    // Log rows hold Restrict FKs on their actors, so they go before users.
    cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope } }), 'staffActionLog');
    cleanup.add(() => prisma.staffTicketReply.deleteMany({ where: { authorId: scope } }), 'staffTicketReply');
    cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope } }), 'staffTicket');
    cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope } }), 'staffCheckinCode');
    cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope } }), 'staffTrustedDevice');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: scope } }), 'user');
    await cleanup.run();
  }, 60000);

  it('persists one row of every staff model', async () => {
    const log = await prisma.staffActionLog.create({
      data: {
        actorId: admin.id,
        actorRole: 'admin',
        capability: 'roles.manage',
        targetType: 'user',
        targetId: mod.id,
        reason: 'promote',
        outcome: 'succeeded',
      },
    });
    expect(log.id).toBeDefined();

    const ticket = await prisma.staffTicket.create({
      data: { filedById: mod.id, targetType: 'post', targetId: '42', category: 'spam', note: 'help', status: 'open' },
    });
    const reply = await prisma.staffTicketReply.create({
      data: { ticketId: ticket.id, authorId: admin.id, body: 'on it' },
    });
    const code = await prisma.staffCheckinCode.create({
      data: { userId: mod.id, codeHash: 'x', expiresAt: new Date(Date.now() + 600000) },
    });
    const device = await prisma.staffTrustedDevice.create({
      data: { userId: mod.id, tokenHash: `y-${ts}`, expiresAt: new Date(Date.now() + 30 * 86400000) },
    });

    expect(reply.id).toBeDefined();
    expect(code.attempts).toBe(0);
    expect(device.revokedAt).toBeNull();
    const reread = await prisma.staffTicket.findUnique({ where: { id: ticket.id }, include: { replies: true } });
    expect(reread.replies).toHaveLength(1);
  });

  it('refuses to delete the actor of a staff action log row, so the log survives', async () => {
    const log = await prisma.staffActionLog.create({
      data: {
        actorId: mod.id,
        actorRole: 'moderator',
        capability: 'posts.hide',
        targetType: 'post',
        outcome: 'failed',
        error: 'x',
      },
    });

    // Prisma errors cross the Jest vm realm, so rejects.toThrow() cannot see them as
    // Errors; capture the rejection and assert on it directly.
    let refusal;
    try {
      await prisma.user.delete({ where: { id: mod.id } });
    } catch (err) {
      refusal = err;
    }
    expect(refusal).toBeDefined();
    expect(String(refusal.message)).toMatch(/staff_action_log|foreign key|constraint/i);

    const survivor = await prisma.staffActionLog.findUnique({ where: { id: log.id } });
    expect(survivor).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: mod.id } })).not.toBeNull();
  });
});
