/**
 * Need Help? integration tests (Equoria-vc5x1): the staff list with online
 * status, the user_presence stamp, and the three anti-abuse rules on
 * player-to-staff messages. Real app, real database, real CSRF flow.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { helpConversationOpenMs, helpDuplicateWindowMs, helpMessageCooldownMs } from '../services/helpGuardrails.mjs';
import { helpOnlineWindowMs } from '../services/helpDirectory.mjs';

const ORIGIN = 'http://localhost:3000';
const unique = () => randomBytes(6).toString('hex');
const MINUTE = 60_000;

const created = [];
const cleanup = createCleanupTracker();

async function makeUser(role, lastActiveAt = null) {
  const tag = unique();
  const user = await prisma.user.create({
    data: {
      email: `needhelp-${tag}@test.com`,
      username: `needhelp${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Need',
      lastName: 'Help',
      role,
    },
  });
  created.push(user.id);
  if (lastActiveAt) {
    await prisma.userPresence.create({ data: { userId: user.id, lastActiveAt } });
  }
  return { ...user, token: generateTestToken({ id: user.id, email: user.email, role }) };
}

async function send(player, recipientId, content, subject = 'Question') {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${player.token}`] });
  return request(app)
    .post('/api/v1/messages')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${player.token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ recipientId, subject, content });
}

/** A help message that was sent `agoMs` ago, written straight to the table. */
function helpMessageFrom(player, staffId, content, agoMs) {
  return prisma.directMessage.create({
    data: {
      senderId: player.id,
      recipientId: staffId,
      subject: 'Question',
      content,
      tag: 'help',
      createdAt: new Date(Date.now() - agoMs),
    },
  });
}

let owner;
let admin;
let modA;
let modB;
let offlineMod;
let player;

beforeAll(async () => {
  const now = Date.now();
  owner = await makeUser('owner', new Date(now - MINUTE));
  admin = await makeUser('admin', new Date(now - helpOnlineWindowMs - MINUTE));
  modA = await makeUser('moderator', new Date(now - 30_000));
  modB = await makeUser('moderator', new Date(now - MINUTE));
  offlineMod = await makeUser('moderator', null);
  player = await makeUser('user');
}, 30000);

afterAll(async () => {
  cleanup.add(
    () =>
      prisma.directMessage.deleteMany({
        where: {
          OR: [{ senderId: { in: created } }, { recipientId: { in: created } }],
        },
      }),
    'directMessage',
  );
  cleanup.add(() => prisma.userPresence.deleteMany({ where: { userId: { in: created } } }), 'userPresence');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: created } } }), 'users');
  await cleanup.run();
}, 30000);

describe('GET /api/v1/help/staff', () => {
  it('lists staff in owner, admin and moderator sections with online flags and no players', async () => {
    const res = await request(app)
      .get('/api/v1/help/staff')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${player.token}`);

    expect(res.status).toBe(200);
    const { owner: owners, admin: admins, moderator: mods } = res.body.data;
    const find = (list, user) => list.find(entry => entry.id === user.id);

    expect(find(owners, owner)).toEqual({ id: owner.id, username: owner.username, online: true });
    expect(find(admins, admin)).toEqual({ id: admin.id, username: admin.username, online: false });
    expect(find(mods, modA)?.online).toBe(true);
    expect(find(mods, modB)?.online).toBe(true);
    expect(find(mods, offlineMod)?.online).toBe(false);

    const everyone = [...owners, ...admins, ...mods];
    expect(everyone.some(entry => entry.id === player.id)).toBe(false);
    expect(find(admins, owner)).toBeUndefined();
    expect(find(mods, admin)).toBeUndefined();
  });

  it('does not expose last-active timestamps or emails', async () => {
    const res = await request(app)
      .get('/api/v1/help/staff')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${player.token}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('lastActiveAt');
    expect(body).not.toContain('@test.com');
  });

  it('requires a signed-in player', async () => {
    const res = await request(app).get('/api/v1/help/staff').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

describe('presence', () => {
  it('an authenticated request records the account as active, off the request path', async () => {
    const fresh = await makeUser('user');
    expect(await prisma.userPresence.findUnique({ where: { userId: fresh.id } })).toBeNull();
    await request(app)
      .get('/api/v1/help/staff')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${fresh.token}`)
      .expect(200);
    // The stamp is best-effort and not awaited by the request: poll for it.
    let row = null;
    for (let attempt = 0; attempt < 50 && row === null; attempt += 1) {
      row = await prisma.userPresence.findUnique({ where: { userId: fresh.id } });
      if (row === null) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    expect(row).not.toBeNull();
    expect(Date.now() - row.lastActiveAt.getTime()).toBeLessThan(helpOnlineWindowMs);
  });

  it('never touches the User row: updatedAt is unchanged by authenticated requests', async () => {
    const fresh = await makeUser('user');
    const before = await prisma.user.findUnique({ where: { id: fresh.id } });
    await request(app)
      .get('/api/v1/help/staff')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${fresh.token}`)
      .expect(200);
    await new Promise(resolve => setTimeout(resolve, 300));
    const after = await prisma.user.findUnique({ where: { id: fresh.id } });
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });
});

describe('help message guardrails', () => {
  it('lets a first help message through, tagged as help', async () => {
    const p = await makeUser('user');
    const res = await send(p, modA.id, 'My horse will not eat, who can help?');
    expect(res.status).toBe(201);
    expect(res.body.data.message.tag).toBe('help');
  });

  it('refuses a second help message inside the cooldown with helpCooldown', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'First question', helpMessageCooldownMs - 2 * MINUTE);
    const res = await send(p, modA.id, 'A different follow-up question');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('helpCooldown');
    expect(res.body.message).toMatch(/wait about \d+ minutes?/);
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows the same staff member again once the cooldown has passed', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'First question', helpMessageCooldownMs + MINUTE);
    const res = await send(p, modA.id, 'Another question for you');
    expect(res.status).toBe(201);
  });

  it('refuses a second staff member while a conversation is open with helpOpenConversation', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'Question for A', helpMessageCooldownMs + MINUTE);
    const res = await send(p, modB.id, 'A completely different question');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('helpOpenConversation');
    expect(res.body.message).toContain(modA.username);
  });

  it('allows another staff member once the first has replied', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'Question for A', helpMessageCooldownMs + 2 * MINUTE);
    await prisma.directMessage.create({
      data: {
        senderId: modA.id,
        recipientId: p.id,
        subject: 'Re: Question',
        content: 'Happy to help',
        createdAt: new Date(Date.now() - helpMessageCooldownMs - MINUTE),
      },
    });
    const res = await send(p, modB.id, 'A new question for B');
    expect(res.status).toBe(201);
  });

  it('allows another staff member once the open conversation has gone stale', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'Old question', helpConversationOpenMs + MINUTE);
    const res = await send(p, modB.id, 'Fresh question');
    expect(res.status).toBe(201);
  });

  it('refuses the same text to a second staff member with helpDuplicateContent', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'Please   HELP me with my foal', helpMessageCooldownMs + 2 * MINUTE);
    await prisma.directMessage.create({
      data: {
        senderId: modA.id,
        recipientId: p.id,
        subject: 'Re',
        content: 'Answered',
        createdAt: new Date(Date.now() - helpMessageCooldownMs - MINUTE),
      },
    });
    const res = await send(p, modB.id, '  please help me with my FOAL ');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('helpDuplicateContent');
  });

  it('allows the same text again after the duplicate window', async () => {
    const p = await makeUser('user');
    await helpMessageFrom(p, modA.id, 'Where is the farrier?', helpDuplicateWindowMs + 2 * MINUTE);
    await prisma.directMessage.create({
      data: {
        senderId: modA.id,
        recipientId: p.id,
        subject: 'Re',
        content: 'Down the lane',
        createdAt: new Date(Date.now() - helpDuplicateWindowMs - MINUTE),
      },
    });
    const res = await send(p, modB.id, 'Where is the farrier?');
    expect(res.status).toBe(201);
  });

  it('applies to every staff role: owner and admin refuse like moderators', async () => {
    const p = await makeUser('user');
    expect((await send(p, owner.id, 'Hello owner')).status).toBe(201);
    const second = await send(p, admin.id, 'Hello admin');
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('helpOpenConversation');
  });

  it('never refuses a staff member replying to a player, or a player writing to a player', async () => {
    const p = await makeUser('user');
    const friend = await makeUser('user');
    expect((await send(modA, p.id, 'We can help')).status).toBe(201);
    expect((await send(modA, p.id, 'Another staff reply')).status).toBe(201);
    expect((await send(p, friend.id, 'Hi friend')).status).toBe(201);
    expect((await send(p, friend.id, 'Hi again friend')).status).toBe(201);
  });

  it('lets only one of two parallel sends from one player through', async () => {
    const p = await makeUser('user');
    const results = await Promise.all([
      send(p, modA.id, 'Parallel question one'),
      send(p, modB.id, 'Parallel question two'),
    ]);
    const statuses = results.map(r => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const stored = await prisma.directMessage.count({ where: { senderId: p.id, tag: 'help' } });
    expect(stored).toBe(1);
  });

  it('lets only one of two parallel sends of one text to different staff through', async () => {
    const p = await makeUser('user');
    const results = await Promise.all([modA, modB, owner].map(staff => send(p, staff.id, 'Same words for everyone')));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status !== 201).every(r => typeof r.body.code === 'string')).toBe(true);
    expect(await prisma.directMessage.count({ where: { senderId: p.id, tag: 'help' } })).toBe(1);
  });
});
