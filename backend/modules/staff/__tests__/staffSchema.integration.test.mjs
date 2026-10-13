/**
 * Staff foundation schema — real-DB integration (Equoria-puj1e.1)
 *
 * Proves every staff model persists, and that the permanent staff action log
 * survives its actor: the log holds the actor's account ID with no foreign key,
 * so deleting the account leaves every row in place (Equoria-2yugk, owner
 * ruling 2026-10-13; previously the actor FK was Restrict and refused the delete).
 */

import { randomBytes } from 'crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('Staff foundation schema (Equoria-puj1e.1)', () => {
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const createdUserIds = [];
  const ticketIds = [];
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
    // Log rows keep their actorId after the actor is gone; tickets whose filer
    // was deleted have a null filedById, so they are also scoped by id.
    cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope } }), 'staffActionLog');
    cleanup.add(() => prisma.staffTicketReply.deleteMany({ where: { authorId: scope } }), 'staffTicketReply');
    cleanup.add(
      () => prisma.staffTicket.deleteMany({ where: { OR: [{ id: { in: ticketIds } }, { filedById: scope }] } }),
      'staffTicket',
    );
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
    ticketIds.push(ticket.id);
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

  it('lets the actor of a staff action log row be deleted, and the row survives with its actorId', async () => {
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

    await prisma.user.delete({ where: { id: mod.id } });

    expect(await prisma.user.findUnique({ where: { id: mod.id } })).toBeNull();
    const survivor = await prisma.staffActionLog.findUnique({ where: { id: log.id } });
    expect(survivor).not.toBeNull();
    expect(survivor.actorId).toBe(mod.id);
  });
});
