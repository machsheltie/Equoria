/**
 * A switched-off (dormant) trait is still shown to players (Equoria-nrto5,
 * Equoria-i366a; owner rulings q213 and q174, 2026-10-28).
 *
 * A dormant trait is revealed and inactive. The owner ruled that the horse
 * page shows it, greyed out with its name, beside a "Hidden" chip for each
 * hidden trait: players may know how many traits a horse carries, never the
 * name of one still hidden.
 *
 * Real route through the real app, as the horse's owner, on the real test
 * database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const hiddenKeys = ['heart', 'competitive'];

describe('GET /traits/horse/:id shows dormant traits (q213)', () => {
  let user;
  let token;
  let breed;
  let horse;

  const tag = () => randomBytes(4).toString('hex');

  beforeAll(async () => {
    const auth = await createTestUser({ role: 'user' });
    user = auth.user;
    token = auth.token;
    breed = await prisma.breed.create({ data: { name: `DormantTraitBreed ${tag()}_${tag()}` } });
    horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `DormantTraitFoal ${tag()}`,
        sex: 'filly',
        dateOfBirth: gameCalendarDate(new Date(), -10),
        breed: { connect: { id: breed.id } },
        user: { connect: { id: user.id } },
        bondScore: 40,
        epigeneticModifiers: {
          positive: ['resilient'],
          negative: [],
          hidden: hiddenKeys,
          dormant: ['fearful'],
        },
      }),
    });
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(() => (horse ? prisma.horse.deleteMany({ where: { id: horse.id } }) : null), 'horse');
    cleanup.add(() => (user ? prisma.user.deleteMany({ where: { id: user.id } }) : null), 'user');
    cleanup.add(() => (breed ? prisma.breed.deleteMany({ where: { id: breed.id } }) : null), 'breed');
    await cleanup.run();
  });

  it('names the dormant trait with its authored label, counts the hidden ones, names none of them', async () => {
    const res = await request(app).get(`/api/v1/traits/horse/${horse.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { traits, summary } = res.body.data;
    expect(traits.dormant.map(t => t.name)).toEqual(['fearful']);
    expect(traits.dormant[0].definition.label).toBe('Fearful');
    expect(traits.dormant[0].definition).not.toHaveProperty('rarity');
    expect(traits.positive.map(t => t.name)).toEqual(['resilient']);
    expect(traits.hiddenCount).toBe(2);
    // Every carried trait is counted: one active, one dormant, two hidden.
    expect(summary.totalTraits).toBe(4);
    const body = JSON.stringify(res.body);
    for (const key of hiddenKeys) {
      expect(body).not.toContain(key);
    }
  });
});
