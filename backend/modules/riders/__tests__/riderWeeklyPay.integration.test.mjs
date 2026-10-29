/**
 * Rider weekly payday (owner ruling 2026-10-27, q111; Equoria-gafyt).
 *
 * "Riders, yes. Trainers players pay when they click Train Horse." Owner rulings
 * 2026-10-28 and 2026-10-29 (q268, Equoria-hc96y): payday is a player action. The player
 * presses Pay Rider any time in the week; at the end of the week an unpaid rider cannot
 * ride; after a full unpaid week the rider leaves; the player is told at each moment.
 * Old contract: a weekly pass took every rider's pay every Monday. That pass was removed
 * (Equoria-kw60x) and its cases moved here onto the player's Pay Rider path.
 *
 * Real DB, real Pay Rider service with an injected clock, real hire and pay routes
 * (supertest), real entry rule. Every week-end settlement is scoped to this suite's own
 * fixture user (an unscoped one would act on real players' riders). The pay weeks below
 * are fixed dates in 2031 so no other suite's rows can collide.
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
import { settleEndedRiderPayWeek } from '../index.mjs';
import { payRider } from '../services/riderPlayerPayService.mjs';
import { getRiderPayWeekStart, riderPayWeekKey } from '../services/riderPayWeek.mjs';

const PREFIX = 'TestFixture-gafyt';
const tag = () => randomBytes(4).toString('hex');
// Owner ruling 2026-10-29 (q268, Equoria-hc96y): the pay week ends Sunday midnight Eastern,
// so it starts on Sunday. Old contract: the pay week started on Monday.
// Wednesday 2031-03-05 -> pay week Sunday 2031-03-02; the next pay week starts 2031-03-09.
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
// A rider who leaves for the hire pool (owner ruling 2026-10-28, q177) has no userId, so
// this file's riders are also matched by their fixture first name.
cleanup.add(
  () =>
    prisma.rider.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { firstName: PREFIX }] },
    }),
  'riders',
);
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
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
// The player presses Pay Rider at `now`.
const pay = (userId, riderId, now) => payRider(userId, riderId, now);
// The week-end settlement run from an instant in the NEXT pay week settles the week before.
const settle = (userId, now) => settleEndedRiderPayWeek(now, { userId });
const alreadyPaid = { status: 409, code: 'alreadyPaid' };
const insufficientFunds = { status: 400, code: 'insufficientFunds' };
const rows = (userId, extra = {}) =>
  prisma.riderSalaryPayment.findMany({ where: { userId, ...extra }, orderBy: { id: 'asc' } });
const notices = (userId, type) => prisma.notification.findMany({ where: { userId, type }, orderBy: { id: 'asc' } });

describe('rider payday: Pay Rider takes the weekly rate once a pay week', () => {
  it('charges each rider their own weekly rate and writes one paid row each', async () => {
    const { user } = await makeUser(1000);
    const a = await makeRider(user.id, 200);
    const b = await makeRider(user.id, 300);

    expect(await pay(user.id, a.id, week1)).toEqual({ riderId: a.id, amount: 200 });
    expect(await pay(user.id, b.id, week1)).toEqual({ riderId: b.id, amount: 300 });

    expect(await moneyOf(user.id)).toBe(500);
    const paid = await rows(user.id, { status: 'paid' });
    expect(paid.map(r => [r.riderId, r.amount, r.weekKey]).sort()).toEqual(
      [
        [a.id, 200, '2031-03-02'],
        [b.id, 300, '2031-03-02'],
      ].sort(),
    );
  });

  it('a second press in the same pay week is refused and charges nothing', async () => {
    const { user } = await makeUser(1000);
    const rider = await makeRider(user.id, 200);

    await pay(user.id, rider.id, week1);
    // Saturday 15:00 Eastern: the last day of the same pay week.
    await expect(pay(user.id, rider.id, new Date('2031-03-08T20:00:00Z'))).rejects.toMatchObject(alreadyPaid);

    expect(await moneyOf(user.id)).toBe(800);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(1);
  });

  it('two presses racing for the same rider take the pay once', async () => {
    const { user } = await makeUser(1000);
    const rider = await makeRider(user.id, 200);

    const results = await Promise.allSettled([pay(user.id, rider.id, week1), pay(user.id, rider.id, week1)]);

    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find(r => r.status === 'rejected').reason).toMatchObject(alreadyPaid);
    expect(await moneyOf(user.id)).toBe(800);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(1);
  });

  it("presses racing for two of one player's riders take each rider's pay once", async () => {
    const { user } = await makeUser(1000);
    const a = await makeRider(user.id, 200);
    const b = await makeRider(user.id, 100);

    await Promise.all([pay(user.id, a.id, week1), pay(user.id, b.id, week1)]);

    expect(await moneyOf(user.id)).toBe(700);
    expect(await rows(user.id, { status: 'paid' })).toHaveLength(2);
  });

  it('a new pay week charges again', async () => {
    const { user } = await makeUser(1000);
    const rider = await makeRider(user.id, 200);

    await pay(user.id, rider.id, week1);
    await pay(user.id, rider.id, week2);

    expect(await moneyOf(user.id)).toBe(600);
  });

  it('does not charge a retired rider', async () => {
    const { user } = await makeUser(1000);
    const rider = await makeRider(user.id, 200, { retired: true });

    await expect(pay(user.id, rider.id, week1)).rejects.toMatchObject({ status: 404, code: 'riderNotFound' });

    expect(await moneyOf(user.id)).toBe(1000);
    expect(await rows(user.id)).toHaveLength(0);
  });

  it('a rider hired this pay week is not charged a second time by Pay Rider', async () => {
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

    const rider = await prisma.rider.findFirst({ where: { userId: user.id } });
    const csrfPay = await fetchCsrf(app);
    const again = await request(app)
      .post(`/api/v1/riders/${rider.id}/pay`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrfPay.cookieHeader)
      .set('X-CSRF-Token', csrfPay.csrfToken);

    expect(again.status).toBe(409);
    expect(again.body.code).toBe('alreadyPaid');
    expect(await moneyOf(user.id)).toBe(900);
    const paid = await rows(user.id, { status: 'paid' });
    expect(paid).toHaveLength(1);
    expect(paid[0].weekKey).toBe(riderPayWeekKey(getRiderPayWeekStart(new Date())));
  });
});

describe('rider payday: an unpaid rider cannot ride, then leaves', () => {
  it('puts every rider in grace when the wallet could not pay them by the end of the week, and tells the player', async () => {
    const { user } = await makeUser(150);
    const a = await makeRider(user.id, 200);
    const b = await makeRider(user.id, 300);

    await expect(pay(user.id, a.id, week1)).rejects.toMatchObject(insufficientFunds);
    await expect(pay(user.id, b.id, week1)).rejects.toMatchObject(insufficientFunds);
    const result = await settle(user.id, week2);

    expect(result.graced).toBe(2);
    expect(await moneyOf(user.id)).toBe(150);
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

    await expect(pay(user.id, rider.id, week1)).rejects.toMatchObject(insufficientFunds);
    await settle(user.id, week2);
    let assignment = (await loadActiveAssignments(prisma, [horse.id])).get(horse.id);
    expect(riderRefusal(assignment, user.id)).toBe('riderFeeUnpaid');

    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    await pay(user.id, rider.id, week2);
    assignment = (await loadActiveAssignments(prisma, [horse.id])).get(horse.id);
    expect(riderRefusal(assignment, user.id)).toBeNull();
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).feeUnpaidSince).toBeNull();
  });

  it('a second settlement of the same unpaid week does not tell the player twice', async () => {
    const { user } = await makeUser(10);
    await makeRider(user.id, 200);

    await settle(user.id, week2);
    await settle(user.id, new Date('2031-03-14T10:00:00Z'));

    expect(await notices(user.id, 'riderFeeUnpaid')).toHaveLength(1);
    expect((await prisma.rider.findMany({ where: { userId: user.id } }))[0].retired).toBe(false);
  });

  it('after a full unpaid week the rider leaves: roster, assignments and a notice naming the horse', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);
    const horse = await makeAssignedHorse(user.id, rider.id);

    await settle(user.id, week2);
    const result = await settle(user.id, week3);

    expect(result.released).toBe(1);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    // Owner ruling 2026-10-28 (q177, Equoria-xlw03) changed this contract: a rider who
    // leaves after a full unpaid week returns to the riders-for-hire pool (old contract:
    // the rider was retired).
    expect(after).toMatchObject({ retired: false, userId: null });
    expect(after.freeAgentSince).not.toBeNull();
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

    await settle(user.id, week2);
    // Owner q131 (2026-10-27): the missed week is owed, so week 2 collects 200 + 200.
    await prisma.user.update({ where: { id: user.id }, data: { money: 1000 } });
    expect((await pay(user.id, rider.id, week2)).amount).toBe(400);
    // the end of week 2 finds the rider paid
    await settle(user.id, week3);

    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.retired).toBe(false);
    expect(after.feeUnpaidSince).toBeNull();
    expect(await moneyOf(user.id)).toBe(600);
    expect(await notices(user.id, 'riderReleased')).toHaveLength(0);
    // and a third pay week charges as normal
    await pay(user.id, rider.id, week3);
    expect(await moneyOf(user.id)).toBe(400);
  });
});
