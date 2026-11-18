/**
 * Forum posting guards: real HTTP, real DB (Equoria-puj1e.3, Codex review 2026-11-18,
 * owner rulings q375 and q376).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - a posting cooldown a steward commits while a new thread or reply is on its way
 *    stops that post: the cooldown and the post serialise on the author's account
 *    row, so the post either lands before the cooldown exists or is refused;
 *  - a reply in the author's own held thread is held too, so a moderator accepting
 *    the opening post never publishes a reply nobody has reviewed (q376);
 *  - counting a view of a held thread that is not yours answers exactly like a
 *    missing thread and counts nothing, so a held thread's existence never shows.
 *
 * HOW THE RACE IS FORCED (rowLockBarrier, no mocks, no sleeps). A second Prisma client
 * plays the steward's cooldown transaction: it locks the player's account row FOR
 * UPDATE (as the conduct tool does) and writes the postingCooldown record, then holds
 * the lock. The real POST is sent, observed really queued behind the holder
 * (pg_blocking_pids), and only then is the holder committed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const api = '/api/v1/staff';
const forum = '/api/v1/forum';
const hour = 60 * 60 * 1000;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('forumguard');
const createdWords = [];
const barrierClient = createBarrierClient();

let mod;
let admin;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => barrierClient.$disconnect(), 'barrier client');
  cleanup.add(() => prisma.forumWord.deleteMany({ where: { word: { in: createdWords } } }), 'words');
  cleanup.add(() => prisma.forumThread.deleteMany({ where: { authorId: scope() } }), 'threads');
  cleanup.add(() => prisma.forumPost.deleteMany({ where: { authorId: scope() } }), 'posts');
  cleanup.add(() => prisma.conductRecord.deleteMany({ where: { userId: scope() } }), 'conduct');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  startEmailCapture();
  const staff = async role => {
    const user = await makeUser(role);
    return { user, device: await checkIn(user) };
  };
  mod = await staff('moderator');
  admin = await staff('admin');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

const as = steward => ({
  get: url => get(url, steward.user, steward.device),
  post: (url, body) => post(url, steward.user, body, steward.device),
});

const newThread = (player, content = 'Hello from the paddock') =>
  post(`${forum}/threads`, player, {
    section: 'general',
    title: `TestFixture-forumguard-${uid()}`,
    content,
  });
const reply = (player, threadId, content) => post(`${forum}/threads/${threadId}/posts`, player, { content });
const countView = (player, threadId) => post(`${forum}/threads/${threadId}/view`, player);

/** A review word on the list, through the real route as an admin. */
async function reviewWord() {
  const word = `zq${uid()}`;
  createdWords.push(word);
  const res = await as(admin).post(`${api}/forum/words`, { list: 'review', word });
  expect(res.status).toBe(200);
  return word;
}

/**
 * The steward's cooldown transaction, held open: the player's account row FOR UPDATE
 * (as the conduct tool takes it) and the postingCooldown record, uncommitted.
 */
const cooldownBeingIssued = player => async tx => {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${player.id} FOR UPDATE`;
  await tx.conductRecord.create({
    data: {
      userId: player.id,
      kind: 'postingCooldown',
      reason: 'Flooding the board',
      issuedById: mod.user.id,
      issuedByRole: 'moderator',
      endsAt: new Date(Date.now() + 12 * hour),
    },
  });
};

/** Send `request` while the cooldown is being issued; commit it once the post is queued. */
async function postDuringCooldown(player, request) {
  const barrier = await holdLock(barrierClient, cooldownBeingIssued(player));
  let inFlight;
  try {
    inFlight = Promise.resolve(request());
    await barrier.waitForQueued(1);
  } finally {
    await barrier.release();
  }
  return inFlight;
}

describe('A posting cooldown issued while a post is on its way', () => {
  it('refuses the new thread and writes nothing', async () => {
    const player = await makeUser('user');
    const title = `TestFixture-forumguard-race-${uid()}`;

    const res = await postDuringCooldown(player, () =>
      post(`${forum}/threads`, player, { section: 'general', title, content: 'Racing the steward' }),
    );

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forumPostingCooldown');
    expect(await prisma.forumThread.count({ where: { authorId: player.id } })).toBe(0);
    expect(await prisma.forumPost.count({ where: { authorId: player.id } })).toBe(0);
  }, 60_000);

  it('refuses the reply and leaves the thread as it was', async () => {
    const starter = await makeUser('user');
    const player = await makeUser('user');
    const started = await newThread(starter);
    expect(started.status).toBe(201);
    const threadId = started.body.data.thread.id;
    const before = await prisma.forumThread.findUnique({ where: { id: threadId } });

    const res = await postDuringCooldown(player, () => reply(player, threadId, 'Racing the steward'));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('forumPostingCooldown');
    expect(await prisma.forumPost.count({ where: { authorId: player.id } })).toBe(0);
    const after = await prisma.forumThread.findUnique({ where: { id: threadId } });
    expect(after.lastActivityAt).toEqual(before.lastActivityAt);
  }, 60_000);
});

describe('A reply in a thread still awaiting a moderator (q376)', () => {
  it('is held too, and accepting the opening post does not publish it', async () => {
    const word = await reviewWord();
    const author = await makeUser('user');
    const reader = await makeUser('user');

    const started = await newThread(author, `Is ${word} allowed here?`);
    expect(started.status).toBe(201);
    expect(started.body.data.thread.status).toBe('held');
    const threadId = started.body.data.thread.id;
    const openingId = started.body.data.firstPost.id;

    const answered = await reply(author, threadId, 'Plain words, nothing listed');
    expect(answered.status).toBe(201);
    expect(answered.body.data.post.status).toBe('held');
    const replyId = answered.body.data.post.id;

    const own = await get(`${forum}/threads/${threadId}`, author);
    expect(own.status).toBe(200);
    expect(own.body.data.posts.map(p => [p.id, p.status])).toEqual([
      [openingId, 'held'],
      [replyId, 'held'],
    ]);

    const accepted = await as(mod).post(`${api}/forum/held/${openingId}/accept`, {});
    expect(accepted.status).toBe(200);

    const seen = await get(`${forum}/threads/${threadId}`, reader);
    expect(seen.status).toBe(200);
    expect(seen.body.data.posts.map(p => p.id)).toEqual([openingId]);
    const queue = await as(mod).get(`${api}/forum/held`);
    expect(queue.body.posts.map(p => p.id)).toContain(replyId);

    const acceptedReply = await as(mod).post(`${api}/forum/held/${replyId}/accept`, {});
    expect(acceptedReply.status).toBe(200);
    const later = await get(`${forum}/threads/${threadId}`, reader);
    expect(later.body.data.posts.map(p => p.id)).toEqual([openingId, replyId]);
  }, 60_000);

  it('still answers another player as if the thread were missing', async () => {
    const word = await reviewWord();
    const author = await makeUser('user');
    const other = await makeUser('user');
    const started = await newThread(author, `About ${word}`);
    const threadId = started.body.data.thread.id;

    const res = await reply(other, threadId, 'Can I see this?');
    expect(res.status).toBe(404);
    expect(await prisma.forumPost.count({ where: { authorId: other.id } })).toBe(0);
  }, 60_000);
});

describe('Counting a view of a held thread', () => {
  it('answers a non-author exactly like a missing thread and counts nothing', async () => {
    const word = await reviewWord();
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const started = await newThread(author, `Asking about ${word}`);
    expect(started.body.data.thread.status).toBe('held');
    const threadId = started.body.data.thread.id;
    const missingId = (await prisma.forumThread.aggregate({ _max: { id: true } }))._max.id + 100_000;

    const held = await countView(reader, threadId);
    const missing = await countView(reader, missingId);

    expect(held.status).toBe(404);
    expect(missing.status).toBe(held.status);
    expect(held.body).toEqual(missing.body);
    const again = await countView(reader, threadId);
    expect(again.status).toBe(404);
    expect((await prisma.forumThread.findUnique({ where: { id: threadId } })).viewCount).toBe(0);
  }, 60_000);

  it('counts the author viewing their own held thread', async () => {
    const word = await reviewWord();
    const author = await makeUser('user');
    const started = await newThread(author, `Asking about ${word}`);
    const threadId = started.body.data.thread.id;

    const res = await countView(author, threadId);
    expect(res.status).toBe(200);
    expect((await prisma.forumThread.findUnique({ where: { id: threadId } })).viewCount).toBe(1);
  }, 60_000);
});
