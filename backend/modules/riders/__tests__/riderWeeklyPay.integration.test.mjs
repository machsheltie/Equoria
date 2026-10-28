/**
 * Rider weekly payday (owner ruling 2026-10-27, q111; Equoria-gafyt).
 *
 * "Riders, yes. Trainers players pay when they click Train Horse." Riders have the groom
 * rule: the weekly rate is taken every Monday (Eastern); an unpaid rider cannot ride that
 * week; after a full unpaid week the rider leaves; the player is told at each moment.
 *
 * Real DB, real hire route (supertest), real entry rule. Every pass is scoped to this
 * suite's own fixture user (an unscoped pass would act on real players' riders).
 * The pay weeks below are fixed dates in 2031 so no other suite's rows can collide.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { loadActiveAssignments, riderRefusal } from '../../../utils/competitionEntryRules.mjs';
import { processWeeklyRiderSalaries } from '../index.mjs';
import { getRiderPayWeekStart, riderPayWeekKey } from '../services/riderPayWeek.mjs';

const PREFIX = 'TestFixture-gafyt';
const tag = () => randomBytes(4).toString('hex');
// Wednesday 2031-03-05 -> pay week Monday 2031-03-03; the next pay week starts 2031-03-10.
const week1 = new Date('2031-03-05T15:00:00Z');
const week2 = new Date('2031-03-12T15:00:00Z');
const week3 = new Date('2031-03-19T15:00:00Z');

const userIds = [];
const horseIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { rider: { userId: { in: userIds } } } }), 'assignments');
cleanup.add(() => prisma.riderSalaryPayment.deleteMany({ where: { userId: { in: userIds } } }), 'payments');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } }), 'market');
cleanup.add(() => prisma.rider.deleteMany({ where: { userId: { in: userIds } } }), 'riders');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${t}`,
      email: `${PREFIX}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Pay',
      lastName: 'Day',
      level: 3,
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

// Owner ruling 2026-10-28 (q226, Equoria-nawn5): a rider's weekly pay is their star
// level's price, so each fixture rider carries the level whose price is its rate.
const starLevelForRate = rate => {
  const level = { 100: 'rookie', 200: 'novice', 300: 'intermediate', 400: 'advanced', 500: 'expert' }[rate];
  if (!level) {
    throw new Error(`no star level is priced at ${rate}`);
  }
  return level;
};

async function makeRider(userId, weeklyRate, extra = {}) {
  return prisma.rider.create({
    data: {
      userId,
      firstName: PREFIX,
      lastName: `Rider-${tag()}`,
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate,
      starLevel: starLevelForRate(weeklyRate),
      ...extra,
    },
  });
}

async function makeAssignedHorse(userId, riderId) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2024-06-15'),
      age: 5,
      userId,
      healthStatus: 'Excellent',
    },
  });
  horseIds.push(horse.id);
  await prisma.riderAssignment.create({ data: { riderId, horseId: horse.id, userId } });
  return horse;
}

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const pass = (userId, now) => processWeeklyRiderSalaries(now, { userId });
const rows = (userId, extra = {}) =>
  prisma.riderSalaryPayment.findMany({ where: { userId, ...extra }, orderBy: { id: 'asc' } });
const notices = (userId, type) => prisma.notification.findMany({ where: { userId, type }, orderBy: { id: 'asc' } });

describe('rider payday: the weekly rate is taken once a pay week', () => {
  it('charges each rider their own weekly rate and writes one paid row each', async () => {
    const { user } = await makeUser(1000);
    const a = await makeRider(user.id, 200);
    const b = await makeRider(user.id, 300);

    const result = await pass(user.id, week1);

    expect(result.successful).toBe(1);
    expect(result.totalAmount).toBe(500);
    expect(await moneyOf(user.id)).toBe(500);
    const paid = await rows(user.id, { status: 'paid' });
    expect(paid.map(r => [r.riderId, r.amount, r.weekKey]).sort()).toEqual(
      [
        [a.id, 200, '2031-03-03'],
        [b.id, 300, '2031-03-03'],
      ].sort(),
    );
  });

  it('a second pass in the same pay week charges nothing', async () => {
    const { user } = await makeUser(1000);
    await makeRider(user.id, 200);

    await pass(user.id, week1);
    const again = await pass(user.id, new Date('2031-03-08T20:00:00Z'));

    expect(again.skipped).toBe(1);
    expect(again.successful).toBe(0);
    expect(await moneyOf(user.id)).toBe(800);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(1);
  });

  it('two passes racing for the same player take the pay once', async () => {
    const { user } = await makeUser(1000);
    await makeRider(user.id, 200);
    await makeRider(user.id, 100);

    await Promise.all([pass(user.id, week1), pass(user.id, week1)]);

    expect(await moneyOf(user.id)).toBe(700);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(2);
  });

  it('a new pay week charges again', async () => {
    const { user } = await makeUser(1000);
    await makeRider(user.id, 200);

    await pass(user.id, week1);
    await pass(user.id, week2);

    expect(await moneyOf(user.id)).toBe(600);
  });

  it('does not charge a retired rider', async () => {
    const { user } = await makeUser(1000);
    await makeRider(user.id, 200, { retired: true });

    const result = await pass(user.id, week1);

    expect(result.processed).toBe(0);
    expect(await moneyOf(user.id)).toBe(1000);
  });

  it('a rider hired this pay week is not charged a second time by the Monday pass', async () => {
    const { user, token } = await makeUser(1000);
    await prisma.staffMarketplaceState.create({
      data: {
        userId: user.id,
        staffType: 'rider',
        refreshCount: 0,
        offers: [
          {
            marketplaceId: `mid-${tag()}`,
            firstName: 'Offer',
            lastName: PREFIX,
            personality: 'calm',
            skillLevel: 'rookie',
            starLevel: 'rookie',
            speciality: 'Show Jumping',
            weeklyRate: 100,
            experience: 5,
            bio: 'gafyt fixture',
          },
        ],
      },
    });
    const state = await prisma.staffMarketplaceState.findFirst({ where: { userId: user.id } });
    const csrf = await fetchCsrf(app);
    const hired = await request(app)
      .post('/api/v1/riders/marketplace/hire')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: state.offers[0].marketplaceId });
    expect(hired.status).toBe(201);
    expect(await moneyOf(user.id)).toBe(900);

    const result = await pass(user.id, new Date());

    expect(result.skipped).toBe(1);
    expect(await moneyOf(user.id)).toBe(900);
    const paid = await rows(user.id, { status: 'paid' });
    expect(paid).toHaveLength(1);
    expect(paid[0].weekKey).toBe(riderPayWeekKey(getRiderPayWeekStart(new Date())));
  });
});

describe('rider payday: an unpaid rider cannot ride, then leaves', () => {
  it('puts every rider in grace when the wallet cannot cover the roster, and tells the player', async () => {
    const { user } = await makeUser(250);
    const a = await makeRider(user.id, 200);
    const b = await makeRider(user.id, 300);

    const result = await pass(user.id, week1);

    expect(result.graced).toBe(2);
    expect(await moneyOf(user.id)).toBe(250);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(0);
    for (const id of [a.id, b.id]) {
      const rider = await prisma.rider.findUnique({ where: { id } });
      expect(rider.feeUnpaidSince.toISOString()).toBe(getRiderPayWeekStart(week1).toISOString());
      expect(rider.retired).toBe(false);
    }
    const told = await notices(user.id, 'riderFeeUnpaid');
    expect(told).toHaveLength(2);
    expect(told[0].payload).toMatchObject({ canRide: false, graceWeeks: 1 });
  });

  it('refuses show entry for an unpaid rider and allows it once paid', async () => {
    const { user } = await makeUser(100);
    const rider = await makeRider(user.id, 200);
    const horse = await makeAssignedHorse(user.id, rider.id);

    await pass(user.id, week1);
    let assignment = (await loadActiveAssignments(prisma, [horse.id])).get(horse.id);
    expect(riderRefusal(assignment, user.id)).toBe('riderFeeUnpaid');

    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    await pass(user.id, week2);
    assignment = (await loadActiveAssignments(prisma, [horse.id])).get(horse.id);
    expect(riderRefusal(assignment, user.id)).toBeNull();
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).feeUnpaidSince).toBeNull();
  });

  it('a second pass in the same unpaid week does not tell the player twice', async () => {
    const { user } = await makeUser(10);
    await makeRider(user.id, 200);

    await pass(user.id, week1);
    await pass(user.id, new Date('2031-03-07T10:00:00Z'));

    expect(await notices(user.id, 'riderFeeUnpaid')).toHaveLength(1);
    expect((await prisma.rider.findMany({ where: { userId: user.id } }))[0].retired).toBe(false);
  });

  it('after a full unpaid week the rider leaves: roster, assignments and a notice naming the horse', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);
    const horse = await makeAssignedHorse(user.id, rider.id);

    await pass(user.id, week1);
    const result = await pass(user.id, week2);

    expect(result.released).toBe(1);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.retired).toBe(true);
    expect(after.feeUnpaidSince).toBeNull();
    const assignment = await prisma.riderAssignment.findFirst({ where: { riderId: rider.id } });
    expect(assignment.isActive).toBe(false);
    const left = await notices(user.id, 'riderReleased');
    expect(left).toHaveLength(1);
    expect(left[0].payload.riderName).toContain(PREFIX);
    expect(left[0].payload.horses).toEqual([{ id: horse.id, name: horse.name }]);
    expect((await rows(user.id, { status: 'releasedNonPayment' })).length).toBe(1);
    expect(await moneyOf(user.id)).toBe(10);
  });

  it('a rider who is paid in the second week stays', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await pass(user.id, week1);
    // Owner q131 (2026-10-27): the missed week is owed, so week 2 collects 200 + 200.
    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    await pass(user.id, week2);

    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.retired).toBe(false);
    expect(after.feeUnpaidSince).toBeNull();
    expect(await moneyOf(user.id)).toBe(600);
    expect(await notices(user.id, 'riderReleased')).toHaveLength(0);
    // and a third pay week charges as normal
    await pass(user.id, week3);
    expect(await moneyOf(user.id)).toBe(400);
  });
});
