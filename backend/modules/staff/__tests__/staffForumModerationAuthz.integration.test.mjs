/**
 * Forum moderation and held posts: real HTTP, real DB
 * (Equoria-puj1e.3, owner rulings q375 and q376).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - a held post is shown only to its author, marked held; every other player's
 *    thread page, thread list, reply count and the community feed leave it out,
 *    and a held thread answers like a missing one (q376);
 *  - moderators see the held queue, oldest first, and accept (published to all)
 *    or reject it (removed, the author gets a short note); a decided post cannot
 *    be decided again, and of two stewards deciding at once exactly one lands;
 *  - a steward edits or removes any player's post with a reason; removing the
 *    opening post removes the thread; every action writes one staff log entry;
 *  - players are refused with the unknown-route 404; no steward acts on another
 *    moderator's post or on their own.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  preparePost,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const api = '/api/v1/staff';
const forum = '/api/v1/forum';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('forummod');

let mod;
let modB;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.forumThread.deleteMany({ where: { authorId: scope() } }), 'threads');
  cleanup.add(() => prisma.forumPost.deleteMany({ where: { authorId: scope() } }), 'posts');
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
  modB = await staff('moderator');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

const as = steward => ({
  get: url => get(url, steward.user, steward.device),
  post: (url, body) => post(url, steward.user, body, steward.device),
});

/** A published thread with its opening post, by `author`. */
async function publishedThread(author) {
  const thread = await prisma.forumThread.create({
    data: { section: 'general', title: `TestFixture-forummod-${uid()}`, authorId: author.id },
  });
  const opening = await prisma.forumPost.create({
    data: { threadId: thread.id, authorId: author.id, content: 'Opening words' },
  });
  return { thread, opening };
}

/**
 * Held rows are written directly: what holds a post (the review-word list) waits on
 * an owner ruling. Everything read or decided below goes through the real routes.
 */
async function heldReply(threadId, author, content = 'A reply waiting for a moderator') {
  return prisma.forumPost.create({ data: { threadId, authorId: author.id, content, status: 'held' } });
}

async function heldThread(author) {
  const thread = await prisma.forumThread.create({
    data: {
      section: 'general',
      title: `TestFixture-forummod-held-${uid()}`,
      authorId: author.id,
      status: 'held',
    },
  });
  const opening = await prisma.forumPost.create({
    data: { threadId: thread.id, authorId: author.id, content: 'Held opening', status: 'held' },
  });
  return { thread, opening };
}

const threadPage = (viewer, id) => get(`${forum}/threads/${id}`, viewer);
const listIds = async viewer => {
  const res = await get(`${forum}/threads?section=general&limit=100`, viewer);
  expect(res.status).toBe(200);
  return res.body.data.threads;
};
const postIds = res => res.body.data.posts.map(p => p.id);

describe('A held post is shown only to its author (q376)', () => {
  it('shows the author their held reply, marked held, and hides it from everyone else', async () => {
    const starter = await makeUser('user');
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread, opening } = await publishedThread(starter);
    const held = await heldReply(thread.id, author);

    const own = await threadPage(author, thread.id);
    expect(own.status).toBe(200);
    expect(postIds(own)).toEqual([opening.id, held.id]);
    expect(own.body.data.posts[1].status).toBe('held');

    for (const viewer of [reader, starter]) {
      const other = await threadPage(viewer, thread.id);
      expect(other.status).toBe(200);
      expect(postIds(other)).toEqual([opening.id]);
    }
    const listed = (await listIds(reader)).find(t => t.id === thread.id);
    expect(listed.replyCount).toBe(1);
  });

  it('keeps a held thread from everyone but its author, in the list, the page and replies', async () => {
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread, opening } = await heldThread(author);

    const mine = (await listIds(author)).find(t => t.id === thread.id);
    expect(mine).toMatchObject({ id: thread.id, status: 'held' });
    const own = await threadPage(author, thread.id);
    expect(own.status).toBe(200);
    expect(postIds(own)).toEqual([opening.id]);

    expect((await listIds(reader)).some(t => t.id === thread.id)).toBe(false);
    const page = await threadPage(reader, thread.id);
    expect(page.status).toBe(404);
    const reply = await post(`${forum}/threads/${thread.id}/posts`, reader, { content: 'hi' });
    expect(reply.status).toBe(404);
    expect(await prisma.forumPost.count({ where: { threadId: thread.id } })).toBe(1);
  });

  it('leaves a held thread out of the community feed', async () => {
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread } = await heldThread(author);
    const res = await get('/api/v1/users/community/activity', reader);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(thread.title);
  });
});

describe('The held-post queue', () => {
  it('refuses a player with the unknown-route 404 and changes nothing', async () => {
    const author = await makeUser('user');
    const player = await makeUser('user');
    const { opening } = await heldThread(author);
    expect((await get(`${api}/forum/held`, player)).status).toBe(404);
    const accept = await post(`${api}/forum/held/${opening.id}/accept`, player, {});
    expect(accept.status).toBe(404);
    expect((await prisma.forumPost.findUnique({ where: { id: opening.id } })).status).toBe('held');
  });

  it('lists held posts oldest first, saying which would open a thread', async () => {
    const author = await makeUser('user');
    const { thread } = await publishedThread(author);
    const reply = await heldReply(thread.id, author);
    const { opening } = await heldThread(author);
    const res = await as(mod).get(`${api}/forum/held?after=${reply.id - 1}`);
    expect(res.status).toBe(200);
    const mine = res.body.posts.filter(p => p.author.id === author.id);
    expect(mine.map(p => p.id)).toEqual([reply.id, opening.id]);
    expect(mine.map(p => p.startsThread)).toEqual([false, true]);
    expect(mine[0]).toMatchObject({ content: reply.content, thread: { id: thread.id } });
  });

  it('accepting a held reply shows it to everyone and logs it once', async () => {
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread } = await publishedThread(author);
    const held = await heldReply(thread.id, author);

    const res = await as(mod).post(`${api}/forum/held/${held.id}/accept`, {});
    expect(res.status).toBe(200);
    expect(postIds(await threadPage(reader, thread.id))).toContain(held.id);
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: mod.user.id, targetType: 'post', targetId: String(held.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ capability: 'post.review', after: { status: 'published' } });

    const again = await as(mod).post(`${api}/forum/held/${held.id}/accept`, {});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('forumPostNotHeld');
  });

  it('accepting a held opening post opens its thread to everyone', async () => {
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread, opening } = await heldThread(author);
    expect((await as(mod).post(`${api}/forum/held/${opening.id}/accept`, {})).status).toBe(200);
    expect((await listIds(reader)).some(t => t.id === thread.id)).toBe(true);
    const page = await threadPage(reader, thread.id);
    expect(page.status).toBe(200);
    expect(postIds(page)).toEqual([opening.id]);
  });

  it('rejecting a held reply needs a reason, removes it, and leaves the author a short note', async () => {
    const author = await makeUser('user');
    const { thread } = await publishedThread(author);
    const held = await heldReply(thread.id, author);

    const bare = await as(mod).post(`${api}/forum/held/${held.id}/reject`, {});
    expect(bare.status).toBe(400);
    expect(await prisma.forumPost.findUnique({ where: { id: held.id } })).not.toBeNull();

    const res = await as(mod).post(`${api}/forum/held/${held.id}/reject`, { reason: 'Insults' });
    expect(res.status).toBe(200);
    expect(await prisma.forumPost.findUnique({ where: { id: held.id } })).toBeNull();
    expect(postIds(await threadPage(author, thread.id))).not.toContain(held.id);
    const notes = await prisma.notification.findMany({ where: { userId: author.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      type: 'forumPostRejected',
      payload: { threadTitle: thread.title, startedThread: false },
    });
    // The steward's reason stays in the ledger, not in the note.
    expect(JSON.stringify(notes[0].payload)).not.toContain('Insults');
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: mod.user.id, targetType: 'post', targetId: String(held.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ reason: 'Insults', before: { content: held.content } });
  });

  it('rejecting a held opening post removes the whole thread', async () => {
    const author = await makeUser('user');
    const { thread, opening } = await heldThread(author);
    const res = await as(mod).post(`${api}/forum/held/${opening.id}/reject`, { reason: 'Spam' });
    expect(res.status).toBe(200);
    expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toBeNull();
    expect((await threadPage(author, thread.id)).status).toBe(404);
  });

  it('of two stewards deciding one post at once, exactly one lands', async () => {
    const author = await makeUser('user');
    const { thread } = await publishedThread(author);
    const held = await heldReply(thread.id, author);
    const accept = await preparePost(`${api}/forum/held/${held.id}/accept`, mod.user, {}, mod.device);
    const reject = await preparePost(`${api}/forum/held/${held.id}/reject`, modB.user, { reason: 'Race' }, modB.device);
    const results = await Promise.all([accept(), reject()]);
    const statuses = results.map(r => r.status);
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s === 404 || s === 409)).toHaveLength(1);
    const log = await prisma.staffActionLog.count({
      where: { targetType: 'post', targetId: String(held.id), outcome: 'succeeded' },
    });
    expect(log).toBe(1);
  });

  it("refuses a moderator deciding their own held post or another moderator's", async () => {
    const { thread } = await publishedThread(await makeUser('user'));
    const own = await heldReply(thread.id, mod.user);
    const other = await heldReply(thread.id, modB.user);
    const self = await as(mod).post(`${api}/forum/held/${own.id}/accept`, {});
    const peer = await as(mod).post(`${api}/forum/held/${other.id}/reject`, { reason: 'test' });
    expect(self.body.code).toBe('staffTargetSelf');
    expect(peer.body.code).toBe('staffTargetStaff');
    expect([self.status, peer.status]).toEqual([403, 403]);
    expect((await prisma.forumPost.findUnique({ where: { id: own.id } })).status).toBe('held');
    expect(await prisma.forumPost.findUnique({ where: { id: other.id } })).not.toBeNull();
  });
});

describe('Editing and removing posts', () => {
  it("edits a player's post with a reason and logs the old and new words", async () => {
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const { thread, opening } = await publishedThread(author);
    const res = await as(mod).post(`${api}/forum/posts/${opening.id}/edit`, {
      content: 'Opening words (edited by a steward)',
      reason: 'Removed a phone number',
    });
    expect(res.status).toBe(200);
    const page = await threadPage(reader, thread.id);
    expect(page.body.data.posts[0].content).toBe('Opening words (edited by a steward)');
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: mod.user.id, targetType: 'post', targetId: String(opening.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'post.moderate',
      before: { content: 'Opening words' },
      after: { content: 'Opening words (edited by a steward)' },
    });
  });

  it('refuses an edit without a reason or without words, and refuses a player', async () => {
    const author = await makeUser('user');
    const player = await makeUser('user');
    const { opening } = await publishedThread(author);
    const noReason = await as(mod).post(`${api}/forum/posts/${opening.id}/edit`, { content: 'x' });
    const empty = await as(mod).post(`${api}/forum/posts/${opening.id}/edit`, {
      content: '   ',
      reason: 'test',
    });
    const byPlayer = await post(`${api}/forum/posts/${opening.id}/edit`, player, {
      content: 'mine now',
      reason: 'test',
    });
    expect([noReason.status, empty.status, byPlayer.status]).toEqual([400, 400, 404]);
    expect((await prisma.forumPost.findUnique({ where: { id: opening.id } })).content).toBe('Opening words');
  });

  it('removes a reply, and removing an opening post removes the thread', async () => {
    const author = await makeUser('user');
    const replier = await makeUser('user');
    const { thread, opening } = await publishedThread(author);
    const reply = await prisma.forumPost.create({
      data: { threadId: thread.id, authorId: replier.id, content: 'Rude reply' },
    });
    const gone = await as(mod).post(`${api}/forum/posts/${reply.id}/remove`, { reason: 'Rude' });
    expect(gone.status).toBe(200);
    expect(gone.body.removed).toBe('post');
    expect(postIds(await threadPage(author, thread.id))).toEqual([opening.id]);

    const whole = await as(mod).post(`${api}/forum/posts/${opening.id}/remove`, { reason: 'Spam' });
    expect(whole.status).toBe(200);
    expect(whole.body.removed).toBe('thread');
    expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toBeNull();
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: mod.user.id, targetType: 'post', targetId: String(opening.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ before: { threadTitle: thread.title, isOpening: true } });
  });

  it("refuses a moderator editing another moderator's post", async () => {
    const { opening } = await publishedThread(modB.user);
    const res = await as(mod).post(`${api}/forum/posts/${opening.id}/edit`, {
      content: 'changed',
      reason: 'test',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffTargetStaff');
  });
});
