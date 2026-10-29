/**
 * GET /api/v1/horses sends what the stable list view renders (Equoria-9spb2).
 *
 * Owner ruling 2026-10-23 (q44): the stable list's Shod and Cooldown columns and
 * the row portrait are real, so the list payload carries lastShod,
 * trainingCooldown and imageUrl. Horse level is not a horse field and is not sent.
 * Real route, real database.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const PREFIX = 'TestFixture-9spb2-list';

describe('horse list: shod date, training cooldown and portrait (Equoria-9spb2)', () => {
  const cleanup = createCleanupTracker();

  afterEach(() => cleanup.run());

  it('sends lastShod, trainingCooldown and imageUrl for each horse, and no level', async () => {
    const suffix = randomBytes(6).toString('hex');
    cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${PREFIX}-${suffix}`,
        email: `${PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'List',
        lastName: 'Care',
        money: 1000,
      },
    });
    const lastShod = new Date('2026-10-20T12:00:00.000Z');
    const trainingCooldown = new Date('2026-10-30T12:00:00.000Z');
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${PREFIX}-mare-${suffix}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 7),
        age: 5,
        userId: user.id,
        lastShod,
        trainingCooldown,
        imageUrl: '/images/portraits/test-portrait.png',
      }),
    });

    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const res = await request(app).get('/api/v1/horses').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.data.find(h => h.id === horse.id);
    expect(row).toBeDefined();
    expect(new Date(row.lastShod).toISOString()).toBe(lastShod.toISOString());
    expect(new Date(row.trainingCooldown).toISOString()).toBe(trainingCooldown.toISOString());
    expect(row.imageUrl).toBe('/images/portraits/test-portrait.png');
    expect(row).not.toHaveProperty('level');
  }, 60000);

  // Equoria-y9kdl (STA-01): the Home and side-panel Needs Care counts read the
  // groomed date; without it in the list every horse counted as never groomed.
  it('sends lastGroomed, so a horse groomed today is not counted as needing grooming', async () => {
    const suffix = randomBytes(6).toString('hex');
    cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${PREFIX}-g-${suffix}`,
        email: `${PREFIX}-g-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'List',
        lastName: 'Groomed',
        money: 1000,
      },
    });
    const lastGroomed = new Date('2026-10-27T15:30:00.000Z');
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${PREFIX}-groomed-${suffix}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 7),
        age: 5,
        userId: user.id,
        lastGroomed,
      }),
    });

    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const res = await request(app).get('/api/v1/horses').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const row = res.body.data.find(h => h.id === horse.id);
    expect(row).toBeDefined();
    expect(new Date(row.lastGroomed).toISOString()).toBe(lastGroomed.toISOString());
  }, 60000);
});
