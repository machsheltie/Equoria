/**
 * Equoria-g8fhu: the weekly rider + trainer retirement job is safe to run
 * again (icqqm class: a periodic job re-run after a partial failure, a manual
 * trigger after the cron, or a scheduler double tick must not apply anything
 * twice).
 *
 * The job moves no money. What a second run could double is: a rider's
 * one-week retirement notice (a second bell), and the retire writes on riders,
 * trainers and their assignments. This drives processRiderTrainerRetirement
 * twice over one set of fixtures and checks the second pass writes nothing for
 * them: no second notice, no re-written rider, trainer or assignment row.
 *
 * The trainer pass also flips Trainer.retired and ends the trainer's
 * assignments in one transaction now (it was two separate writes, so a failure
 * between them left a retired trainer still assigned, and the next run skipped
 * that trainer as already retired).
 *
 * Real DB, real services, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processRiderTrainerRetirement } from '../index.mjs';

// The one-week notice type (riders riderRetirementService.riderRetiringNotificationType).
const riderRetiringNotificationType = 'riderRetiring';

const fixturePrefix = 'TestFixture-g8fhu';
const suffix = randomBytes(6).toString('hex');
const aWeekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
// Well past the trainer retirement threshold (80 career weeks).
const overdueCareerWeeks = 200;

describe('weekly rider + trainer retirement re-run (Equoria-g8fhu)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let horse;
  let retiringRider;
  let noticedRider;
  let overdueTrainer;
  let riderAssignment;
  let noticedRiderAssignment;
  let trainerAssignment;

  beforeAll(async () => {
    // FK order: notifications and assignments, then staff, horse, user.
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: owner.id } }), 'notification');
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: horse.id } }), 'riderAssignment');
    cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { horseId: horse.id } }), 'trainerAssignment');
    cleanup.add(
      () =>
        prisma.riderRetirementSchedule.deleteMany({ where: { riderId: { in: [retiringRider.id, noticedRider.id] } } }),
      'riderRetirementSchedule',
    );
    cleanup.add(() => prisma.rider.deleteMany({ where: { userId: owner.id } }), 'rider');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { userId: owner.id } }), 'trainer');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');

    owner = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'G8fhu',
        lastName: 'Owner',
        money: 0,
      },
    });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-horse-${suffix}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        userId: owner.id,
        healthStatus: 'Excellent',
      },
    });
    const riderData = lastName => ({
      firstName: 'TestFixture',
      lastName: `G8fhu-${lastName}-${suffix}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Jumping',
      weeklyRate: 200,
      userId: owner.id,
    });
    // At the hidden retirement age, noticed in an earlier pass: retires now.
    retiringRider = await prisma.rider.create({
      data: {
        ...riderData('retiring'),
        startAge: 20,
        careerWeeks: 30,
        riderRetirementSchedule: { create: { retirementAge: 50, noticeSentAt: aWeekAgo() } },
      },
    });
    // One year short of the retirement age, not yet noticed: gets the notice now.
    noticedRider = await prisma.rider.create({
      data: {
        ...riderData('noticed'),
        startAge: 20,
        careerWeeks: 29,
        riderRetirementSchedule: { create: { retirementAge: 50, noticeSentAt: null } },
      },
    });
    overdueTrainer = await prisma.trainer.create({
      data: {
        firstName: 'TestFixture',
        lastName: `G8fhu-trainer-${suffix}`,
        personality: 'focused',
        skillLevel: 'expert',
        speciality: 'Dressage',
        careerWeeks: overdueCareerWeeks,
        retired: false,
        userId: owner.id,
      },
    });
    riderAssignment = await prisma.riderAssignment.create({
      data: { riderId: retiringRider.id, horseId: horse.id, userId: owner.id, isActive: true },
    });
    noticedRiderAssignment = await prisma.riderAssignment.create({
      data: { riderId: noticedRider.id, horseId: horse.id, userId: owner.id, isActive: true },
    });
    trainerAssignment = await prisma.trainerAssignment.create({
      data: { trainerId: overdueTrainer.id, horseId: horse.id, userId: owner.id, isActive: true },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  const snapshot = async () => ({
    retiringRider: await prisma.rider.findUnique({ where: { id: retiringRider.id } }),
    noticedRider: await prisma.rider.findUnique({ where: { id: noticedRider.id } }),
    noticeSchedule: await prisma.riderRetirementSchedule.findUnique({ where: { riderId: noticedRider.id } }),
    trainer: await prisma.trainer.findUnique({ where: { id: overdueTrainer.id } }),
    riderAssignment: await prisma.riderAssignment.findUnique({ where: { id: riderAssignment.id } }),
    noticedRiderAssignment: await prisma.riderAssignment.findUnique({ where: { id: noticedRiderAssignment.id } }),
    trainerAssignment: await prisma.trainerAssignment.findUnique({ where: { id: trainerAssignment.id } }),
    notices: await prisma.notification.findMany({
      where: { userId: owner.id, type: riderRetiringNotificationType },
    }),
  });

  it('the first pass retires, ends assignments and sends one notice; a second pass changes nothing', async () => {
    const first = await processRiderTrainerRetirement();
    expect(first.riders.retiredIds).toContain(retiringRider.id);
    expect(first.riders.noticedIds).toContain(noticedRider.id);
    expect(first.trainers.retiredIds).toContain(overdueTrainer.id);

    const afterFirst = await snapshot();
    expect(afterFirst.retiringRider.retired).toBe(true);
    expect(afterFirst.riderAssignment.isActive).toBe(false);
    expect(afterFirst.noticedRider.retired).toBe(false);
    expect(afterFirst.noticedRiderAssignment.isActive).toBe(true);
    expect(afterFirst.noticeSchedule.noticeSentAt).not.toBeNull();
    expect(afterFirst.trainer.retired).toBe(true);
    expect(afterFirst.trainerAssignment.isActive).toBe(false);
    expect(afterFirst.notices).toHaveLength(1);
    expect(afterFirst.notices[0].payload).toMatchObject({ riderId: noticedRider.id });

    // The re-run: a manual trigger after the cron, or a retry after a failure.
    const second = await processRiderTrainerRetirement();
    expect(second.riders.retiredIds).not.toContain(retiringRider.id);
    expect(second.riders.noticedIds).not.toContain(noticedRider.id);
    expect(second.trainers.retiredIds).not.toContain(overdueTrainer.id);

    const afterSecond = await snapshot();
    expect(afterSecond.notices).toHaveLength(1);
    expect(afterSecond.noticeSchedule.noticeSentAt).toEqual(afterFirst.noticeSchedule.noticeSentAt);
    // No row of ours was written again (updatedAt is bumped by any update).
    for (const key of [
      'retiringRider',
      'noticedRider',
      'trainer',
      'riderAssignment',
      'noticedRiderAssignment',
      'trainerAssignment',
    ]) {
      expect({ key, updatedAt: afterSecond[key].updatedAt }).toEqual({ key, updatedAt: afterFirst[key].updatedAt });
    }
  }, 60000);
});
