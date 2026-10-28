/**
 * Rider age, hidden retirement age and the one-week notice (owner ruling
 * 2026-10-23, Equoria-or2ua).
 *
 * The ruling: new riders start at a random age of 18-25; each rider's
 * retirement age is rolled at generation from 40-65 and is NEVER shown,
 * returned by an API or derivable; riders retire when they reach it; the
 * players who use a rider are notified ONE WEEK before.
 *
 * Real DB, real routes (supertest), scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import config from '../../../config/config.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  riderStartAgeMin,
  riderStartAgeMax,
  riderRetirementAgeMin,
  riderRetirementAgeMax,
  drawRiderStartAge,
  drawRiderRetirementAge,
  riderAgeYears,
} from '../services/riderRetirementScheduleService.mjs';
import { generateRiderMarketplace } from '../services/riderMarketplace.mjs';
import { processRiderRetirement, backfillRiderRetirementSchedules } from '../index.mjs';

// Anything that reads, writes or draws the hidden age: the relation key or client
// accessor, the table, the ensure/draw functions, the band constants.
const accessPattern =
  /riderRetirementSchedule\s*[:.]|\.riderRetirementSchedule|rider_retirement_schedules|ensureRiderRetirementSchedule|drawRiderRetirementAge|riderRetirementAge(Min|Max)/;
const PREFIX = 'TestFixture-or2ua';
const tag = () => randomBytes(4).toString('hex');
const userIds = [];
const horseIds = [];
const riderIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { riderId: { in: riderIds } } }), 'assignments');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } }), 'market');
cleanup.add(
  () => prisma.rider.deleteMany({ where: { OR: [{ id: { in: riderIds } }, { userId: { in: userIds } }] } }),
  'riders',
);
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makeUser(money = 100000) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${t}`,
      email: `${PREFIX}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Rider',
      lastName: 'Owner',
      level: 3,
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function makeHorse(userId) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId,
      healthStatus: 'Excellent',
    },
  });
  horseIds.push(horse.id);
  return horse;
}

/** A scheduled rider: age = startAge + careerWeeks. */
async function makeRider({ userId, startAge, careerWeeks, retirementAge, noticeSentAt = null, withSchedule = true }) {
  const rider = await prisma.rider.create({
    data: {
      userId,
      firstName: PREFIX,
      lastName: `Rider-${tag()}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      careerWeeks,
      startAge,
      ...(withSchedule ? { riderRetirementSchedule: { create: { retirementAge, noticeSentAt } } } : {}),
    },
  });
  riderIds.push(rider.id);
  return rider;
}

const notificationsFor = (userId, riderId) =>
  prisma.notification
    .findMany({ where: { userId, type: 'riderRetiring' } })
    .then(rows => rows.filter(n => n.payload?.riderId === riderId));

describe('the rolls (Equoria-or2ua)', () => {
  it('a start age is always 18-25 and a retirement age always 40-65, and both ends are reachable', () => {
    const starts = new Set();
    const retirements = new Set();
    for (let i = 0; i < 3000; i++) {
      starts.add(drawRiderStartAge());
      retirements.add(drawRiderRetirementAge());
    }
    expect(Math.min(...starts)).toBe(18);
    expect(Math.max(...starts)).toBe(25);
    expect(Math.min(...retirements)).toBe(40);
    expect(Math.max(...retirements)).toBe(65);
    expect([riderStartAgeMin, riderStartAgeMax]).toEqual([18, 25]);
    expect([riderRetirementAgeMin, riderRetirementAgeMax]).toEqual([40, 65]);
  });

  it('generated marketplace riders carry a start age of 18-25', () => {
    for (let i = 0; i < 40; i++) {
      for (const offer of generateRiderMarketplace(6)) {
        expect(offer.startAge).toBeGreaterThanOrEqual(18);
        expect(offer.startAge).toBeLessThanOrEqual(25);
      }
    }
  });

  it('age follows the game calendar: startAge plus career weeks; unknown start age is null, not zero', () => {
    expect(riderAgeYears({ startAge: 20, careerWeeks: 7 })).toBe(27);
    expect(riderAgeYears({ startAge: null, careerWeeks: 7 })).toBeNull();
  });
});

describe('hiring a rider rolls both ages once (Equoria-or2ua)', () => {
  it('stores a start age of 18-25 and a schedule of 40-65, and the response never carries the retirement age', async () => {
    const { user, token } = await makeUser();
    const marketplaceId = `mid-${tag()}`;
    await prisma.staffMarketplaceState.create({
      data: {
        userId: user.id,
        staffType: 'rider',
        offers: [
          {
            marketplaceId,
            firstName: 'Offer',
            lastName: 'Rider',
            personality: 'daring',
            skillLevel: 'experienced',
            speciality: 'Show Jumping',
            weeklyRate: 100,
            experience: 5,
            bio: 'fixture',
          },
        ],
        refreshCount: 0,
      },
    });

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/riders/marketplace/hire')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId });
    expect(res.status).toBe(201);
    riderIds.push(res.body.data.rider.id);

    const stored = await prisma.rider.findUnique({
      where: { id: res.body.data.rider.id },
      include: { riderRetirementSchedule: true },
    });
    expect(stored.startAge).toBeGreaterThanOrEqual(18);
    expect(stored.startAge).toBeLessThanOrEqual(25);
    expect(stored.riderRetirementSchedule.retirementAge).toBeGreaterThanOrEqual(40);
    expect(stored.riderRetirementSchedule.retirementAge).toBeLessThanOrEqual(65);
    expect(stored.riderRetirementSchedule.noticeSentAt).toBeNull();

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/retirementAge|riderRetirementSchedule|noticeSentAt/);
  });
});

describe('rider payloads never carry the retirement age (Equoria-or2ua)', () => {
  it('the roster, the marketplace and the assignments payloads lack it and anything derivable from it', async () => {
    const { user, token } = await makeUser();
    const horse = await makeHorse(user.id);
    const rider = await makeRider({
      userId: user.id,
      startAge: 20,
      careerWeeks: 5,
      retirementAge: 57,
      noticeSentAt: new Date(),
    });
    await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: user.id, isActive: true },
    });

    const get = path =>
      request(app).get(path).set('Origin', 'http://localhost:3000').set('Authorization', `Bearer ${token}`);
    const payloads = [
      await get(`/api/v1/riders/user/${user.id}`),
      await get('/api/v1/riders/marketplace'),
      await get('/api/v1/riders/assignments'),
    ];
    for (const res of payloads) {
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/retirementAge|riderRetirementSchedule|noticeSentAt|retirement_age/i);
      // The age the schedule holds appears nowhere as a field a client could read.
      expect(body).not.toMatch(/"(retire|retirement)[A-Za-z]*":\s*57\b/);
    }
    const roster = payloads[0].body;
    const riderRow = JSON.stringify(roster).includes(`"id":${rider.id}`);
    expect(riderRow).toBe(true);
  });

  it('only the retirement service and the backfill read or write the schedule table', () => {
    const modulesRoot = join(fileURLToPath(new URL('../../..', import.meta.url)));
    const allowed = new Set([
      join('modules', 'riders', 'services', 'riderRetirementScheduleService.mjs'),
      join('modules', 'riders', 'services', 'riderRetirementService.mjs'),
      join('modules', 'riders', 'services', 'riderRetirementBackfillService.mjs'),
    ]);
    const offenders = [];
    const walk = dir => {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '__tests__' || name === 'tests' || name === 'docs') {
          continue;
        }
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.(mjs|js|ts)$/.test(name)) {
          const rel = relative(modulesRoot, full);
          if (allowed.has(rel) || rel.split(sep)[0] === 'scripts') {
            continue;
          }
          if (accessPattern.test(readFileSync(full, 'utf8'))) {
            // Only the hire path may call the draw (a value-discarding statement).
            if (rel === join('modules', 'riders', 'controllers', 'riderMarketplaceController.mjs')) {
              const src = readFileSync(full, 'utf8');
              expect(src).toMatch(/^\s*await ensureRiderRetirementSchedule\(tx, rider\.id\);$/m);
              expect(src).not.toMatch(/=\s*await ensureRiderRetirementSchedule/);
              continue;
            }
            offenders.push(rel);
          }
        }
      }
    };
    walk(modulesRoot);
    expect(offenders).toEqual([]);
  });
});

describe('the weekly pass: one-week notice, then retirement (Equoria-or2ua)', () => {
  it('notices the rider who retires at the next tick, sends exactly one notice, then retires them a pass later', async () => {
    const { user } = await makeUser();
    const other = await makeUser();
    const horse = await makeHorse(other.user.id);
    // age 50 now; retires at 51 (the next tick).
    const rider = await makeRider({ userId: user.id, startAge: 20, careerWeeks: 30, retirementAge: 51 });
    const assignment = await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: other.user.id, isActive: true },
    });

    const first = await processRiderRetirement();
    expect(first.noticedIds).toContain(rider.id);
    expect(first.retiredIds).not.toContain(rider.id);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(false);

    // Both the hirer and the owner of the horse that uses the rider are told.
    const hirerNotes = await notificationsFor(user.id, rider.id);
    const ownerNotes = await notificationsFor(other.user.id, rider.id);
    expect(hirerNotes).toHaveLength(1);
    expect(ownerNotes).toHaveLength(1);
    expect(ownerNotes[0].payload.horses).toEqual([{ id: horse.id, name: horse.name }]);
    // The notice names the rider; it carries no age and no countdown.
    expect(Object.keys(ownerNotes[0].payload).sort()).toEqual(['horses', 'riderId', 'riderName']);
    expect(JSON.stringify(ownerNotes[0].payload)).not.toMatch(/age|retire|week/i);

    // A repeat pass the same week sends no second notice and retires nobody.
    const repeat = await processRiderRetirement();
    expect(repeat.noticedIds).not.toContain(rider.id);
    expect(repeat.retiredIds).not.toContain(rider.id);
    expect(await notificationsFor(user.id, rider.id)).toHaveLength(1);

    // The Monday tick ages the rider to 51; the next pass retires them.
    await prisma.rider.update({ where: { id: rider.id }, data: { careerWeeks: { increment: 1 } } });
    const second = await processRiderRetirement();
    expect(second.retiredIds).toContain(rider.id);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(true);
    expect((await prisma.riderAssignment.findUnique({ where: { id: assignment.id } })).isActive).toBe(false);
    // Retirement itself sends nothing further: the week's warning was the notice.
    expect(await notificationsFor(other.user.id, rider.id)).toHaveLength(1);
  }, 60000);

  it('a rider already past their age when first seen is noticed first and retired a pass later', async () => {
    const { user } = await makeUser();
    const rider = await makeRider({ userId: user.id, startAge: 25, careerWeeks: 60, retirementAge: 45 });

    const first = await processRiderRetirement();
    expect(first.noticedIds).toContain(rider.id);
    expect(first.retiredIds).not.toContain(rider.id);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(false);

    const second = await processRiderRetirement();
    expect(second.retiredIds).toContain(rider.id);
  }, 60000);

  it('leaves a younger rider, and a rider with no schedule yet, completely alone', async () => {
    const { user } = await makeUser();
    const young = await makeRider({ userId: user.id, startAge: 20, careerWeeks: 3, retirementAge: 60 });
    const unscheduled = await makeRider({
      userId: user.id,
      startAge: 20,
      careerWeeks: 500,
      retirementAge: 40,
      withSchedule: false,
    });

    const result = await processRiderRetirement();

    for (const r of [young, unscheduled]) {
      expect(result.noticedIds).not.toContain(r.id);
      expect(result.retiredIds).not.toContain(r.id);
      expect((await prisma.rider.findUnique({ where: { id: r.id } })).retired).toBe(false);
    }
    expect(await notificationsFor(user.id, young.id)).toHaveLength(0);
  }, 60000);
});

describe('the backfill for riders that predate the ruling (Equoria-or2ua)', () => {
  it('dry run writes nothing; the real run rolls once and a second run changes nothing', async () => {
    const { user } = await makeUser();
    const old = await makeRider({
      userId: user.id,
      startAge: null,
      careerWeeks: 12,
      retirementAge: 50,
      withSchedule: false,
    });
    const hasSchedule = await makeRider({ userId: user.id, startAge: 22, careerWeeks: 4, retirementAge: 61 });

    const dry = await backfillRiderRetirementSchedules({ dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.ridersWithoutStartAge).toBeGreaterThanOrEqual(1);
    expect(dry.ridersWithoutSchedule).toBeGreaterThanOrEqual(1);
    expect(dry.startAgesWritten).toBe(0);
    expect(dry.schedulesWritten).toBe(0);
    const untouched = await prisma.rider.findUnique({
      where: { id: old.id },
      include: { riderRetirementSchedule: true },
    });
    expect(untouched.startAge).toBeNull();
    expect(untouched.riderRetirementSchedule).toBeNull();

    await backfillRiderRetirementSchedules({});
    const rolled = await prisma.rider.findUnique({ where: { id: old.id }, include: { riderRetirementSchedule: true } });
    expect(rolled.startAge).toBeGreaterThanOrEqual(18);
    expect(rolled.startAge).toBeLessThanOrEqual(25);
    expect(rolled.riderRetirementSchedule.retirementAge).toBeGreaterThanOrEqual(40);
    expect(rolled.riderRetirementSchedule.retirementAge).toBeLessThanOrEqual(65);

    // A rider that already had both keeps them exactly.
    const kept = await prisma.rider.findUnique({
      where: { id: hasSchedule.id },
      include: { riderRetirementSchedule: true },
    });
    expect(kept.startAge).toBe(22);
    expect(kept.riderRetirementSchedule.retirementAge).toBe(61);

    // Idempotent: a second run rolls nothing new.
    await backfillRiderRetirementSchedules({});
    const again = await prisma.rider.findUnique({ where: { id: old.id }, include: { riderRetirementSchedule: true } });
    expect(again.startAge).toBe(rolled.startAge);
    expect(again.riderRetirementSchedule.retirementAge).toBe(rolled.riderRetirementSchedule.retirementAge);
  }, 60000);
});
