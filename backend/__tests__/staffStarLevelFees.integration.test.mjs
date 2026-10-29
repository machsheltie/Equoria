/**
 * Staff star levels set the price (owner ruling 2026-10-28, Equoria-nawn5).
 *
 * Riders, trainers and grooms all use five levels: Rookie 1 star 100, Novice 2 stars 200,
 * Intermediate 3 stars 300, Advanced 4 stars 400, Expert 5 stars 500. Riders and grooms
 * are priced per week (hire charges one week; riders' weekly payday), trainers per
 * training session. The fee comes from the level, not from a stored random rate.
 *
 * Owner ruling q226 (2026-10-28, "change it now"): staff hired before star levels pay
 * their level's price too, and an offer generated before star levels costs its level's
 * price (it used to keep the price it was hired at / advertised; the ruling changed it).
 *
 * Real DB, real routes (supertest). Every row is owned by this suite's fixture users and
 * removed fail-loud. A rider's weekly pay is taken by the player's Pay Rider press
 * (owner rulings 2026-10-28 and q268, Equoria-hc96y; the old weekly pass was removed,
 * Equoria-kw60x).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import config from '../config/config.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { staffLevelFee, staffLevels } from '../constants/staffLevels.mjs';

const prefix = 'TestFixture-nawn5';
const tag = () => randomBytes(4).toString('hex');

const userIds = [];
const horseIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'trainingLogs');
cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { userId: { in: userIds } } }), 'trainerAssignments');
cleanup.add(() => prisma.riderSalaryPayment.deleteMany({ where: { userId: { in: userIds } } }), 'riderPay');
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } }), 'markets');
cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { userId: { in: userIds } } }), 'engagements');
cleanup.add(() => prisma.groom.deleteMany({ where: { userId: { in: userIds } } }), 'grooms');
cleanup.add(() => prisma.rider.deleteMany({ where: { userId: { in: userIds } } }), 'riders');
cleanup.add(() => prisma.trainer.deleteMany({ where: { userId: { in: userIds } } }), 'trainers');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 60000);

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Star',
      lastName: 'Levels',
      level: 3,
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function send(method, path, token, body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  const agent = request(app);
  const req = agent[method](path)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
  return body === undefined ? req : req.send(body);
}

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);

async function seedOffer(userId, staffType, offer) {
  const marketplaceId = `mid-${tag()}`;
  await prisma.staffMarketplaceState.create({
    data: { userId, staffType, refreshCount: 0, offers: [{ marketplaceId, ...offer }] },
  });
  return marketplaceId;
}

describe('the five levels and their prices', () => {
  it('are Rookie 100, Novice 200, Intermediate 300, Advanced 400, Expert 500', () => {
    expect(staffLevels.map(level => [level, staffLevelFee(level)])).toEqual([
      ['rookie', 100],
      ['novice', 200],
      ['intermediate', 300],
      ['advanced', 400],
      ['expert', 500],
    ]);
  });
});

describe('every new marketplace offer carries a star level priced from it', () => {
  it.each([
    ['rider', '/api/v1/riders/marketplace', 'riders', offer => offer.weeklyRate],
    ['trainer', '/api/v1/trainers/marketplace', 'trainers', offer => offer.sessionRate],
    ['groom', '/api/v1/groom-marketplace', 'grooms', offer => offer.weeklyFee],
  ])('%s offers', async (_type, path, key, priceOf) => {
    const { token } = await makeUser(0);
    const res = await send('get', path, token);

    expect(res.status).toBe(200);
    const offers = res.body.data[key];
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(staffLevels).toContain(offer.starLevel);
      expect(priceOf(offer)).toBe(staffLevelFee(offer.starLevel));
    }
  });
});

describe('hiring charges the star level price', () => {
  it("a rider: one week at the level's price, stored with the level", async () => {
    const { user, token } = await makeUser(1000);
    const marketplaceId = await seedOffer(user.id, 'rider', {
      firstName: 'Offer',
      lastName: prefix,
      personality: 'calm',
      skillLevel: 'developing',
      starLevel: 'advanced',
      speciality: 'Show Jumping',
      // Not what the hire charges: the level sets the price.
      weeklyRate: 999,
      experience: 0,
      bio: 'nawn5 fixture',
    });

    const res = await send('post', '/api/v1/riders/marketplace/hire', token, { marketplaceId });

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(400);
    expect(await moneyOf(user.id)).toBe(600);
    const rider = await prisma.rider.findFirst({ where: { userId: user.id } });
    expect(rider).toMatchObject({ starLevel: 'advanced', weeklyRate: 400 });
  });

  it("a trainer: free to hire, its session fee is the level's price", async () => {
    const { user, token } = await makeUser(1000);
    const marketplaceId = await seedOffer(user.id, 'trainer', {
      firstName: 'Offer',
      lastName: prefix,
      personality: 'focused',
      skillLevel: 'expert',
      starLevel: 'expert',
      speciality: 'Dressage',
      sessionRate: 123,
      bio: 'nawn5 fixture',
    });

    const res = await send('post', '/api/v1/trainers/marketplace/hire', token, { marketplaceId });

    expect(res.status).toBe(201);
    expect(await moneyOf(user.id)).toBe(1000);
    const trainer = await prisma.trainer.findFirst({ where: { userId: user.id } });
    expect(trainer).toMatchObject({ starLevel: 'expert', sessionRate: 500 });
  });

  it("a groom: one week at the level's price, stored with the level", async () => {
    const { user, token } = await makeUser(1000);
    const marketplaceId = await seedOffer(user.id, 'groom', {
      firstName: 'Offer',
      lastName: prefix,
      specialty: 'general',
      skillLevel: 'novice',
      starLevel: 'novice',
      weeklyFee: 200,
      personality: 'gentle',
      experience: 2,
      sessionRate: 15,
      bio: 'nawn5 fixture',
    });

    const res = await send('post', '/api/v1/groom-marketplace/hire', token, { marketplaceId });

    expect(res.status).toBe(201);
    expect(res.body.data.cost).toBe(200);
    expect(await moneyOf(user.id)).toBe(800);
    const groom = await prisma.groom.findFirst({ where: { userId: user.id } });
    expect(groom.starLevel).toBe('novice');
  });

  it('an offer from before star levels is given a level and costs its price (q226)', async () => {
    const { user, token } = await makeUser(1000);
    const marketplaceId = await seedOffer(user.id, 'rider', {
      firstName: 'Old',
      lastName: prefix,
      personality: 'calm',
      skillLevel: 'rookie',
      speciality: 'Dressage',
      weeklyRate: 250,
      experience: 0,
      bio: 'nawn5 legacy fixture',
    });

    const res = await send('post', '/api/v1/riders/marketplace/hire', token, { marketplaceId });

    expect(res.status).toBe(201);
    expect(await moneyOf(user.id)).toBe(800);
    const rider = await prisma.rider.findFirst({ where: { userId: user.id } });
    // A rookie-tier rider at 250 a week sits in the upper half of the old 150-300 range.
    expect(rider).toMatchObject({ starLevel: 'novice', weeklyRate: 200 });
  });
});

describe("a rider's weekly payday charges the level price", () => {
  it('a rider hired at their level pays that level each week', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await prisma.rider.create({
      data: {
        userId: user.id,
        firstName: prefix,
        lastName: `Rider-${tag()}`,
        personality: 'calm',
        skillLevel: 'developing',
        starLevel: 'intermediate',
        speciality: 'Show Jumping',
        weeklyRate: staffLevelFee('intermediate'),
      },
    });

    const res = await send('post', `/api/v1/riders/${rider.id}/pay`, token);

    expect(res.status).toBe(200);
    expect(res.body.data.paid).toEqual({ riderId: rider.id, amount: 300 });
    expect(await moneyOf(user.id)).toBe(700);
  });

  it('q226: a rider hired before star levels pays their level price, not their old rate', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await prisma.rider.create({
      data: {
        userId: user.id,
        firstName: prefix,
        lastName: `Rider-${tag()}`,
        personality: 'calm',
        skillLevel: 'rookie',
        starLevel: 'novice',
        speciality: 'Dressage',
        weeklyRate: 250,
      },
    });

    const res = await send('post', `/api/v1/riders/${rider.id}/pay`, token);

    expect(res.status).toBe(200);
    expect(res.body.data.paid).toEqual({ riderId: rider.id, amount: 200 });
    expect(await moneyOf(user.id)).toBe(800);
  });
});

describe("a trainer's session charges the level price", () => {
  it('training with an Advanced trainer hired from the marketplace charges 400', async () => {
    const { user, token } = await makeUser(1000);
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${prefix}-horse-${tag()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        trainingCooldown: null,
        userId: user.id,
      },
    });
    horseIds.push(horse.id);
    const marketplaceId = await seedOffer(user.id, 'trainer', {
      firstName: 'Offer',
      lastName: prefix,
      personality: 'focused',
      skillLevel: 'developing',
      starLevel: 'advanced',
      speciality: 'Dressage',
      sessionRate: 400,
      bio: 'nawn5 fixture',
    });
    const hired = await send('post', '/api/v1/trainers/marketplace/hire', token, {
      marketplaceId,
      horseId: horse.id,
    });
    expect(hired.status).toBe(201);

    const res = await send('post', '/api/v1/training/train', token, {
      horseId: horse.id,
      discipline: 'Dressage',
    });

    expect(res.status).toBe(200);
    expect(res.body.trainingFee).toBe(400);
    expect(await moneyOf(user.id)).toBe(600);
  });

  it('q226: a trainer hired at an old session rate charges its level price', async () => {
    const { user, token } = await makeUser(1000);
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${prefix}-horse-${tag()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        trainingCooldown: null,
        userId: user.id,
      },
    });
    horseIds.push(horse.id);
    const marketplaceId = await seedOffer(user.id, 'trainer', {
      firstName: 'Offer',
      lastName: prefix,
      personality: 'focused',
      skillLevel: 'novice',
      starLevel: 'novice',
      speciality: 'Dressage',
      sessionRate: 200,
      bio: 'nawn5 fixture',
    });
    const hired = await send('post', '/api/v1/trainers/marketplace/hire', token, {
      marketplaceId,
      horseId: horse.id,
    });
    expect(hired.status).toBe(201);
    // The rate a trainer was hired at before star levels.
    await prisma.trainer.updateMany({ where: { userId: user.id }, data: { sessionRate: 175 } });

    const res = await send('post', '/api/v1/training/train', token, {
      horseId: horse.id,
      discipline: 'Dressage',
    });

    expect(res.status).toBe(200);
    expect(res.body.trainingFee).toBe(200);
    expect(await moneyOf(user.id)).toBe(800);
  });
});
