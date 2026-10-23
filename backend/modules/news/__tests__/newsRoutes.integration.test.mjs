/**
 * Equoria-wbt8l — the News API through the real Express app and database.
 *
 * Owner rulings 2026-10-23:
 *   - every logged-in player reads News (GET /api/v1/news), newest first, and
 *     sees a post only from its publishAt on;
 *   - staff write at the News Desk (/api/v1/admin/news). The owner (Head
 *     Admin) writes seasonal events, Head Admin letters, updates and contests;
 *     an Admin writes only their own letter ('From Admin <name>'); moderators
 *     and players write nothing;
 *   - tile pictures are uploaded at the desk into the approved Supabase
 *     storage, through uploadGuard; tile URLs must point into that bucket.
 *
 * Every staff level goes through HTTP: the /admin router's requireRole('admin')
 * admits the owner through satisfiesRole (Equoria-4tleh), and the desk asks
 * the staff capability policy for each post type.
 *
 * Supabase Storage is a third-party network boundary with no local sandbox:
 * the upload test points SUPABASE_URL at a local HTTP server standing in for
 * it, and keeps the real route, auth, CSRF, upload guard and response path.
 *
 * Fixtures are owned by this file and removed id-scoped, fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'node:http';
import { createHash } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { snapshotEnv, restoreEnv } from '../../../tests/helpers/envSnapshot.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { listPublishedNews } from '../services/newsFeedService.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = `TestFixture-wbt8l-${Date.now()}`;
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('a tiny stand-in picture body'),
]);

const cleanup = createCleanupTracker();
const postIds = [];
const actors = {};

async function makeActor(label, role) {
  const { user, token } = await createTestUser({
    username: `${PREFIX}-${label}`.slice(0, 40),
    email: `${PREFIX}-${label}@example.com`.toLowerCase(),
    ...(role ? { role } : {}),
  });
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return { user, token, csrf };
}

function get(actor, path) {
  return request(app).get(path).set('Authorization', `Bearer ${actor.token}`);
}

function mutate(method, actor, path) {
  const agent = request(app);
  return agent[method](path)
    .set('Authorization', `Bearer ${actor.token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', actor.csrf.cookieHeader)
    .set('X-CSRF-Token', actor.csrf.csrfToken);
}

async function seedPost(data) {
  const row = await prisma.newsItem.create({ data: { body: 'Seeded for a test.', ...data } });
  postIds.push(row.id);
  return row;
}

beforeAll(async () => {
  actors.player = await makeActor('player');
  actors.moderator = await makeActor('mod', 'moderator');
  actors.admin = await makeActor('admin', 'admin');
  actors.otherAdmin = await makeActor('admin2', 'admin');
  actors.owner = await makeActor('owner', 'owner');
}, 120000);

afterAll(async () => {
  cleanup.add(() => prisma.newsItem.deleteMany({ where: { id: { in: postIds } } }), 'news');
  cleanup.add(
    () =>
      prisma.newsItem.deleteMany({
        where: { authorUserId: { in: Object.values(actors).map(a => a.user.id) } },
      }),
    'news by fixture authors',
  );
  cleanup.add(() => cleanupTestData(), 'users');
  await cleanup.run();
}, 120000);

describe('GET /api/v1/news — players read published News', () => {
  it('refuses a visitor who is not logged in', async () => {
    const res = await request(app).get('/api/v1/news');
    expect(res.status).toBe(401);
  });

  it('shows a published post to a player and hides one scheduled for later', async () => {
    const published = await seedPost({
      postType: 'update',
      title: `${PREFIX} published`,
      publishAt: new Date(Date.now() - 60_000),
    });
    const scheduled = await seedPost({
      postType: 'seasonalEvent',
      title: `${PREFIX} scheduled`,
      publishAt: new Date(Date.now() + 7 * 86_400_000),
    });

    const res = await get(actors.player, '/api/v1/news?limit=50');

    expect(res.status).toBe(200);
    const ids = res.body.data.items.map(item => item.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(scheduled.id);
    const item = res.body.data.items.find(i => i.id === published.id);
    expect(item).toMatchObject({ postType: 'update', title: `${PREFIX} published`, tiles: [] });
    expect(item.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lists under Ahead a published post whose end is still to come', async () => {
    const contest = await seedPost({
      postType: 'contest',
      title: `${PREFIX} contest`,
      publishAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3 * 86_400_000),
    });

    const res = await get(actors.player, '/api/v1/news');

    expect(res.status).toBe(200);
    const ahead = res.body.data.ahead.find(i => i.id === contest.id);
    expect(ahead).toBeDefined();
    expect(ahead.lastGameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pages newest first by cursor, without repeating or skipping an entry', async () => {
    // Entries in 2001: no other data lives there, so these are the only rows
    // before the starting cursor.
    const oldest = await seedPost({
      postType: 'update',
      title: `${PREFIX} p1`,
      publishAt: new Date('2001-03-01T12:00:00Z'),
    });
    const middle = await seedPost({
      postType: 'update',
      title: `${PREFIX} p2`,
      publishAt: new Date('2001-03-02T12:00:00Z'),
    });
    const newest = await seedPost({
      postType: 'update',
      title: `${PREFIX} p3`,
      publishAt: new Date('2001-03-02T12:00:00Z'),
    });
    const start = `${new Date('2001-03-03T00:00:00Z').getTime()}.2147483647`;

    const first = await get(actors.player, `/api/v1/news?before=${start}&limit=2`);
    expect(first.status).toBe(200);
    expect(first.body.data.items.map(i => i.id)).toEqual([newest.id, middle.id]);
    expect(first.body.data.ahead).toBeNull();
    expect(first.body.data.nextCursor).toEqual(expect.any(String));

    const second = await get(actors.player, `/api/v1/news?before=${first.body.data.nextCursor}&limit=2`);
    expect(second.status).toBe(200);
    expect(second.body.data.items.map(i => i.id)).toEqual([oldest.id]);
  });

  it('refuses a malformed cursor', async () => {
    const res = await get(actors.player, '/api/v1/news?before=yesterday');
    expect(res.status).toBe(400);
  });
});

describe('News Desk — who may write', () => {
  it('turns away players and moderators at the desk', async () => {
    expect((await get(actors.player, '/api/v1/admin/news')).status).toBe(403);
    expect((await get(actors.moderator, '/api/v1/admin/news')).status).toBe(403);
    const asPlayer = await mutate('post', actors.player, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: 'x',
      body: 'y',
    });
    expect(asPlayer.status).toBe(403);
    const asModerator = await mutate('post', actors.moderator, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: 'x',
      body: 'y',
    });
    expect(asModerator.status).toBe(403);
  });

  it("offers an Admin only their own letter, signed with their name and 'Admin'", async () => {
    const desk = await get(actors.admin, '/api/v1/admin/news');
    expect(desk.status).toBe(200);
    expect(desk.body.data.allowedTypes).toEqual(['adminLetter']);

    const res = await mutate('post', actors.admin, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: `${PREFIX} a letter`,
      body: 'Hello riders.',
    });
    expect(res.status).toBe(201);
    postIds.push(res.body.data.post.id);
    expect(res.body.data.post).toMatchObject({
      postType: 'adminLetter',
      authorName: actors.admin.user.username,
      authorRoleLabel: 'Admin',
    });
  });

  it.each(['seasonalEvent', 'headAdminLetter', 'update', 'contest'])(
    'refuses an Admin a %s post (the owner’s alone)',
    async postType => {
      const res = await mutate('post', actors.admin, '/api/v1/admin/news').send({
        postType,
        title: `${PREFIX} not allowed`,
        body: 'No.',
        ...(postType === 'seasonalEvent' ? { month: '2099-12' } : {}),
      });
      expect(res.status).toBe(403);
    },
  );

  it('refuses a game-written type and an unknown field', async () => {
    const gameType = await mutate('post', actors.admin, '/api/v1/admin/news').send({
      postType: 'clubNews',
      title: 'x',
      body: 'y',
    });
    expect(gameType.status).toBe(400);
    const extra = await mutate('post', actors.admin, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: 'x',
      body: 'y',
      authorName: 'Stacey',
    });
    expect(extra.status).toBe(400);
  });

  it('gives the owner every type: seasonal event, Head Admin letter, update, contest and an admin letter', async () => {
    const desk = await get(actors.owner, '/api/v1/admin/news');
    expect(desk.status).toBe(200);
    expect(desk.body.data.allowedTypes).toEqual([
      'seasonalEvent',
      'headAdminLetter',
      'adminLetter',
      'update',
      'contest',
    ]);
    expect(desk.body.data.signature).toEqual({
      name: actors.owner.user.username,
      roleLabel: 'Head Admin',
    });

    for (const postType of ['headAdminLetter', 'update', 'contest']) {
      const res = await mutate('post', actors.owner, '/api/v1/admin/news').send({
        postType,
        title: `${PREFIX} owner ${postType}`,
        body: 'Welcome.',
      });
      expect(res.status).toBe(201);
      postIds.push(res.body.data.post.id);
      expect(res.body.data.post).toMatchObject({
        postType,
        authorName: actors.owner.user.username,
        authorRoleLabel: 'Head Admin',
        scheduled: false,
      });
    }
  });

  it('lets the owner remove an Admin’s letter, and an Admin not remove the owner’s', async () => {
    const adminLetter = await mutate('post', actors.admin, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: `${PREFIX} admin letter`,
      body: 'Hi.',
    });
    const ownerLetter = await mutate('post', actors.owner, '/api/v1/admin/news').send({
      postType: 'headAdminLetter',
      title: `${PREFIX} owner letter`,
      body: 'Hello.',
    });
    postIds.push(adminLetter.body.data.post.id, ownerLetter.body.data.post.id);

    const byAdmin = await mutate('delete', actors.admin, `/api/v1/admin/news/${ownerLetter.body.data.post.id}`);
    expect(byAdmin.status).toBe(403);
    const byOwner = await mutate('delete', actors.owner, `/api/v1/admin/news/${adminLetter.body.data.post.id}`);
    expect(byOwner.status).toBe(200);
  });

  it('lets an Admin edit and remove their own letter, but not another Admin’s or a game entry', async () => {
    const created = await mutate('post', actors.admin, '/api/v1/admin/news').send({
      postType: 'adminLetter',
      title: `${PREFIX} draft`,
      body: 'First words.',
    });
    const { id } = created.body.data.post;
    postIds.push(id);

    const edited = await mutate('put', actors.admin, `/api/v1/admin/news/${id}`).send({
      title: `${PREFIX} final`,
      body: 'Better words.',
    });
    expect(edited.status).toBe(200);
    expect(edited.body.data.post).toMatchObject({ title: `${PREFIX} final`, body: 'Better words.' });

    const byOther = await mutate('put', actors.otherAdmin, `/api/v1/admin/news/${id}`).send({
      title: 'hijack',
      body: 'no',
    });
    expect(byOther.status).toBe(403);

    const gameEntry = await seedPost({
      postType: 'clubNews',
      title: `${PREFIX} polls`,
      sourceKey: `clubNews:electionOpened:${PREFIX}`,
      publishAt: new Date(),
    });
    const removeGame = await mutate('delete', actors.admin, `/api/v1/admin/news/${gameEntry.id}`);
    expect(removeGame.status).toBe(409);

    const removed = await mutate('delete', actors.admin, `/api/v1/admin/news/${id}`);
    expect(removed.status).toBe(200);
    expect(await prisma.newsItem.findUnique({ where: { id } })).toBeNull();
  });
});

describe('Seasonal events publish at the start of the 1st (Eastern)', () => {
  it('schedules the post for 00:00 Eastern on the 1st and shows it from that instant', async () => {
    const res = await mutate('post', actors.owner, '/api/v1/admin/news').send({
      postType: 'seasonalEvent',
      month: '2099-12',
      title: `${PREFIX} Festival Of Lights`,
      body: 'All of December.',
    });
    expect(res.status).toBe(201);
    const { post } = res.body.data;
    postIds.push(post.id);
    // December is on standard time: 00:00 EST is 05:00 UTC.
    expect(post.publishAt).toBe('2099-12-01T05:00:00.000Z');
    expect(post.endsAt).toBe('2100-01-01T05:00:00.000Z');
    expect(post).toMatchObject({ scheduled: true, gameDate: '2099-12-01', month: '2099-12' });

    const players = await get(actors.player, '/api/v1/news?limit=50');
    expect(players.body.data.items.map(i => i.id)).not.toContain(post.id);
    const justBefore = await listPublishedNews({ now: new Date('2099-12-01T04:59:59.999Z') });
    expect(justBefore.items.map(i => i.id)).not.toContain(post.id);
    const atStart = await listPublishedNews({ now: new Date('2099-12-01T05:00:00.000Z') });
    expect(atStart.items[0].id).toBe(post.id);
  });

  it('refuses a month that has already ended', async () => {
    const res = await mutate('post', actors.owner, '/api/v1/admin/news').send({
      postType: 'seasonalEvent',
      month: '2001-01',
      title: 'x',
      body: 'y',
    });
    expect(res.status).toBe(400);
  });
});

describe('News Desk pictures', () => {
  let envSnap;
  let stub;

  afterEach(async () => {
    restoreEnv(envSnap);
    if (stub) {
      await new Promise(resolve => stub.server.close(resolve));
      stub = null;
    }
  });

  function startStorageStub() {
    const received = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        received.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ Key: req.url }));
      });
    });
    return new Promise(resolve => {
      server.listen(0, '127.0.0.1', () => {
        resolve({ server, received, url: `http://127.0.0.1:${server.address().port}` });
      });
    });
  }

  function useStorage(url) {
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.SUPABASE_NEWS_BUCKET = 'news-test';
  }

  it('rejects bytes that are not a picture, whatever the label says', async () => {
    envSnap = snapshotEnv();
    const res = await mutate('post', actors.admin, '/api/v1/admin/news/images?filename=tack.png')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<script>alert(1)</script>'));
    expect(res.status).toBe(400);
  });

  it('says image storage is not set up when its settings are missing', async () => {
    envSnap = snapshotEnv();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_NEWS_BUCKET;
    const res = await mutate('post', actors.admin, '/api/v1/admin/news/images?filename=tack.png')
      .set('Content-Type', 'image/png')
      .send(PNG_BYTES);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not set up/i);
  });

  it('turns a moderator away before any picture is read', async () => {
    envSnap = snapshotEnv();
    const res = await mutate('post', actors.moderator, '/api/v1/admin/news/images?filename=a.png')
      .set('Content-Type', 'image/png')
      .send(PNG_BYTES);
    expect(res.status).toBe(403);
  });

  it('stores a vetted picture in the News bucket under its checksum', async () => {
    envSnap = snapshotEnv();
    stub = await startStorageStub();
    useStorage(stub.url);
    const checksum = createHash('sha256').update(PNG_BYTES).digest('hex');

    const res = await mutate('post', actors.admin, '/api/v1/admin/news/images?filename=tack.png')
      .set('Content-Type', 'image/png')
      .send(PNG_BYTES);

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe(`${stub.url}/storage/v1/object/public/news-test/news/${checksum}.png`);
    expect(stub.received).toHaveLength(1);
    const [sent] = stub.received;
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`/storage/v1/object/news-test/news/${checksum}.png`);
    expect(sent.headers.authorization).toBe('Bearer test-service-key');
    expect(sent.headers['content-type']).toBe('image/png');
    expect(sent.body.equals(PNG_BYTES)).toBe(true);
  });

  it('accepts tile pictures from the News bucket only', async () => {
    envSnap = snapshotEnv();
    useStorage('https://storage.example.com');
    const ours = `https://storage.example.com/storage/v1/object/public/news-test/news/${'a'.repeat(64)}.png`;

    const res = await mutate('post', actors.owner, '/api/v1/admin/news').send({
      postType: 'seasonalEvent',
      month: '2099-11',
      title: `${PREFIX} tiles`,
      body: 'With pictures.',
      tiles: [{ imageUrl: ours, caption: 'Limited Edition Tack' }],
    });
    expect(res.status).toBe(201);
    postIds.push(res.body.data.post.id);
    expect(res.body.data.post.tiles).toEqual([{ imageUrl: ours, caption: 'Limited Edition Tack' }]);

    const foreign = await mutate('post', actors.owner, '/api/v1/admin/news').send({
      postType: 'seasonalEvent',
      month: '2099-11',
      title: 'x',
      body: 'y',
      tiles: [{ imageUrl: 'https://elsewhere.example.com/cat.png', caption: 'Cat' }],
    });
    expect(foreign.status).toBe(400);
  });
});
