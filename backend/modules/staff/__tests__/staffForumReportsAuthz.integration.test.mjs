/**
 * Players' reports of forum posts: real HTTP, real DB (Equoria-puj1e.3, owner
 * ruling q382). Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - a player reports someone else's post for one of four reasons (other needs a
 *    note); the thread page then says so to the reporter only;
 *  - one open report per player per post, also when two arrive at once; once a
 *    steward decides it, the player may report the post again;
 *  - a player cannot report their own post, or one they cannot see;
 *  - moderators list open reports oldest first with the reason, note, post and
 *    thread, and resolve or dismiss each once, in the staff log;
 *  - players are refused the staff routes with the unknown-route 404; no steward
 *    decides a report about their own post or another moderator's.
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
const { makeUser, createdUserIds } = createUserFactory('forumreport');

let mod;
let modB;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  // Reports cascade from their posts and reporters.
  cleanup.add(() => prisma.forumReport.deleteMany({ where: { reporterId: scope() } }), 'reports');
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

/** A published thread whose opening post is by `author`. */
async function postBy(author, extra = {}) {
  const thread = await prisma.forumThread.create({
    data: {
      section: 'general',
      title: `TestFixture-forumreport-${uid()}`,
      authorId: author.id,
      status: extra.status ?? 'published',
    },
  });
  const opening = await prisma.forumPost.create({
    data: {
      threadId: thread.id,
      authorId: author.id,
      content: 'Rude words here',
      status: extra.status ?? 'published',
    },
  });
  return { thread, opening };
}

const report = (player, postId, body) => post(`${forum}/posts/${postId}/report`, player, body);
const openReports = async (steward, after = 0) => {
  const res = await as(steward).get(`${api}/forum/reports?after=${after}`);
  expect(res.status).toBe(200);
  return res.body.reports;
};

describe('A player reports a post (q382)', () => {
  it('files a report, which the reporter (and only the reporter) sees on the thread', async () => {
    const author = await makeUser('user');
    const reporter = await makeUser('user');
    const reader = await makeUser('user');
    const { thread, opening } = await postBy(author);

    const res = await report(reporter, opening.id, { reason: 'rudeOrBullying' });
    expect(res.status).toBe(201);
    const rows = await prisma.forumReport.findMany({ where: { postId: opening.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      reporterId: reporter.id,
      reason: 'rudeOrBullying',
      note: null,
      status: 'open',
    });

    const mine = await get(`${forum}/threads/${thread.id}`, reporter);
    expect(mine.body.data.posts[0].reportedByMe).toBe(true);
    const theirs = await get(`${forum}/threads/${thread.id}`, reader);
    expect(theirs.body.data.posts[0].reportedByMe).toBe(false);
  });

  it('needs a known reason, and a note for other', async () => {
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    const none = await report(reporter, opening.id, {});
    const unknown = await report(reporter, opening.id, { reason: 'boring' });
    const bare = await report(reporter, opening.id, { reason: 'other', note: '   ' });
    expect([none.status, unknown.status, bare.status]).toEqual([400, 400, 400]);
    expect([none.body.code, unknown.body.code, bare.body.code]).toEqual([
      'forumReportReason',
      'forumReportReason',
      'forumReportNote',
    ]);
    expect(await prisma.forumReport.count({ where: { postId: opening.id } })).toBe(0);

    const other = await report(reporter, opening.id, { reason: 'other', note: ' Copied my art ' });
    expect(other.status).toBe(201);
    const row = await prisma.forumReport.findFirst({ where: { postId: opening.id } });
    expect(row).toMatchObject({ reason: 'other', note: 'Copied my art' });
  });

  it('refuses a second open report on the same post, then allows one after a decision', async () => {
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    expect((await report(reporter, opening.id, { reason: 'spamOrSelling' })).status).toBe(201);
    const again = await report(reporter, opening.id, { reason: 'personalInformation' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('forumReportDuplicate');

    const filed = await prisma.forumReport.findFirst({ where: { postId: opening.id } });
    expect((await as(mod).post(`${api}/forum/reports/${filed.id}/dismiss`, {})).status).toBe(200);
    const later = await report(reporter, opening.id, { reason: 'personalInformation' });
    expect(later.status).toBe(201);
    expect(await prisma.forumReport.count({ where: { postId: opening.id } })).toBe(2);
  });

  it('keeps exactly one open report when the same player sends two at once', async () => {
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    const url = `${forum}/posts/${opening.id}/report`;
    const first = await preparePost(url, reporter, { reason: 'spamOrSelling' });
    const second = await preparePost(url, reporter, { reason: 'rudeOrBullying' });
    const results = await Promise.all([first(), second()]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.forumReport.count({ where: { postId: opening.id } })).toBe(1);
  });

  it("refuses a player's own post, a held post and a missing post", async () => {
    const reporter = await makeUser('user');
    const own = await postBy(reporter);
    const held = await postBy(await makeUser('user'), { status: 'held' });
    const self = await report(reporter, own.opening.id, { reason: 'spamOrSelling' });
    const hidden = await report(reporter, held.opening.id, { reason: 'spamOrSelling' });
    const missing = await report(reporter, 2_000_000_000, { reason: 'spamOrSelling' });
    expect([self.status, hidden.status, missing.status]).toEqual([400, 404, 404]);
    expect(self.body.code).toBe('forumReportOwnPost');
    expect(
      await prisma.forumReport.count({
        where: { postId: { in: [own.opening.id, held.opening.id] } },
      }),
    ).toBe(0);
  });
});

describe('Moderators decide reports', () => {
  it('lists open reports oldest first with the reason, note, post, thread and reporter', async () => {
    const author = await makeUser('user');
    const reporter = await makeUser('user');
    const { thread, opening } = await postBy(author);
    const second = await postBy(author);
    await report(reporter, opening.id, { reason: 'other', note: 'Shares a phone number' });
    await report(reporter, second.opening.id, { reason: 'spamOrSelling' });
    const ids = (
      await prisma.forumReport.findMany({
        where: { reporterId: reporter.id },
        orderBy: { id: 'asc' },
      })
    ).map(r => r.id);

    const mine = (await openReports(mod, ids[0] - 1)).filter(r => ids.includes(r.id));
    expect(mine.map(r => r.id)).toEqual(ids);
    expect(mine[0]).toMatchObject({
      reason: 'other',
      note: 'Shares a phone number',
      reporter: { id: reporter.id, username: reporter.username },
      post: {
        id: opening.id,
        content: opening.content,
        author: { id: author.id, username: author.username },
        thread: { id: thread.id, title: thread.title },
      },
    });
  });

  it('resolving a report logs it once, removes it from the list and cannot be repeated', async () => {
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    await report(reporter, opening.id, { reason: 'rudeOrBullying' });
    const filed = await prisma.forumReport.findFirst({ where: { postId: opening.id } });

    const res = await as(mod).post(`${api}/forum/reports/${filed.id}/resolve`, {
      reason: 'Removed the insult',
    });
    expect(res.status).toBe(200);
    const row = await prisma.forumReport.findUnique({ where: { id: filed.id } });
    expect(row).toMatchObject({ status: 'resolved', decidedById: mod.user.id });
    expect(row.decidedAt).not.toBeNull();
    expect((await openReports(mod, filed.id - 1)).some(r => r.id === filed.id)).toBe(false);
    const log = await prisma.staffActionLog.findMany({
      where: { targetType: 'report', targetId: String(filed.id) },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actorId: mod.user.id,
      capability: 'report.review',
      reason: 'Removed the insult',
      after: { status: 'resolved' },
    });

    const again = await as(modB).post(`${api}/forum/reports/${filed.id}/dismiss`, {});
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('forumReportDecided');
  });

  it('of two stewards deciding one report at once, exactly one lands', async () => {
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    await report(reporter, opening.id, { reason: 'spamOrSelling' });
    const filed = await prisma.forumReport.findFirst({ where: { postId: opening.id } });
    const resolve = await preparePost(`${api}/forum/reports/${filed.id}/resolve`, mod.user, {}, mod.device);
    const dismiss = await preparePost(`${api}/forum/reports/${filed.id}/dismiss`, modB.user, {}, modB.device);
    const statuses = (await Promise.all([resolve(), dismiss()])).map(r => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
    const log = await prisma.staffActionLog.count({
      where: { targetType: 'report', targetId: String(filed.id), outcome: 'succeeded' },
    });
    expect(log).toBe(1);
  });

  it('refuses a player the list and the decisions with the unknown-route 404', async () => {
    const player = await makeUser('user');
    const reporter = await makeUser('user');
    const { opening } = await postBy(await makeUser('user'));
    await report(reporter, opening.id, { reason: 'spamOrSelling' });
    const filed = await prisma.forumReport.findFirst({ where: { postId: opening.id } });
    expect((await get(`${api}/forum/reports`, player)).status).toBe(404);
    expect((await post(`${api}/forum/reports/${filed.id}/resolve`, player, {})).status).toBe(404);
    expect((await post(`${api}/forum/reports/${filed.id}/dismiss`, player, {})).status).toBe(404);
    expect((await prisma.forumReport.findUnique({ where: { id: filed.id } })).status).toBe('open');
  });

  it("refuses a moderator deciding a report about their own post or another moderator's", async () => {
    const reporter = await makeUser('user');
    const own = await postBy(mod.user);
    const peer = await postBy(modB.user);
    await report(reporter, own.opening.id, { reason: 'rudeOrBullying' });
    await report(reporter, peer.opening.id, { reason: 'rudeOrBullying' });
    const [ownReport, peerReport] = await Promise.all(
      [own, peer].map(p => prisma.forumReport.findFirst({ where: { postId: p.opening.id } })),
    );
    const self = await as(mod).post(`${api}/forum/reports/${ownReport.id}/dismiss`, {});
    const other = await as(mod).post(`${api}/forum/reports/${peerReport.id}/dismiss`, {});
    expect([self.status, other.status]).toEqual([403, 403]);
    expect([self.body.code, other.body.code]).toEqual(['staffTargetSelf', 'staffTargetStaff']);
    const statuses = await prisma.forumReport.findMany({
      where: { id: { in: [ownReport.id, peerReport.id] } },
      select: { status: true },
    });
    expect(statuses.map(s => s.status)).toEqual(['open', 'open']);
  });

  it('a report leaves the list when a steward removes the post', async () => {
    const reporter = await makeUser('user');
    const { thread } = await postBy(await makeUser('user'));
    const replyPost = await prisma.forumPost.create({
      data: { threadId: thread.id, authorId: (await makeUser('user')).id, content: 'Spam reply' },
    });
    await report(reporter, replyPost.id, { reason: 'spamOrSelling' });
    const filed = await prisma.forumReport.findFirst({ where: { postId: replyPost.id } });
    const gone = await as(mod).post(`${api}/forum/posts/${replyPost.id}/remove`, { reason: 'Spam' });
    expect(gone.status).toBe(200);
    expect(await prisma.forumReport.findUnique({ where: { id: filed.id } })).toBeNull();
  });
});
