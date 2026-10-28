/**
 * Every shown trait id travels with its authored name (Equoria-no441).
 *
 * Owner rulings 2026-10-28 q164/q165: the data a player receives carries names,
 * not stored codes. Horse rows sent `epigeneticModifiers.positive/negative` as
 * stored ids (eagerLearner, peopleTrusting) and the marketplace search sent the
 * same ids in revealedTraits, so the screens had to guess words from the id.
 * The ids stay (they are keys), and beside them:
 *   - every object carrying `epigeneticModifiers` gains `traitLabels`
 *     ({ id: authored name } for each shown trait), added by the response
 *     guard, so a hidden trait is never named there either;
 *   - each marketplace search row carries `traitLabels` for its revealed traits.
 *
 * Real app, real DB, the horse's owner calling.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { withPublicTraitModifiers } from '../../../utils/publicTraitView.mjs';

const fixturePrefix = 'TestFixture-no441-traits';
const shown = { positive: ['eagerLearner', 'peopleTrusting'], negative: ['skittish'] };
const stillHidden = 'heart';

describe('trait ids travel with their authored names', () => {
  const cleanup = createCleanupTracker();
  const run = randomBytes(6).toString('hex');
  let user;
  let token;
  let viewer;
  let breed;
  let horse;

  beforeAll(async () => {
    cleanup.add(() => (horse ? prisma.horse.deleteMany({ where: { id: horse.id } }) : null), 'horse');
    cleanup.add(() => (breed ? prisma.breed.deleteMany({ where: { id: breed.id } }) : null), 'breed');
    cleanup.add(() => (user ? prisma.user.deleteMany({ where: { id: user.id } }) : null), 'user');
    cleanup.add(() => (viewer ? prisma.user.deleteMany({ where: { id: viewer.id } }) : null), 'viewer');
    user = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-${run}`.slice(0, 30),
        email: `${fixturePrefix}-${run}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Trait',
        lastName: 'Words',
        money: 1000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    // The search lists other players' horses, so another player looks.
    viewer = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-v-${run}`.slice(0, 30),
        email: `${fixturePrefix}-v-${run}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Trait',
        lastName: 'Viewer',
        money: 1000,
      },
    });
    breed = await prisma.breed.create({ data: { name: `${fixturePrefix}-breed-${run}` } });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-${run}`,
        sex: 'Mare',
        dateOfBirth: birthDateForAge(6),
        age: 6,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(),
        forSale: true,
        salePrice: 900,
        epigeneticModifiers: { ...shown, hidden: [stillHidden] },
      },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  const expectedLabels = {
    eagerLearner: 'Eager Learner',
    peopleTrusting: 'People Trusting',
    skittish: 'Skittish',
  };

  it('GET /horses/:id names each shown trait beside its id, and no hidden one', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.epigeneticModifiers.positive).toEqual(shown.positive);
    expect(res.body.data.traitLabels).toEqual(expectedLabels);
    expect(JSON.stringify(res.body)).not.toContain(stillHidden);
  });

  it('a marketplace search row names each revealed trait', async () => {
    const res = await request(app)
      .get(`/api/v1/marketplace/search?name=${run}&forSale=true&limit=10`)
      .set('Authorization', `Bearer ${generateTestToken({ id: viewer.id, email: viewer.email, role: 'user' })}`);
    expect(res.status).toBe(200);
    const row = res.body.data.horses.find(h => h.id === horse.id);
    expect(row.revealedTraits).toEqual(shown);
    expect(row.traitLabels).toEqual(expectedLabels);
  });

  it('an id off the roster reads as words, never the id', () => {
    const out = withPublicTraitModifiers({
      sire: { epigeneticModifiers: { positive: ['retiredOldTraitId'], negative: [], hidden: ['brave'] } },
    });
    expect(out.sire.traitLabels).toEqual({ retiredOldTraitId: 'Unlisted Trait' });
  });
});
