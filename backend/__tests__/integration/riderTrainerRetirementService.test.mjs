/**
 * Integration Test: riderTrainerRetirementService — Auto-retire overdue riders + trainers (Equoria-osum)
 *
 * Real DB. No mocks. Verifies:
 *   - Trainers above the mandatory-retirement threshold are flipped to retired=true.
 *   - A below-threshold trainer is left alone.
 *   - Already-retired ones are idempotently skipped.
 *   - Active assignments are deactivated when their rider/trainer retires.
 *
 * OLD CONTRACT (Equoria-osum): riders retired at careerWeeks >= 80, like
 * trainers. NEW RULING (owner, 2026-10-23, Equoria-or2ua): riders retire at a
 * hidden random age (40-65) after a one-week notice. The rider cases below
 * drive that rule through processRiderRetirement; the full lifecycle, the
 * notification and the hidden-age checks live in
 * modules/riders/__tests__/riderRetirementHidden.integration.test.mjs.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { processRiderTrainerRetirement } from '../../modules/trainers/index.mjs';
import { processRiderRetirement } from '../../modules/riders/index.mjs';
import {
  autoRetireOverdueTrainers,
  TRAINER_MANDATORY_RETIREMENT_WEEKS,
} from '../../modules/trainers/services/riderTrainerRetirementService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const PREFIX = `TestFixture-Retire-${UNIQUE}-`;

const createdRiderIds = [];
const createdTrainerIds = [];
const createdHorseIds = [];
const createdUserIds = [];
let testUser;
let testHorse;

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      id: `${PREFIX}user`,
      email: `${PREFIX}user@test.local`,
      username: `${PREFIX}user`,
      password: 'irrelevant-for-this-test',
      firstName: 'Test',
      lastName: 'User',
    },
  });
  createdUserIds.push(testUser.id);

  const breed =
    (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ||
    (await prisma.breed.create({ data: { name: 'Thoroughbred', description: 'Test breed' } }));

  testHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse`,
      sex: 'Mare',
      age: 4,
      dateOfBirth: gameCalendarDate(new Date(), -4 * 365),
      breed: { connect: { id: breed.id } },
      user: { connect: { id: testUser.id } },
    },
  });
  createdHorseIds.push(testHorse.id);
});

afterAll(async () => {
  // Clean up assignments first (FK).
  await prisma.riderAssignment.deleteMany({ where: { riderId: { in: createdRiderIds } } });
  await prisma.trainerAssignment.deleteMany({ where: { trainerId: { in: createdTrainerIds } } });
  if (createdRiderIds.length) {
    await prisma.rider.deleteMany({ where: { id: { in: createdRiderIds } } });
  }
  if (createdTrainerIds.length) {
    await prisma.trainer.deleteMany({ where: { id: { in: createdTrainerIds } } });
  }
  if (createdHorseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe('rider retirement at a hidden age (Equoria-osum, Equoria-or2ua)', () => {
  const makeRider = async (name, { startAge, careerWeeks, retirementAge, noticeSentAt = null }) => {
    const rider = await prisma.rider.create({
      data: {
        firstName: `${PREFIX}${name}`,
        lastName: 'Smith',
        personality: 'daring',
        skillLevel: 'experienced',
        speciality: 'Show Jumping',
        careerWeeks,
        startAge,
        retired: false,
        riderRetirementSchedule: { create: { retirementAge, noticeSentAt } },
      },
    });
    createdRiderIds.push(rider.id);
    return rider;
  };

  it('retires a rider at their age (after the notice) and deactivates assignments', async () => {
    const overdueRider = await makeRider('OverdueR', {
      startAge: 20,
      careerWeeks: 30,
      retirementAge: 50,
      noticeSentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    const assignment = await prisma.riderAssignment.create({
      data: { riderId: overdueRider.id, horseId: testHorse.id, userId: testUser.id, isActive: true },
    });

    const result = await processRiderRetirement();

    expect(result.retiredIds).toContain(overdueRider.id);
    const after = await prisma.rider.findUnique({ where: { id: overdueRider.id } });
    expect(after.retired).toBe(true);
    const assignmentAfter = await prisma.riderAssignment.findUnique({ where: { id: assignment.id } });
    expect(assignmentAfter.isActive).toBe(false);
  });

  it('does NOT retire a rider who is younger than their retirement age', async () => {
    const youngRider = await makeRider('YoungR', { startAge: 20, careerWeeks: 10, retirementAge: 60 });

    const result = await processRiderRetirement();
    expect(result.retiredIds).not.toContain(youngRider.id);

    const after = await prisma.rider.findUnique({ where: { id: youngRider.id } });
    expect(after.retired).toBe(false);
  });

  it('is idempotent — a second pass does not re-process an already-retired rider', async () => {
    const rider = await makeRider('IdemR', {
      startAge: 20,
      careerWeeks: 40,
      retirementAge: 50,
      noticeSentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    expect((await processRiderRetirement()).retiredIds).toContain(rider.id);
    expect((await processRiderRetirement()).retiredIds).not.toContain(rider.id);
  });
});

describe('autoRetireOverdueTrainers (Equoria-osum)', () => {
  it('retires a trainer whose careerWeeks >= MANDATORY_RETIREMENT_WEEKS and deactivates assignments', async () => {
    const overdueTrainer = await prisma.trainer.create({
      data: {
        firstName: `${PREFIX}OverdueT`,
        lastName: 'Adams',
        personality: 'focused',
        skillLevel: 'expert',
        speciality: 'Cross Country',
        careerWeeks: TRAINER_MANDATORY_RETIREMENT_WEEKS + 5,
        retired: false,
      },
    });
    createdTrainerIds.push(overdueTrainer.id);

    const assignment = await prisma.trainerAssignment.create({
      data: {
        trainerId: overdueTrainer.id,
        horseId: testHorse.id,
        userId: testUser.id,
        isActive: true,
      },
    });

    const result = await autoRetireOverdueTrainers();
    expect(result.retiredCount).toBeGreaterThanOrEqual(1);
    expect(result.retiredIds).toContain(overdueTrainer.id);

    const after = await prisma.trainer.findUnique({ where: { id: overdueTrainer.id } });
    expect(after.retired).toBe(true);

    const assignmentAfter = await prisma.trainerAssignment.findUnique({
      where: { id: assignment.id },
    });
    expect(assignmentAfter.isActive).toBe(false);
  });

  it('does NOT retire a trainer whose careerWeeks is below the threshold', async () => {
    const youngTrainer = await prisma.trainer.create({
      data: {
        firstName: `${PREFIX}YoungT`,
        lastName: 'Black',
        personality: 'patient',
        skillLevel: 'novice',
        speciality: 'Dressage',
        careerWeeks: TRAINER_MANDATORY_RETIREMENT_WEEKS - 10,
        retired: false,
      },
    });
    createdTrainerIds.push(youngTrainer.id);

    const result = await autoRetireOverdueTrainers();
    expect(result.retiredIds).not.toContain(youngTrainer.id);

    const after = await prisma.trainer.findUnique({ where: { id: youngTrainer.id } });
    expect(after.retired).toBe(false);
  });
});

describe('processRiderTrainerRetirement (Equoria-osum)', () => {
  it('returns combined counts for the weekly pass', async () => {
    const result = await processRiderTrainerRetirement();
    expect(result).toHaveProperty('riders');
    expect(result).toHaveProperty('trainers');
    expect(typeof result.riders.retiredCount).toBe('number');
    expect(typeof result.riders.noticedCount).toBe('number');
    expect(typeof result.trainers.retiredCount).toBe('number');
  });
});
