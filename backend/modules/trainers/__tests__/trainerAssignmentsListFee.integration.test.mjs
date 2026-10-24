/**
 * GET /api/v1/trainers/assignments — each assignment carries the trainer's
 * per-session fee and personality (Equoria-r8a6h, owner ruling 2026-10-23).
 *
 * The horse page shows the horse's assigned trainer and "Train Horse <price>".
 * The price is the trainer's advertised per-session fee (Trainer.sessionRate),
 * the same figure the training transaction charges once per weekly session.
 *
 * Real DB, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const fixturePrefix = 'TestFixture-r8a6h-trainer';

const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

beforeAll(() => {
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.trainerAssignment.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainerAssignment');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.trainer.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    return undefined;
  }, 'trainer');
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horse');
  cleanup.add(() => {
    if (createdUserIds.length) {
      return prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    return undefined;
  }, 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('GET /api/v1/trainers/assignments — fee and personality (Equoria-r8a6h)', () => {
  it('returns the assigned trainer sessionRate and personality with each assignment', async () => {
    const tag = randomBytes(4).toString('hex');
    const user = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-${tag}`,
        email: `${fixturePrefix}-${tag}@example.com`,
        password: await bcrypt.hash('TestPassword123!', 1),
        firstName: 'Fee',
        lastName: 'List',
      },
    });
    createdUserIds.push(user.id);
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: '1h',
    });
    const trainer = await prisma.trainer.create({
      data: {
        userId: user.id,
        firstName: 'Fee',
        lastName: `Trainer${randomBytes(3).toString('hex')}`,
        personality: 'patient',
        skillLevel: 'expert',
        speciality: 'Dressage',
        sessionRate: 275,
      },
    });
    const horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${randomBytes(3).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01T00:00:00.000Z'),
        userId: user.id,
      },
      createdHorseIds,
    );
    await prisma.trainerAssignment.create({
      data: { trainerId: trainer.id, horseId: horse.id, userId: user.id, isActive: true },
    });

    const res = await request(app)
      .get('/api/v1/trainers/assignments')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.data.find(a => a.horseId === horse.id);
    expect(row).toBeDefined();
    expect(row.trainerSessionRate).toBe(275);
    expect(row.trainerPersonality).toBe('patient');
  });
});
