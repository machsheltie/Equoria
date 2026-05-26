/**
 * forumReplySseProducer.integration.test.mjs (Equoria-pwwuz, ADR-011)
 *
 * Real-DB integration coverage for the forum-reply SSE producer added to
 * forumController.createPost. No mocks: real Express app, real prisma writes,
 * real event bus. Mirrors the DM 'message' producer coverage in
 * modules/events/__tests__/eventStream.integration.test.mjs (Equoria-lewrv).
 *
 * Asserts:
 *   1. a reply by user B to user A's thread emits an `event: forum_reply`
 *      frame on user A's (the thread author's) SSE stream;
 *   2. the REPLIER (B) does NOT receive it on their own stream (per-user
 *      isolation — the producer publishes to the thread author only);
 *   3. a reply by the thread author to their OWN thread emits NO forum_reply
 *      (no self-notify).
 *
 * SSE is a long-lived streaming response; supertest's buffered model handles
 * it poorly, so the app runs on an ephemeral port and Node's raw http client
 * observes chunks as they arrive (same harness as eventStream.integration).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { userListenerCount } from '../../../services/eventBus.mjs';
// Exercise the REAL reply producer (real controller, real prisma, real bus).
import { createPost } from '../controllers/forumController.mjs';

/** Poll until predicate true or timeout — avoids order-dependent fixed waits. */
async function waitFor(predicate, { timeout = 4000, interval = 50 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate()) {
      return true;
    }
    if (Date.now() - start > timeout) {
      return false;
    }
    await new Promise(r => setTimeout(r, interval));
  }
}

describe('INTEGRATION: forum-reply SSE producer (Equoria-pwwuz)', () => {
  let server;
  let baseUrl;
  let author; // owns the thread
  let authorToken;
  let replier; // posts the reply
  let replierToken;
  let thread;
  const createdPostIds = [];
  const openReqs = new Set();

  beforeAll(async () => {
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    author = await prisma.user.create({
      data: {
        email: `pwwuz-author-${randomBytes(4).toString('hex')}@test.com`,
        username: `pwwuzAuthor${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Forum',
        lastName: 'Author',
      },
    });
    replier = await prisma.user.create({
      data: {
        email: `pwwuz-replier-${randomBytes(4).toString('hex')}@test.com`,
        username: `pwwuzReplier${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Forum',
        lastName: 'Replier',
      },
    });
    authorToken = generateTestToken({ id: author.id, email: author.email, role: 'user' });
    replierToken = generateTestToken({ id: replier.id, email: replier.email, role: 'user' });

    thread = await prisma.forumThread.create({
      data: {
        section: 'general',
        title: 'TestFixture-pwwuz reply thread',
        authorId: author.id,
        posts: { create: [{ authorId: author.id, content: 'TestFixture-pwwuz first post' }] },
      },
    });
  }, 60000);

  afterAll(async () => {
    for (const req of openReqs) {
      req.destroy();
    }
    openReqs.clear();
    await new Promise(r => setTimeout(r, 200));
    // Scoped cleanup — only the rows this suite created.
    if (createdPostIds.length > 0) {
      await prisma.forumPost.deleteMany({ where: { id: { in: createdPostIds } } }).catch(() => {});
    }
    await prisma.forumPost.deleteMany({ where: { threadId: thread.id } }).catch(() => {});
    await prisma.forumThread.deleteMany({ where: { id: thread.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: author.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: replier.id } }).catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }, 60000);

  function openStream(token) {
    return new Promise((resolve, reject) => {
      const headers = { Accept: 'text/event-stream', Authorization: `Bearer ${token}` };
      const req = http.get(`${baseUrl}/api/v1/events/stream`, { headers }, res => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', d => chunks.push(d));
        resolve({
          res,
          chunks,
          close: () => {
            req.destroy();
            openReqs.delete(req);
          },
        });
      });
      openReqs.add(req);
      req.on('error', err => {
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /** Invoke the real createPost controller with a minimal req/res double. */
  async function postReply(actingUserId, content) {
    const req = { params: { id: String(thread.id) }, body: { content }, user: { id: actingUserId } };
    let status = 200;
    let body;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        if (payload?.data?.post?.id) {
          createdPostIds.push(payload.data.post.id);
        }
        return this;
      },
    };
    await createPost(req, res);
    return { status, body };
  }

  it("emits 'forum_reply' to the thread author and NOT the replier", async () => {
    const authorStream = await openStream(authorToken);
    const replierStream = await openStream(replierToken);
    await waitFor(() => userListenerCount(author.id) >= 1);
    await waitFor(() => userListenerCount(replier.id) >= 1);

    try {
      const { status } = await postReply(replier.id, 'TestFixture-pwwuz reply content');
      expect(status).toBe(201);

      // Thread author MUST receive the forum_reply frame.
      const authorGot = await waitFor(() =>
        authorStream.chunks.join('').includes('event: forum_reply'),
      );
      expect(authorGot).toBe(true);
      expect(authorStream.chunks.join('')).toContain(`"threadId":${thread.id}`);

      // The replier must NOT receive it on their own stream (per-user isolation).
      await wait(400);
      expect(replierStream.chunks.join('')).not.toContain('event: forum_reply');
    } finally {
      authorStream.close();
      replierStream.close();
    }
  });

  it('does NOT emit forum_reply when the thread author replies to their own thread (no self-notify)', async () => {
    const authorStream = await openStream(authorToken);
    await waitFor(() => userListenerCount(author.id) >= 1);

    try {
      const { status } = await postReply(author.id, 'TestFixture-pwwuz self reply');
      expect(status).toBe(201);
      // Give ample time for a (wrongful) self-notify, then assert none.
      await wait(500);
      expect(authorStream.chunks.join('')).not.toContain('event: forum_reply');
    } finally {
      authorStream.close();
    }
  });
});
