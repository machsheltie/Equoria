/**
 * The forum's blocked-word and review-word lists: real HTTP, real DB
 * (Equoria-puj1e.3, owner rulings q375, q376, q380 and q381).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - only the Owner and Admins read and change the lists; a moderator is refused
 *    with the capability code and a player with the unknown-route 404 (q381);
 *  - a word is stored lowercased; a duplicate or a non-word is refused; every add
 *    and remove writes one staff log entry;
 *  - a blocked word refuses a new thread or reply, without naming the word; a review
 *    word saves it held, seen only by its author (q376) and waiting in the queue;
 *  - matching is whole words only, ignoring capitals (q380): the word inside a
 *    longer word does not count, the same word in capitals or beside punctuation
 *    does.
 *
 * The words are random per run, so no other suite's forum text can contain them,
 * and only the rows this file creates are removed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
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

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('forumwords');
const createdWords = [];

let owner;
let admin;
let mod;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.forumWord.deleteMany({ where: { word: { in: createdWords } } }), 'words');
  cleanup.add(() => prisma.forumThread.deleteMany({ where: { authorId: scope() } }), 'threads');
  cleanup.add(() => prisma.forumPost.deleteMany({ where: { authorId: scope() } }), 'posts');
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
  owner = await staff('owner');
  admin = await staff('admin');
  mod = await staff('moderator');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

const as = steward => ({
  get: url => get(url, steward.user, steward.device),
  post: (url, body) => post(url, steward.user, body, steward.device),
});

/** A fresh word no other text in the game can contain. */
const freshWord = () => {
  const word = `zq${uid()}`;
  createdWords.push(word);
  return word;
};

/** Put `word` on `list` through the real route, as an admin. */
async function listWord(list, word) {
  const res = await as(admin).post(`${api}/forum/words`, { list, word });
  expect(res.status).toBe(200);
  return res.body;
}

async function publishedThread(author) {
  const thread = await prisma.forumThread.create({
    data: { section: 'general', title: `TestFixture-forumwords-${uid()}`, authorId: author.id },
  });
  await prisma.forumPost.create({
    data: { threadId: thread.id, authorId: author.id, content: 'Opening words' },
  });
  return thread;
}

const newThread = (author, title, content) => post(`${forum}/threads`, author, { section: 'general', title, content });
const reply = (author, threadId, content) => post(`${forum}/threads/${threadId}/posts`, author, { content });

describe('Who may read and change the word lists (q381)', () => {
  it('refuses a player with the unknown-route 404 and changes nothing', async () => {
    const player = await makeUser('user');
    const word = freshWord();
    expect((await get(`${api}/forum/words`, player)).status).toBe(404);
    const add = await post(`${api}/forum/words`, player, { list: 'blocked', word });
    expect(add.status).toBe(404);
    expect(await prisma.forumWord.count({ where: { word } })).toBe(0);
  });

  it('refuses a moderator reading, adding or removing words', async () => {
    const word = freshWord();
    const { id } = await listWord('review', word);
    const read = await as(mod).get(`${api}/forum/words`);
    const add = await as(mod).post(`${api}/forum/words`, { list: 'blocked', word: freshWord() });
    const remove = await as(mod).post(`${api}/forum/words/${id}/remove`, {});
    for (const res of [read, add, remove]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('staffCapabilityRequired');
    }
    expect(await prisma.forumWord.count({ where: { word } })).toBe(1);
    // (The moderator's check-in is in the log; no word change is.)
    expect(
      await prisma.staffActionLog.count({
        where: { actorId: mod.user.id, capability: 'words.manage' },
      }),
    ).toBe(0);
  });

  it('lets an admin add a word, lowercased, and logs it once', async () => {
    const word = freshWord();
    const res = await as(admin).post(`${api}/forum/words`, {
      list: 'blocked',
      word: `  ${word.toUpperCase()} `,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ list: 'blocked', word });
    const lists = await as(admin).get(`${api}/forum/words`);
    expect(lists.status).toBe(200);
    expect(lists.body.blocked).toContainEqual({ id: res.body.id, word });
    expect(lists.body.review.some(w => w.word === word)).toBe(false);
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: admin.user.id, targetType: 'forumWord', targetId: String(res.body.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ capability: 'words.manage', after: { list: 'blocked', word } });
  });

  it('lets the owner add and remove a word, and logs both', async () => {
    const word = freshWord();
    const added = await as(owner).post(`${api}/forum/words`, { list: 'review', word });
    expect(added.status).toBe(200);
    const removed = await as(owner).post(`${api}/forum/words/${added.body.id}/remove`, {});
    expect(removed.status).toBe(200);
    expect(await prisma.forumWord.count({ where: { word } })).toBe(0);
    const log = await prisma.staffActionLog.findMany({
      where: { actorId: owner.user.id, targetType: 'forumWord', targetId: String(added.body.id) },
      orderBy: { id: 'asc' },
    });
    expect(log.map(entry => entry.capability)).toEqual(['words.manage', 'words.manage']);
    expect(log[1]).toMatchObject({ before: { list: 'review', word }, after: { removed: true } });

    const again = await as(owner).post(`${api}/forum/words/${added.body.id}/remove`, {});
    expect(again.status).toBe(404);
    expect(again.body.code).toBe('forumWordNotFound');
  });

  it('refuses a duplicate, a non-word and an unknown list', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    const dup = await as(admin).post(`${api}/forum/words`, { list: 'blocked', word: word.toUpperCase() });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('forumWordExists');
    const bad = await as(admin).post(`${api}/forum/words`, { list: 'blocked', word: `${word}!*` });
    const blank = await as(admin).post(`${api}/forum/words`, { list: 'review', word: '   ' });
    const list = await as(admin).post(`${api}/forum/words`, { list: 'secret', word: freshWord() });
    expect([bad.status, blank.status, list.status]).toEqual([400, 400, 400]);
    expect([bad.body.code, blank.body.code, list.body.code]).toEqual([
      'forumWordInvalid',
      'forumWordInvalid',
      'forumWordList',
    ]);
    expect(await prisma.forumWord.count({ where: { word } })).toBe(1);
  });

  it('lets the same word sit on the review list as well as the blocked list', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    await listWord('review', word);
    expect(await prisma.forumWord.count({ where: { word } })).toBe(2);
  });
});

describe('Blocked words refuse a post, whole words only, ignoring capitals (q380)', () => {
  it('refuses a new thread with a blocked word in its title, without naming the word', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    const author = await makeUser('user');
    const res = await newThread(author, `About ${word} today`, 'Fine words');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('forumBlockedWord');
    expect(JSON.stringify(res.body)).not.toContain(word);
    expect(await prisma.forumThread.count({ where: { authorId: author.id } })).toBe(0);
  });

  it('refuses a reply with the word in capitals or beside punctuation', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    const author = await makeUser('user');
    const thread = await publishedThread(await makeUser('user'));
    for (const content of [`Well ${word.toUpperCase()} then`, `(${word}), really.`, `${word}'s fault`]) {
      const res = await reply(author, thread.id, content);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('forumBlockedWord');
    }
    expect(await prisma.forumPost.count({ where: { authorId: author.id } })).toBe(0);
  });

  it('publishes a post where the word is only part of a longer word', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    const author = await makeUser('user');
    const thread = await publishedThread(await makeUser('user'));
    // A letter or number before or after it makes a different, longer word.
    const clean = await reply(author, thread.id, `class${word} and ${word}es and ${word}7`);
    expect(clean.status).toBe(201);
    expect(clean.body.data.post.status).toBe('published');
  });

  it('treats an underscore or hyphen as the end of a word', async () => {
    const word = freshWord();
    await listWord('blocked', word);
    const author = await makeUser('user');
    const thread = await publishedThread(await makeUser('user'));
    for (const content of [`a ${word}_hat`, `a ${word}-hat`]) {
      const res = await reply(author, thread.id, content);
      expect(res.status).toBe(400);
    }
  });

  it('matches a listed phrase whatever its spacing and capitals', async () => {
    const first = freshWord();
    const phrase = `${first} cheap`;
    await listWord('blocked', phrase);
    const author = await makeUser('user');
    const thread = await publishedThread(await makeUser('user'));
    const res = await reply(author, thread.id, `Buy ${first.toUpperCase()}   Cheap now`);
    expect(res.status).toBe(400);
    const apart = await reply(author, thread.id, `${first} is not cheap`);
    expect(apart.status).toBe(201);
  });

  it('a blocked word wins over a review word in the same post', async () => {
    const blocked = freshWord();
    const review = freshWord();
    await listWord('blocked', blocked);
    await listWord('review', review);
    const author = await makeUser('user');
    const res = await newThread(author, `${review} title`, `and ${blocked} body`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('forumBlockedWord');
  });
});

describe('Review words hold a post for a moderator (q376)', () => {
  it('holds a reply: only its author sees it, the thread is not bumped, and it waits in the queue', async () => {
    const word = freshWord();
    await listWord('review', word);
    const starter = await makeUser('user');
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const thread = await publishedThread(starter);
    const before = (await prisma.forumThread.findUnique({ where: { id: thread.id } })).lastActivityAt;

    const res = await reply(author, thread.id, `My ${word.toUpperCase()} colt`);
    expect(res.status).toBe(201);
    expect(res.body.data.post.status).toBe('held');
    const postId = res.body.data.post.id;

    const own = await get(`${forum}/threads/${thread.id}`, author);
    expect(own.body.data.posts.find(p => p.id === postId)).toMatchObject({ status: 'held' });
    for (const viewer of [reader, starter]) {
      const page = await get(`${forum}/threads/${thread.id}`, viewer);
      expect(page.body.data.posts.some(p => p.id === postId)).toBe(false);
    }
    const after = (await prisma.forumThread.findUnique({ where: { id: thread.id } })).lastActivityAt;
    expect(after.getTime()).toBe(before.getTime());

    const queue = await as(mod).get(`${api}/forum/held?after=${postId - 1}`);
    expect(queue.status).toBe(200);
    expect(queue.body.posts.map(p => p.id)).toContain(postId);
  });

  it('holds a new thread with a review word in its body: missing to everyone but its author', async () => {
    const word = freshWord();
    await listWord('review', word);
    const author = await makeUser('user');
    const reader = await makeUser('user');
    const res = await newThread(author, 'A quiet title', `Selling ${word} cheap`);
    expect(res.status).toBe(201);
    expect(res.body.data.thread.status).toBe('held');
    expect(res.body.data.firstPost.status).toBe('held');
    const id = res.body.data.thread.id;

    expect((await get(`${forum}/threads/${id}`, reader)).status).toBe(404);
    expect((await get(`${forum}/threads/${id}`, author)).status).toBe(200);
    const listed = await get(`${forum}/threads?section=general&limit=100`, reader);
    expect(listed.body.data.threads.some(t => t.id === id)).toBe(false);
  });

  it('publishes a post with no listed word', async () => {
    const author = await makeUser('user');
    const res = await newThread(author, `Plain ${uid()}`, 'Nothing to see');
    expect(res.status).toBe(201);
    expect(res.body.data.thread.status).toBe('published');
  });
});
