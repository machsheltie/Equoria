/**
 * Staff ticket targets — real HTTP, real DB (STAFF-CR-02, STAFF-CR-07).
 * Security gate: file-name token `Authz`.
 *
 * Owner ruling 2026-10-13: a ticket about an account may name a player only.
 * The filer, another moderator and the admin are refused alike, by username
 * or by ID, and a promotion racing the filing cannot slip a staff target in.
 * A horse, show or post must exist when filed; a malformed, unknown, deleted
 * or wrong-kind ID gets one 404 that does not say which.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';
import {
  checkIn,
  createTargetFactory,
  createUserFactory,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
  removeTicketEmails,
} from './helpers/staffFixtures.mjs';

const TICKETS = '/api/v1/staff/tickets';

const NOT_A_PLAYER = {
  success: false,
  message: 'Tickets can only be about players',
  code: 'notAPlayer',
};
const noTarget = { success: false, message: 'Nothing by that ID', code: 'noTarget' };

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stafftarget');
const { makeHorse, makeShow, makePost, removeTargets } = createTargetFactory('StaffTarget');

const ticketAbout = (fields = {}) => ({
  category: 'Needs the admin',
  note: `private note ${uid()}`,
  ...fields,
});

// A second client holds the race tests' row locks (rowLockBarrier.mjs).
const barrierClient = createBarrierClient();

let admin;
let mod;
let otherMod;
let modDevice;
let owner;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => removeTicketEmails({ filedById: scope() }), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => removeTargets(), 'horses, shows and posts');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  startEmailCapture();
  admin = await makeUser('admin');
  mod = await makeUser('moderator');
  otherMod = await makeUser('moderator');
  owner = await makeUser('user');
  modDevice = await checkIn(mod);
  stopEmailCapture();
});

afterAll(async () => {
  await barrierClient.$disconnect();
  await cleanup.run();
}, 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

const file = body => post(TICKETS, mod, body, modDevice);

/** Everything a filing writes, so a refusal can be shown to write none of it. */
async function trail() {
  const [tickets, logRows, bells] = await Promise.all([
    prisma.staffTicket.count({ where: { filedById: mod.id } }),
    prisma.staffActionLog.count({ where: { actorId: mod.id, capability: 'ticket.file' } }),
    prisma.notification.count({ where: { userId: admin.id, type: 'staffTicket' } }),
  ]);
  return { tickets, logRows, bells };
}

describe('A ticket about an account names a player only (STAFF-CR-02)', () => {
  it.each([
    ['the filing moderator', () => mod],
    ['another moderator', () => otherMod],
    ['the admin', () => admin],
  ])('refuses %s by username and by ID with one answer, writing nothing', async (_label, who) => {
    const target = who();
    const before = await trail();

    const byName = await file(ticketAbout({ targetType: 'user', targetUsername: target.username }));
    const byId = await file(ticketAbout({ targetType: 'user', targetId: target.id }));
    const byBoth = await file(
      ticketAbout({ targetType: 'user', targetId: target.id, targetUsername: target.username }),
    );

    for (const res of [byName, byId, byBoth]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual(NOT_A_PLAYER);
    }
    expect(await trail()).toEqual(before);
  });

  it('still files about an ordinary player, by username and by ID', async () => {
    const player = await makeUser('user');

    const byName = await file(ticketAbout({ targetType: 'user', targetUsername: player.username }));
    const byId = await file(ticketAbout({ targetType: 'user', targetId: player.id }));

    expect(byName.status).toBe(201);
    expect(byName.body.ticket.targetId).toBe(player.id);
    expect(byId.status).toBe(201);
    expect(byId.body.ticket.targetId).toBe(player.id);
  });

  it('cannot commit a ticket about a player whose promotion lands mid-filing', async () => {
    const player = await makeUser('user');
    const before = await trail();
    let releasePromotion;
    const held = new Promise(resolve => {
      releasePromotion = resolve;
    });
    let promotionWritten;
    const written = new Promise(resolve => {
      promotionWritten = resolve;
    });
    let promotionPid;
    // The promotion has written the role but not committed.
    const promotion = prisma.$transaction(
      async tx => {
        await tx.user.update({ where: { id: player.id }, data: { role: 'moderator' } });
        [{ pid: promotionPid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        promotionWritten();
        await held;
      },
      { timeout: 30_000 },
    );
    await written;

    const filingState = { settled: false };
    const filing = file(ticketAbout({ targetType: 'user', targetId: player.id })).finally(() => {
      filingState.settled = true;
    });
    // Wait until the filing is either done or queued behind the promotion's row
    // lock. Only a session the promotion itself blocks counts: any FOR UPDATE
    // wait in the database would also count another Jest worker's (Equoria-8kbfl).
    const waitingOnLock = async () => {
      const [row] = await prisma.$queryRaw`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE ${promotionPid}::int = ANY(pg_blocking_pids(pid))`;
      return row.n > 0;
    };
    const deadline = Date.now() + 20_000;
    while (!filingState.settled && !(await waitingOnLock()) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    releasePromotion();
    await promotion;
    const res = await filing;

    expect(res.status).toBe(403);
    expect(res.body).toEqual(NOT_A_PLAYER);
    expect(await trail()).toEqual(before);
  });
});

describe('A ticket about a horse, show or post names a real one (STAFF-CR-07)', () => {
  it('files about a real horse, show and post and stores the ID in its plain form', async () => {
    const horse = await makeHorse(owner);
    const show = await makeShow();
    const forumPost = await makePost(owner);

    for (const [targetType, row] of [
      ['horse', horse],
      ['show', show],
      ['post', forumPost],
    ]) {
      const res = await file(ticketAbout({ targetType, targetId: `  ${row.id}  ` }));
      expect(res.status).toBe(201);
      expect(res.body.ticket).toMatchObject({ targetType, targetId: String(row.id) });
      const stored = await prisma.staffTicket.findUnique({ where: { id: res.body.ticket.id } });
      expect(stored.targetId).toBe(String(row.id));
    }
  });

  it.each(['horse', 'show', 'post'])(
    'refuses a malformed %s ID with the one not-found answer, writing nothing',
    async targetType => {
      const before = await trail();
      for (const targetId of ['abc', '0', '-1', '1.5', '1e3', '0x1F', '007', '2147483648', `post-${uid()}`]) {
        const res = await file(ticketAbout({ targetType, targetId }));
        expect({ targetId, status: res.status, body: res.body }).toEqual({
          targetId,
          status: 404,
          body: noTarget,
        });
      }
      expect(await trail()).toEqual(before);
    },
  );

  // STAFF-RR-04 (Equoria-0spfq): every unusable horse, show or post ID gets the
  // same answer as an unknown one, so the answer never says which.
  it.each(['horse', 'show', 'post'])(
    'refuses a missing, blank, overlong or non-text %s ID with the one not-found answer, writing nothing',
    async targetType => {
      const before = await trail();
      const forms = [
        ['missing', undefined],
        ['null', null],
        ['empty', ''],
        ['blank', '   '],
        ['overlong', '1'.repeat(65)],
        ['number', 1],
        ['array', ['1']],
        ['object', { id: 1 }],
        ['boolean', true],
      ];
      for (const [form, targetId] of forms) {
        const body = ticketAbout({ targetType });
        if (targetId !== undefined) {
          body.targetId = targetId;
        }
        const res = await file(body);
        expect({ form, status: res.status, body: res.body }).toEqual({ form, status: 404, body: noTarget });
      }
      expect(await trail()).toEqual(before);
    },
  );

  // STAFF-RR-03 (Equoria-q4gt7): the filing locks the target row, so a delete
  // in flight is waited for and then seen, never filed past.
  it.each([
    ['horse', () => makeHorse(owner), (tx, id) => tx.horse.delete({ where: { id } })],
    ['show', () => makeShow(), (tx, id) => tx.show.delete({ where: { id } })],
    ['post', () => makePost(owner), (tx, id) => tx.forumPost.delete({ where: { id } })],
  ])('refuses a %s whose delete was committing while the ticket was filed', async (targetType, make, remove) => {
    const row = await make();
    const before = await trail();

    const barrier = await openRowLockBarrier(barrierClient, tx => remove(tx, row.id));
    const filing = file(ticketAbout({ targetType, targetId: String(row.id) }));
    try {
      await waitForBlockedSessions(barrierClient, barrier.pid, 1, 5000);
    } finally {
      await barrier.release();
    }
    const res = await filing;

    expect(res.status).toBe(404);
    expect(res.body).toEqual(noTarget);
    expect(await trail()).toEqual(before);
  });

  it('refuses a deleted horse, show and post with the same answer', async () => {
    const horse = await makeHorse(owner);
    const show = await makeShow();
    const forumPost = await makePost(owner);
    await prisma.horse.delete({ where: { id: horse.id } });
    await prisma.show.delete({ where: { id: show.id } });
    await prisma.forumPost.delete({ where: { id: forumPost.id } });
    const before = await trail();

    for (const [targetType, row] of [
      ['horse', horse],
      ['show', show],
      ['post', forumPost],
    ]) {
      const res = await file(ticketAbout({ targetType, targetId: String(row.id) }));
      expect(res.status).toBe(404);
      expect(res.body).toEqual(noTarget);
    }
    expect(await trail()).toEqual(before);
  });

  it('refuses an ID of the wrong kind', async () => {
    const player = await makeUser('user');
    const horse = await makeHorse(owner);
    const before = await trail();

    // A player's account ID is no horse, show or post.
    for (const targetType of ['horse', 'show', 'post']) {
      const res = await file(ticketAbout({ targetType, targetId: player.id }));
      expect(res.status).toBe(404);
      expect(res.body).toEqual(noTarget);
    }
    // A horse's number is no player.
    const asPlayer = await file(ticketAbout({ targetType: 'user', targetId: String(horse.id) }));
    expect(asPlayer.status).toBe(404);
    expect(asPlayer.body.code).toBe('noPlayer');
    expect(await trail()).toEqual(before);
  });
});
