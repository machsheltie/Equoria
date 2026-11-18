/**
 * Horse lookup in the Steward's Office (Equoria-puj1e.5,
 * docs/features/admin-time-back.md "Related controls") — real HTTP, real DB,
 * real check-ins. Nothing is mocked.
 *
 * By number or name it shows owner, birth date, age, retired or not, pregnancy
 * and due day, and foal development day. The Owner and Admins only; a
 * moderator is refused and a player finds no such page. Hidden traits are
 * named for the Owner alone (owner rulings 2026-10-19, 2026-10-23); an Admin
 * sees the revealed traits and how many are hidden, never which.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sthlook');
const day = 86_400_000;
const lookupUrl = q => `${staffApi}/horses/lookup?q=${encodeURIComponent(q)}`;
const revealedTrait = 'brave';
const hiddenTrait = 'resilient';
const tag = uid();

const staff = {};
const made = [];
let player;
let mare;
let foal;
let elder;
let sire;
let bredAt;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: made } } }), 'foal development');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: made } } }), 'horses');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  startEmailCapture();
  for (const role of ['owner', 'admin', 'moderator']) {
    const user = await makeUser(role);
    staff[role] = { user, device: await checkIn(user) };
  }
  stopEmailCapture();
  player = await makeUser('user');

  const horse = async data => {
    const row = await prisma.horse.create({
      data: await testHorseData(prisma, { userId: player.id, ...data }),
    });
    made.push(row.id);
    return row;
  };
  sire = await horse({ name: `TestFixture-sthlook-${tag}-sire`, sex: 'Stallion', age: 8 });
  bredAt = new Date(Date.now() - 2 * day);
  mare = await horse({
    name: `TestFixture-sthlook-${tag}-mare`,
    sex: 'Mare',
    age: 5,
    dateOfBirth: birthDateForAge(5),
    inFoalSinceDate: bredAt,
    pregnancySireId: sire.id,
    epigeneticModifiers: { positive: [revealedTrait], negative: [], hidden: [hiddenTrait] },
  });
  foal = await horse({
    name: `TestFixture-sthlook-${tag}-foal`,
    sex: 'Filly',
    age: 0,
    dateOfBirth: birthDateForAge(3 / 7),
  });
  await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay: 3 } });
  elder = await horse({ name: `TestFixture-sthlook-${tag}-elder`, sex: 'Mare', age: 22 });
}, 120_000);

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

const lookUp = (role, q) => get(lookupUrl(q), staff[role].user, staff[role].device);

describe('Horse lookup (Owner and Admins)', () => {
  it('finds a horse by number with its owner, age, pregnancy and due day', async () => {
    const res = await lookUp('admin', String(mare.id));
    expect(res.status).toBe(200);
    expect(res.body.data.horses).toHaveLength(1);
    const [found] = res.body.data.horses;
    expect(found).toMatchObject({
      id: mare.id,
      name: mare.name,
      sex: 'Mare',
      ownerUsername: player.username,
      dateOfBirth: mare.dateOfBirth.toISOString().slice(0, 10),
      age: 5,
      retired: false,
      foalDevelopmentDay: null,
    });
    expect(found.pregnancy).toEqual({
      since: bredAt.toISOString(),
      dueDay: startOfGameDayIndex(gameDayIndex(bredAt) + 7).toISOString(),
      sireName: sire.name,
    });
  }, 60_000);

  it('finds every horse whose name holds the text, ignoring case, with retirement and development day', async () => {
    const res = await lookUp('owner', `testfixture-sthlook-${tag}`);
    expect(res.status).toBe(200);
    const byId = new Map(res.body.data.horses.map(h => [h.id, h]));
    expect([...byId.keys()].sort((a, b) => a - b)).toEqual([sire.id, mare.id, foal.id, elder.id]);
    expect(byId.get(elder.id)).toMatchObject({ age: 22, retired: true, pregnancy: null });
    expect(byId.get(foal.id)).toMatchObject({ age: 0, retired: false, foalDevelopmentDay: 3 });
  }, 60_000);

  it('names hidden traits for the Owner alone', async () => {
    const asOwner = await lookUp('owner', String(mare.id));
    expect(asOwner.status).toBe(200);
    const ownerView = asOwner.body.data.horses[0];
    expect(ownerView.epigeneticModifiers).toMatchObject({
      positive: [revealedTrait],
      hiddenCount: 1,
      hidden: [hiddenTrait],
    });
    expect(ownerView.traitLabels).toMatchObject({ [revealedTrait]: 'Brave', [hiddenTrait]: 'Resilient' });

    const asAdmin = await lookUp('admin', String(mare.id));
    const adminView = asAdmin.body.data.horses[0];
    expect(adminView.epigeneticModifiers).toEqual({ positive: [revealedTrait], negative: [], hiddenCount: 1 });
    expect(JSON.stringify(asAdmin.body)).not.toContain(hiddenTrait);
  }, 60_000);

  it('refuses a moderator, hides the page from a player, and asks for a number or name', async () => {
    const asModerator = await lookUp('moderator', String(mare.id));
    expect(asModerator.status).toBe(403);
    expect(asModerator.body.code).toBe('staffCapabilityRequired');
    expect(JSON.stringify(asModerator.body)).not.toContain(mare.name);

    const asPlayer = await get(lookupUrl(String(mare.id)), player);
    expect(asPlayer.status).toBe(404);

    for (const q of ['', '   ', 'x'.repeat(41)]) {
      const res = await lookUp('owner', q);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('horseLookupInvalid');
    }
    const none = await lookUp('owner', '2147483000');
    expect(none.status).toBe(200);
    expect(none.body.data.horses).toEqual([]);
  }, 60_000);
});
