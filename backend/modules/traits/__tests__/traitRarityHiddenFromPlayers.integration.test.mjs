/**
 * Players never see how rare a trait is (owner ruling 2026-10-27, q112;
 * Equoria-2d55z), and they see the authored trait name (owner ruling
 * 2026-10-23).
 *
 * GET /traits/horse/:id sends each roster trait's label, type, description and
 * category, never its rarity. (GET /traits/definitions and the trait card were
 * removed with the trait reports, owner ruling 2026-10-28, q152; Equoria-a7f1p.)
 * Real routes, real app, real test database.
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

  // Equoria-qw4kp: the breeding summary and the legacy score read trait history.
  // They sent a rare count and rare-trait points to the owner. Polarity now
  // comes from the roster (q135).
  describe('trait history views', () => {
    let historyHorse;

    beforeAll(async () => {
      historyHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `HistoryFoal ${tag()}`,
          sex: 'colt',
          dateOfBirth: gameCalendarDate(new Date(), -3),
          breed: { connect: { id: breed.id } },
          user: { connect: { id: owner.id } },
          epigeneticModifiers: { positive: ['heart', 'brave'], negative: ['skittish'], hidden: [] },
        },
      });
      // heart is ruled Legendary (q134); skittish is ruled negative (q135).
      await prisma.traitHistoryLog.createMany({
        data: ['heart', 'skittish', 'brave'].map((traitName, i) => ({
          horseId: historyHorse.id,
          traitName,
          sourceType: 'groom',
          ageInDays: 2 + i,
          bondScore: 50,
        })),
      });
    });

    // Owner ruling 2026-10-28 (q150): the rare-trait score is hidden from players.
    it('the legacy score sends no rare-trait points', async () => {
      const res = await get(`/api/v1/horses/${historyHorse.id}/legacy-score`);
      expect(res.status).toBe(200);
      const { traitScore } = res.body.data.legacyScore.components;
      expect(traitScore.breakdown).not.toHaveProperty('rareTraits');
      expect(JSON.stringify(res.body)).not.toMatch(/isRare|rareTraits|rarity/i);
    });

    it('the breeding summary sends no rare-trait count', async () => {
      const res = await get(`/api/v1/horses/${historyHorse.id}/breeding-data`);
      expect(res.status).toBe(200);
      const { traitSummary } = res.body.data.breedingData;
      expect(traitSummary.totalTraits).toBe(3);
      expect(traitSummary).not.toHaveProperty('rareTraits');
      expect(traitSummary.negativeTraits).toBe(1);
      expect(JSON.stringify(res.body)).not.toMatch(/isRare|rareTraits|rarity/i);
    });
  });
});
