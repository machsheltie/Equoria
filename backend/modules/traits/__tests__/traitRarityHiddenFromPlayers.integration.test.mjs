/**
 * Players never see how rare a trait is (owner ruling 2026-10-27, q112;
 * Equoria-2d55z), and they see the authored trait name (owner ruling
 * 2026-10-23).
 *
 * GET /traits/horse/:id and GET /traits/definitions send each roster trait's
 * label, type, description and category, never its rarity, even when asked for
 * it by field selection. Real routes, real app, real test database.
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

describe('trait rarity stays off player routes (q112)', () => {
  const tag = () => randomBytes(4).toString('hex');
  let owner;
  let ownerToken;
  let breed;
  let horse;

  const get = path => request(app).get(path).set('Authorization', `Bearer ${ownerToken}`);

  beforeAll(async () => {
    const a = await createTestUser({ role: 'user' });
    owner = a.user;
    ownerToken = a.token;
    breed = await prisma.breed.create({ data: { name: `LabelBreed ${tag()}_${tag()}` } });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `LabelFoal ${tag()}`,
        sex: 'filly',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        breed: { connect: { id: breed.id } },
        user: { connect: { id: owner.id } },
        // resilient has a stored rarity; peopleTrusting needs its authored label.
        epigeneticModifiers: { positive: ['resilient', 'peopleTrusting'], negative: [], hidden: [] },
      },
    });
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: owner.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'users');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'breed');
    await cleanup.run();
  });

  it("a horse's traits carry the authored label and no rarity", async () => {
    const res = await get(`/api/v1/traits/horse/${horse.id}`);
    expect(res.status).toBe(200);
    const traits = res.body.data.traits.positive;
    expect(traits.map(t => [t.name, t.definition.label])).toEqual([
      ['resilient', 'Resilient'],
      ['peopleTrusting', 'People Trusting'],
    ]);
    for (const trait of traits) {
      expect(trait.definition).not.toHaveProperty('rarity');
    }
    expect(JSON.stringify(res.body)).not.toMatch(/rarity/i);
  });

  it('the definitions list is the roster, without rarity, even when rarity is asked for', async () => {
    const all = await get('/api/v1/traits/definitions');
    expect(all.status).toBe(200);
    expect(all.body.data.count).toBe(20);
    expect(JSON.stringify(all.body)).not.toMatch(/rarity/i);

    const picked = await get('/api/v1/traits/definitions?fields=name,rarity');
    expect(picked.status).toBe(200);
    expect(JSON.stringify(picked.body)).not.toMatch(/rarity/i);
  });
});
