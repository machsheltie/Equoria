/**
 * Staff renames and forum posting cooldowns: real HTTP, real DB
 * (Equoria-puj1e.3, owner ruling q375).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - a player is refused every content tool with the ordinary unknown-route 404,
 *    and a steward without a check-in on this browser is refused;
 *  - a steward renames a horse, a show or a player, under the same naming rules
 *    players have, with a reason, and the rename and its staff log entry (old and
 *    new name) commit together; a refusal changes nothing;
 *  - nobody acts on the owner or themselves, and moderators never on another
 *    moderator's horse, show or account;
 *  - a horse lookup shows only the name and the owner's username, never traits;
 *  - a posting cooldown of 1 hour to 7 days stops new threads and replies until
 *    it ends, names the end, cannot be stacked, and leaves other players posting.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { capabilityRequiredCode } from '../middleware/requireStaffCapability.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  checkIn,
  createTargetFactory,
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
const { makeUser, createdUserIds } = createUserFactory('rnmcool');
const targets = createTargetFactory('rnmcool');
const madeShowIds = [];

let mod;
let modB;
let owner;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => targets.removeTargets(), 'horses, shows, posts');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: madeShowIds } } }), 'hosted shows');
  cleanup.add(() => prisma.forumThread.deleteMany({ where: { authorId: scope() } }), 'threads');
  cleanup.add(() => prisma.forumPost.deleteMany({ where: { authorId: scope() } }), 'posts');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  // conduct_records go with their users (ON DELETE CASCADE).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  startEmailCapture();
  const staff = async role => {
    const user = await makeUser(role);
    return { user, device: await checkIn(user) };
  };
  mod = await staff('moderator');
  modB = await staff('moderator');
  owner = await staff('owner');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

const as = steward => ({
  get: url => get(url, steward.user, steward.device),
  post: (url, body) => post(url, steward.user, body, steward.device),
});
const logFor = (actor, targetType, targetId) =>
  prisma.staffActionLog.findMany({
    where: { actorId: actor.user.id, targetType, targetId: String(targetId) },
  });
const horseName = async id => (await prisma.horse.findUnique({ where: { id } })).name;

async function hostedShow(host) {
  const row = await prisma.show.create({
    data: {
      name: `TestFixture-rnmcool-${uid()}${uid()}`,
      discipline: 'Dressage',
      runDate: new Date(Date.now() + 7 * 24 * hour),
      prize: 100,
      entryFee: 10,
      levelMin: 1,
      levelMax: 10,
      status: 'open',
      createdByUserId: host.id,
    },
  });
  madeShowIds.push(row.id);
  return row;
}

describe('Who may use the content tools', () => {
  it('answers a player with the unknown-route 404 and changes nothing', async () => {
    const player = await makeUser('user');
    const horse = await targets.makeHorse(player);
    const look = await get(`${api}/content/horses/${horse.id}`, player);
    const res = await post(`${api}/content/horses/${horse.id}/rename`, player, {
      name: 'Player Pick',
      reason: 'not a steward',
    });
    expect(look.status).toBe(404);
    expect(res.status).toBe(404);
    expect(await horseName(horse.id)).toBe(horse.name);
  });

  it('refuses a moderator whose browser has not checked in', async () => {
    const player = await makeUser('user');
    const horse = await targets.makeHorse(player);
    const res = await post(`${api}/content/horses/${horse.id}/rename`, mod.user, {
      name: 'No Check In',
      reason: 'no device',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffCheckinRequired');
    expect(await horseName(horse.id)).toBe(horse.name);
  });

  it('refuses a player the posting cooldown tool', async () => {
    const player = await makeUser('user');
    const other = await makeUser('user');
    const res = await post(`${api}/conduct/${other.id}/posting-cooldown`, player, {
      hours: 1,
      reason: 'not a steward',
    });
    expect(res.status).toBe(404);
    expect(await prisma.conductRecord.count({ where: { userId: other.id } })).toBe(0);
  });

  it('answers a player asking for the held-post queue with the unknown-route 404', async () => {
    const player = await makeUser('user');
    const res = await get(`${api}/forum/held`, player);
    expect(res.status).toBe(404);
    expect(res.body.code).not.toBe(capabilityRequiredCode);
  });
});

describe('Renaming a horse', () => {
  it('shows a steward only the name and the owner, never traits', async () => {
    const player = await makeUser('user');
    const horse = await targets.makeHorse(player);
    const res = await as(mod).get(`${api}/content/horses/${horse.id}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['id', 'name', 'ownerUsername']);
    expect(res.body).toEqual({ id: horse.id, name: horse.name, ownerUsername: player.username });
  });

  it('renames with a reason and writes one log entry with the old and new name', async () => {
    const player = await makeUser('user');
    const horse = await targets.makeHorse(player);
    const res = await as(mod).post(`${api}/content/horses/${horse.id}/rename`, {
      name: "O'Malley's Comet",
      reason: 'Offensive name',
    });
    expect(res.status).toBe(200);
    expect(await horseName(horse.id)).toBe("O'Malley's Comet");
    const log = await logFor(mod, 'horse', horse.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'rename',
      outcome: 'succeeded',
      reason: 'Offensive name',
      before: { name: horse.name },
      after: { name: "O'Malley's Comet" },
    });
  });

  it('refuses a rename without a reason, or a name the horse-name rule refuses', async () => {
    const player = await makeUser('user');
    const horse = await targets.makeHorse(player);
    const noReason = await as(mod).post(`${api}/content/horses/${horse.id}/rename`, {
      name: 'Quiet Fix',
    });
    const bracket = await as(mod).post(`${api}/content/horses/${horse.id}/rename`, {
      name: 'Bad <b>',
      reason: 'test',
    });
    const tooLong = await as(mod).post(`${api}/content/horses/${horse.id}/rename`, {
      name: 'x'.repeat(41),
      reason: 'test',
    });
    expect(noReason.status).toBe(400);
    expect(noReason.body.code).toBe('contentReasonRequired');
    expect(bracket.status).toBe(400);
    expect(bracket.body.code).toBe('renameNameInvalid');
    expect(tooLong.status).toBe(400);
    expect(await horseName(horse.id)).toBe(horse.name);
    expect(await logFor(mod, 'horse', horse.id)).toHaveLength(0);
  });

  it("refuses a moderator renaming another moderator's horse or the owner's horse", async () => {
    const modHorse = await targets.makeHorse(modB.user);
    const ownerHorse = await targets.makeHorse(owner.user);
    const onMod = await as(mod).post(`${api}/content/horses/${modHorse.id}/rename`, {
      name: 'Nope',
      reason: 'test',
    });
    const onOwner = await as(mod).post(`${api}/content/horses/${ownerHorse.id}/rename`, {
      name: 'Nope',
      reason: 'test',
    });
    expect(onMod.status).toBe(403);
    expect(onMod.body.code).toBe('staffTargetStaff');
    expect(onOwner.status).toBe(403);
    expect(onOwner.body.code).toBe('staffTargetOwner');
    expect(await horseName(modHorse.id)).toBe(modHorse.name);
    expect(await horseName(ownerHorse.id)).toBe(ownerHorse.name);
  });

  it('answers an unknown horse with 404', async () => {
    const res = await as(mod).post(`${api}/content/horses/2147483000/rename`, {
      name: 'Ghost',
      reason: 'test',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('renameHorseNotFound');
  });
});

describe('Renaming a show', () => {
  it('renames a show and logs it; a name another show has is refused', async () => {
    const host = await makeUser('user');
    const show = await hostedShow(host);
    const other = await hostedShow(host);
    const look = await as(mod).get(`${api}/content/shows/${show.id}`);
    expect(look.body).toEqual({ id: show.id, name: show.name, hostUsername: host.username });

    const fresh = `TestFixture-rnmcool-renamed-${uid()}`;
    const res = await as(mod).post(`${api}/content/shows/${show.id}/rename`, {
      name: fresh,
      reason: 'Rude show name',
    });
    expect(res.status).toBe(200);
    expect((await prisma.show.findUnique({ where: { id: show.id } })).name).toBe(fresh);
    const log = await logFor(mod, 'show', show.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ before: { name: show.name }, after: { name: fresh } });

    const taken = await as(mod).post(`${api}/content/shows/${other.id}/rename`, {
      name: fresh,
      reason: 'test',
    });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('renameNameTaken');
    expect((await prisma.show.findUnique({ where: { id: other.id } })).name).toBe(other.name);
  });

  it("refuses a moderator renaming another moderator's show", async () => {
    const show = await hostedShow(modB.user);
    const res = await as(mod).post(`${api}/content/shows/${show.id}/rename`, {
      name: `TestFixture-rnmcool-${uid()}`,
      reason: 'test',
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffTargetStaff');
  });
});

describe('Renaming a player', () => {
  const rename = (steward, username, newUsername, reason = 'Offensive username') =>
    as(steward).post(`${api}/content/players/rename`, { username, newUsername, reason });
  const nameOf = async id => (await prisma.user.findUnique({ where: { id } })).username;

  it('renames a player and logs the old and new username', async () => {
    const player = await makeUser('user');
    const fresh = `rn${uid()}${uid()}`;
    const res = await rename(mod, player.username, fresh);
    expect(res.status).toBe(200);
    expect(await nameOf(player.id)).toBe(fresh);
    const log = await logFor(mod, 'player', player.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'rename',
      before: { username: player.username },
      after: { username: fresh },
    });
  });

  it('refuses a username outside the sign-up rule, or one another player has', async () => {
    const player = await makeUser('user');
    const other = await makeUser('user');
    const bad = await rename(mod, player.username, 'has space');
    const short = await rename(mod, player.username, 'ab');
    const taken = await rename(mod, player.username, other.username);
    expect(bad.status).toBe(400);
    expect(short.status).toBe(400);
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('renameNameTaken');
    expect(await nameOf(player.id)).toBe(player.username);
  });

  it('refuses renaming another moderator, the owner, or oneself', async () => {
    const onMod = await rename(mod, modB.user.username, `rn${uid()}${uid()}`);
    const onOwner = await rename(mod, owner.user.username, `rn${uid()}${uid()}`);
    const onSelf = await rename(mod, mod.user.username, `rn${uid()}${uid()}`);
    expect(onMod.body.code).toBe('staffTargetStaff');
    expect(onOwner.body.code).toBe('staffTargetOwner');
    expect(onSelf.body.code).toBe('staffTargetSelf');
    expect([onMod.status, onOwner.status, onSelf.status]).toEqual([403, 403, 403]);
    expect(await nameOf(modB.user.id)).toBe(modB.user.username);
  });

  it('lets the owner rename a moderator', async () => {
    const target = await makeUser('moderator');
    const fresh = `rn${uid()}${uid()}`;
    const res = await rename(owner, target.username, fresh);
    expect(res.status).toBe(200);
    expect(await nameOf(target.id)).toBe(fresh);
  });
});

describe('Posting cooldown', () => {
  const coolDown = (steward, player, hours, reason = 'Flooding the board') =>
    as(steward).post(`${api}/conduct/${player.id}/posting-cooldown`, { hours, reason });
  const newThread = player =>
    post(`${forum}/threads`, player, {
      section: 'general',
      title: `TestFixture-rnmcool-${uid()}`,
      content: 'Hello from the paddock',
    });

  it('stops new threads and replies until it ends, and names the end', async () => {
    const player = await makeUser('user');
    const before = await newThread(player);
    expect(before.status).toBe(201);
    const threadId = before.body.data.thread.id;

    const started = Date.now();
    const res = await coolDown(mod, player, 12);
    expect(res.status).toBe(200);
    const record = await prisma.conductRecord.findFirst({
      where: { userId: player.id, kind: 'postingCooldown' },
    });
    expect(record.endsAt.getTime()).toBeGreaterThanOrEqual(started + 12 * hour - 1000);
    expect(record.endsAt.getTime()).toBeLessThanOrEqual(Date.now() + 12 * hour + 1000);

    const thread = await newThread(player);
    const reply = await post(`${forum}/threads/${threadId}/posts`, player, { content: 'still here' });
    for (const refused of [thread, reply]) {
      expect(refused.status).toBe(403);
      expect(refused.body.code).toBe('forumPostingCooldown');
      expect(refused.body.until).toBe(record.endsAt.toISOString());
      expect(refused.body.message).not.toContain('postingCooldown');
    }
    expect(await prisma.forumPost.count({ where: { authorId: player.id } })).toBe(1);

    const log = await logFor(mod, 'player', player.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'post.moderate',
      reason: 'Flooding the board',
      after: { kind: 'postingCooldown', hours: 12 },
    });
  });

  it('leaves other players posting', async () => {
    const cooled = await makeUser('user');
    const other = await makeUser('user');
    expect((await coolDown(mod, cooled, 1)).status).toBe(200);
    expect((await newThread(other)).status).toBe(201);
  });

  it('lets the player post again once it has ended', async () => {
    const player = await makeUser('user');
    await prisma.conductRecord.create({
      data: {
        userId: player.id,
        kind: 'postingCooldown',
        reason: 'ended',
        issuedById: mod.user.id,
        issuedByRole: 'moderator',
        endsAt: new Date(Date.now() - 1000),
      },
    });
    expect((await newThread(player)).status).toBe(201);
  });

  it('accepts only 1 hour, 12 hours, 1, 3 or 7 days, and not twice at once', async () => {
    const player = await makeUser('user');
    const odd = await coolDown(mod, player, 5);
    expect(odd.status).toBe(400);
    expect(odd.body.code).toBe('conductCooldownLength');
    expect((await coolDown(mod, player, 168)).status).toBe(200);
    const again = await coolDown(mod, player, 1);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('conductAlreadyCoolingDown');
    expect(await prisma.conductRecord.count({ where: { userId: player.id } })).toBe(1);
  });

  it('needs a reason, and is refused on another moderator', async () => {
    const player = await makeUser('user');
    const noReason = await as(mod).post(`${api}/conduct/${player.id}/posting-cooldown`, {
      hours: 1,
    });
    const onMod = await coolDown(mod, modB.user, 1);
    expect(noReason.status).toBe(400);
    expect(onMod.status).toBe(403);
    expect(onMod.body.code).toBe('staffTargetStaff');
    expect(await prisma.conductRecord.count({ where: { userId: player.id } })).toBe(0);
  });

  it('shows on the conduct record and leaves the account in good standing', async () => {
    const player = await makeUser('user');
    expect((await coolDown(mod, player, 24)).status).toBe(200);
    const record = await as(mod).get(`${api}/conduct/${player.id}`);
    expect(record.body.standing).toEqual({ state: 'good' });
    expect(record.body.records[0]).toMatchObject({ kind: 'postingCooldown', reason: 'Flooding the board' });
  });
});
