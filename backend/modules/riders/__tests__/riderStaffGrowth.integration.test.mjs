/**
 * Rider growth (Equoria-xlw03) — owner rulings 2026-10-28 (q160, q177, q235, q244).
 *
 *   - Every rider is generated as a Rookie with 12 hidden items: 4 horse traits, 4
 *     disciplines and 2 temperaments, each positive or negative, and 2 favorite breeds
 *     (positive only). A Rookie shows its personality only.
 *   - Shows completed level a rider up: 100 at Rookie, then 200, 300, 400 more (counted
 *     from the last level-up). Each level-up reveals 3 random items; Expert shows all.
 *   - A level-up charges nothing; the price follows the new level from the next payday.
 *   - A dismissed or unpaid rider returns to the riders-for-hire pool at its current
 *     level with its reveals intact, and another player can hire it there.
 *   - Players only ever see revealed items, as authored labels.
 *
 * Real app, real DB, real show settlement; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { executeClosedShows } from '../../competition/index.mjs';
import { recordStaffShowsTx } from '../../../services/staffGrowthService.mjs';
import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import { traitRosterIds } from '../../../utils/epigeneticTraits.mjs';
import { disciplineValues, horseTemperamentValues } from '../../../constants/schema.mjs';

const fixturePrefix = 'TestFixture-xlw03-rider';
const createdUserIds = [];
const riderIds = [];
const horseIds = [];
const showIds = [];
const cleanup = createCleanupTracker();
const tag = () => randomBytes(4).toString('hex');

async function makeUser(money = 5000) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${fixturePrefix}-${t}`,
      email: `${fixturePrefix}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Growth',
      lastName: 'Tester',
      level: 5,
      money,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function send(method, path, token, body) {
  const csrf = await fetchCsrf(app);
  const agent = request(app);
  const req = agent[method](path)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
  return body ? req.send(body) : req;
}

async function hireRookie(user, token) {
  const marketplaceId = `mid-${tag()}`;
  await prisma.staffMarketplaceState.create({
    data: {
      userId: user.id,
      staffType: 'rider',
      refreshCount: 0,
      offers: [
        {
          marketplaceId,
          firstName: 'TestFixture',
          lastName: `xlw03-${tag()}`,
          personality: 'methodical',
          skillLevel: 'developing',
          starLevel: 'rookie',
          speciality: 'Dressage',
          weeklyRate: 100,
          experience: 0,
          bio: 'hire fixture',
          startAge: 20,
        },
      ],
    },
  });
  const res = await send('post', '/api/v1/riders/marketplace/hire', token, { marketplaceId });
  expect(res.status).toBe(201);
  riderIds.push(res.body.data.rider.id);
  return res.body.data.rider;
}

const profileOf = riderId => prisma.riderGrowthProfile.findUnique({ where: { riderId } });
const revealedOf = items => items.filter(i => i.revealed);

/** Every label a revealed item would show, so a test can prove hidden ones are absent. */
async function labelsOf(items) {
  const breeds = await prisma.breed.findMany({
    where: { id: { in: items.filter(i => i.kind === 'breed').map(i => i.value) } },
    select: { id: true, name: true },
  });
  const names = new Map(breeds.map(b => [b.id, b.name]));
  const { getTraitDefinition } = await import('../../../utils/epigeneticTraits.mjs');
  return items.map(i =>
    i.kind === 'trait' ? getTraitDefinition(i.value).label : i.kind === 'breed' ? names.get(i.value) : i.value,
  );
}

const shownLabels = data => data.categories.flatMap(c => c.revealed.map(r => r.label)).sort();

beforeAll(() => {
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseXpEvent');
  cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { riderId: { in: riderIds } } }), 'riderAssignment');
  // Riders in the pool have no userId, so they are deleted by id (profiles cascade).
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }), 'notification');
  cleanup.add(
    () => prisma.userTransaction.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'userTransaction',
  );
  cleanup.add(
    () => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'staffMarketplaceState',
  );
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: { in: createdUserIds } } }), 'xpEvent');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('rider growth (Equoria-xlw03)', () => {
  it('a hired rider is a Rookie with 12 hidden items of the ruled shape, none shown', async () => {
    const { user, token } = await makeUser();
    const rider = await hireRookie(user, token);

    const row = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(row.starLevel).toBe('rookie');
    // The hire response is a rider row: it must not carry the hidden profile.
    expect(JSON.stringify(rider)).not.toMatch(/growth|items/i);

    const { items, showsAtLevel } = await profileOf(rider.id);
    expect(showsAtLevel).toBe(0);
    expect(items).toHaveLength(12);
    const ofKind = kind => items.filter(i => i.kind === kind);
    expect(ofKind('trait')).toHaveLength(4);
    expect(ofKind('discipline')).toHaveLength(4);
    expect(ofKind('temperament')).toHaveLength(2);
    expect(ofKind('breed')).toHaveLength(2);
    for (const i of ofKind('trait')) {
      expect(traitRosterIds).toContain(i.value);
    }
    for (const i of ofKind('discipline')) {
      expect(disciplineValues).toContain(i.value);
    }
    for (const i of ofKind('temperament')) {
      expect(horseTemperamentValues).toContain(i.value);
    }
    for (const kind of ['trait', 'discipline', 'temperament', 'breed']) {
      const values = ofKind(kind).map(i => i.value);
      expect(new Set(values).size).toBe(values.length);
    }
    for (const i of items) {
      expect(['positive', 'negative']).toContain(i.sign);
      expect(i.revealed).toBe(false);
    }
    for (const i of ofKind('breed')) {
      expect(i.sign).toBe('positive');
    }

    const res = await send('get', `/api/v1/riders/${rider.id}/discovery`, token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      riderId: rider.id,
      starLevel: 'rookie',
      personality: 'methodical',
      totalItems: 12,
      revealedCount: 0,
    });
    expect(res.body.data.categories.map(c => [c.label, c.total, c.revealed.length])).toEqual([
      ['Horse traits', 4, 0],
      ['Disciplines', 4, 0],
      ['Temperaments', 2, 0],
      ['Favorite breeds', 2, 0],
    ]);
    // No hidden value, and no stored code name, reaches the player.
    // Only authored words: no stored kind codes on the categories.
    for (const category of res.body.data.categories) {
      expect(Object.keys(category).sort()).toEqual(['label', 'revealed', 'total']);
    }
    const body = JSON.stringify(res.body);
    for (const label of await labelsOf(items)) {
      expect(body).not.toContain(`"${label}"`);
    }
    for (const i of ofKind('trait')) {
      expect(body).not.toContain(i.value);
    }
  });

  it('a show completed at the 100th Rookie show makes the rider a Novice with 3 items shown, and charges nothing', async () => {
    const { user, token } = await makeUser();
    const rider = await hireRookie(user, token);
    await prisma.riderGrowthProfile.update({
      where: { riderId: rider.id },
      data: { showsAtLevel: 99 },
    });
    const moneyBefore = (await prisma.user.findUnique({ where: { id: user.id } })).money;

    const horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${tag()}`,
        sex: 'Mare',
        age: 7,
        dateOfBirth: birthDateForAge(7),
        userId: user.id,
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
      },
      horseIds,
    );
    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `${fixturePrefix}-show-${tag()}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: pastClose,
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastClose,
        createdByUserId: user.id,
      },
    });
    showIds.push(show.id);
    await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: user.id, isActive: true },
    });
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
    });

    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const row = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(row.totalCompetitions).toBe(1);
    expect(row.starLevel).toBe('novice');
    const { items, showsAtLevel } = await profileOf(rider.id);
    expect(showsAtLevel).toBe(0);
    expect(revealedOf(items)).toHaveLength(3);

    // q235: the level-up itself charges nothing; the price is the new level's from the
    // next payday (the weekly pass charges hiredStaffFee, the current level's price).
    expect((await prisma.user.findUnique({ where: { id: user.id } })).money).toBe(moneyBefore);
    expect(hiredStaffFee(row)).toBe(200);

    const res = await send('get', `/api/v1/riders/${rider.id}/discovery`, token);
    expect(res.body.data.revealedCount).toBe(3);
    expect(shownLabels(res.body.data)).toEqual((await labelsOf(revealedOf(items))).sort());
    const body = JSON.stringify(res.body);
    for (const label of await labelsOf(items.filter(i => !i.revealed))) {
      expect(body).not.toContain(`"${label}"`);
    }
  }, 60000);

  it('level-ups need 100, 200, 300 and 400 shows, each step counted afresh; 3 reveals each, all at Expert', async () => {
    const { user, token } = await makeUser();
    const rider = await hireRookie(user, token);
    const record = shows => prisma.$transaction(tx => recordStaffShowsTx(tx, 'rider', rider.id, shows));
    const state = async () => {
      const { starLevel } = await prisma.rider.findUnique({ where: { id: rider.id } });
      const p = await profileOf(rider.id);
      return [starLevel, p.showsAtLevel, revealedOf(p.items).length];
    };

    await record(99);
    expect(await state()).toEqual(['rookie', 99, 0]);
    await record(1);
    expect(await state()).toEqual(['novice', 0, 3]);
    await record(199);
    expect(await state()).toEqual(['novice', 199, 3]);
    await record(1);
    expect(await state()).toEqual(['intermediate', 0, 6]);
    await record(300);
    expect(await state()).toEqual(['advanced', 0, 9]);
    await record(399);
    expect(await state()).toEqual(['advanced', 399, 9]);
    await record(1);
    expect(await state()).toEqual(['expert', 0, 12]);
    await record(50);
    expect(await state()).toEqual(['expert', 0, 12]);

    const res = await send('get', `/api/v1/riders/${rider.id}/discovery`, token);
    expect(res.body.data.revealedCount).toBe(12);
    expect(res.body.data.categories.map(c => c.revealed.length)).toEqual([4, 4, 2, 2]);
  });

  it('a dismissed rider returns to the pool at its level with its reveals intact, and another player can hire it', async () => {
    const { user, token } = await makeUser();
    const rider = await hireRookie(user, token);
    await prisma.$transaction(tx => recordStaffShowsTx(tx, 'rider', rider.id, 300));
    const before = await profileOf(rider.id);
    const ownerView = (await send('get', `/api/v1/riders/${rider.id}/discovery`, token)).body.data;
    expect(ownerView.starLevel).toBe('intermediate');
    expect(ownerView.revealedCount).toBe(6);

    const dismissed = await send('delete', `/api/v1/riders/${rider.id}/dismiss`, token);
    expect(dismissed.status).toBe(200);
    const pooled = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(pooled).toMatchObject({ userId: null, retired: false, starLevel: 'intermediate' });
    expect(pooled.freeAgentSince).not.toBeNull();
    expect((await profileOf(rider.id)).items).toEqual(before.items);

    const other = await makeUser();
    const list = await send('get', '/api/v1/riders/free-agents?limit=100', other.token);
    expect(list.status).toBe(200);
    const listed = list.body.data.riders.find(r => r.id === rider.id);
    expect(listed).toBeDefined();
    expect(listed.starLevel).toBe('intermediate');
    expect(listed.weeklyRate).toBe(300);
    expect(shownLabels(listed.growth)).toEqual(shownLabels(ownerView));
    // The listing's public speciality is the fixture's own 'Dressage', not a growth
    // reveal; it is pinned here and left out of the hidden-label scan, which otherwise
    // failed whenever a hidden discipline happened to be Dressage too (CI run 40800576959).
    const { speciality, ...listedWithoutSpeciality } = listed;
    expect(speciality).toBe('Dressage');
    const listBody = JSON.stringify(listedWithoutSpeciality);
    for (const label of await labelsOf(before.items.filter(i => !i.revealed))) {
      expect(listBody).not.toContain(`"${label}"`);
    }

    const moneyBefore = Number(other.user.money);
    const hired = await send('post', '/api/v1/riders/free-agents/hire', other.token, {
      riderId: rider.id,
    });
    expect(hired.status).toBe(201);
    expect(hired.body.data.cost).toBe(300);
    const rehired = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(rehired).toMatchObject({
      userId: other.user.id,
      freeAgentSince: null,
      starLevel: 'intermediate',
    });
    expect(Number((await prisma.user.findUnique({ where: { id: other.user.id } })).money)).toBe(moneyBefore - 300);
    const view = (await send('get', `/api/v1/riders/${rider.id}/discovery`, other.token)).body.data;
    expect(shownLabels(view)).toEqual(shownLabels(ownerView));

    // Gone from the pool once hired.
    const again = await send('post', '/api/v1/riders/free-agents/hire', token, {
      riderId: rider.id,
    });
    expect(again.status).toBe(404);
  }, 60000);

  it('a rider hired before growth existed gets a profile revealed to match its level', async () => {
    const { user, token } = await makeUser();
    const legacy = await prisma.rider.create({
      data: {
        userId: user.id,
        firstName: 'TestFixture',
        lastName: `xlw03-legacy-${tag()}`,
        personality: 'daring',
        skillLevel: 'developing',
        starLevel: 'advanced',
        speciality: 'Racing',
      },
    });
    riderIds.push(legacy.id);
    const res = await send('get', `/api/v1/riders/${legacy.id}/discovery`, token);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ starLevel: 'advanced', revealedCount: 9 });
    expect(revealedOf((await profileOf(legacy.id)).items)).toHaveLength(9);
  });
});
