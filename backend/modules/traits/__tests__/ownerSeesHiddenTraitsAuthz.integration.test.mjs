/**
 * Only the game owner sees a horse's hidden traits (Equoria-w4bvy).
 * Security gate: file-name token `Authz` (a role gate on response content).
 *
 * Owner rulings: 2026-10-19, hidden traits stay hidden (no effect, inherited
 * hidden stay hidden) and only Stacey may see them, moderators never;
 * 2026-10-23 (Equoria-4tleh), that view is the `traits.hidden.view`
 * capability, held by the owner role alone. Reported 2026-10-29: as the owner
 * she saw no hidden trait boxes, because every response stripped the names for
 * everyone.
 *
 * Every case calls a real route through the real app against the real test
 * database. Each role (owner, admin, moderator, player) owns a foal carrying
 * the same two hidden traits; the owner's responses name them (authored labels
 * beside the ids) and are marked private, no-store so no shared cache holds a
 * copy; the other three roles' responses carry the count only.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { hiddenTraitResponseGuard } from '../../../middleware/hiddenTraitResponseGuard.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const hiddenKeys = ['eagerLearner', 'peopleTrusting'];
const hiddenLabels = ['Eager Learner', 'People Trusting'];
const visibleKey = 'resilient';
const roles = ['owner', 'admin', 'moderator', 'user'];
const othersThanOwner = roles.filter(role => role !== 'owner');

describe('Only the game owner sees hidden traits (Equoria-w4bvy)', () => {
  const tag = randomBytes(4).toString('hex');
  /** role -> { user, token, horse } */
  const actors = {};
  let breed;

  const get = (path, role) => request(app).get(path).set('Authorization', `Bearer ${actors[role].token}`);

  function expectNoHiddenNames(res) {
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    for (const name of [...hiddenKeys, ...hiddenLabels]) {
      expect(body).not.toContain(name);
    }
  }

  function expectPrivateNoStore(res) {
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['cache-control']).not.toMatch(/public/);
  }

  beforeAll(async () => {
    breed = await prisma.breed.create({ data: { name: `OwnerHiddenBreed ${tag}` } });
    for (const role of roles) {
      const { user } = await createTestUser({
        username: `ownerHidden${role}${tag}`,
        email: `ownerHidden${role}${tag}@example.com`,
        role,
      });
      const horse = await prisma.horse.create({
        data: await testHorseData(prisma, {
          ...fixtureColor(),
          name: `OwnerHiddenFoal ${role} ${tag}`,
          sex: 'filly',
          dateOfBirth: gameCalendarDate(new Date(), -3),
          breed: { connect: { id: breed.id } },
          user: { connect: { id: user.id } },
          bondScore: 50,
          epigeneticModifiers: { positive: [visibleKey], negative: [], hidden: hiddenKeys },
        }),
      });
      actors[role] = { user, token: generateTestToken({ id: user.id, role }), horse };
    }
  }, 120000);

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    const userIds = roles.map(role => actors[role]?.user?.id).filter(Boolean);
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds } } }), 'fixture horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'fixture users');
    cleanup.add(() => {
      if (breed) {
        return prisma.breed.deleteMany({ where: { id: breed.id } });
      }
    }, 'fixture breed');
    await cleanup.run();
  });

  describe('GET /horses/:id (the horse page)', () => {
    it('the owner gets the hidden traits by name, labelled, in a private no-store response', async () => {
      const res = await get(`/api/v1/horses/${actors.owner.horse.id}`, 'owner');
      expectPrivateNoStore(res);
      expect(res.body.data.epigeneticModifiers).toEqual({
        positive: [visibleKey],
        negative: [],
        hiddenCount: 2,
        hidden: hiddenKeys,
      });
      expect(res.body.data.traitLabels).toEqual({
        resilient: 'Resilient',
        eagerLearner: 'Eager Learner',
        peopleTrusting: 'People Trusting',
      });
    });

    it.each(othersThanOwner)('%s gets the hidden count only, never a name', async role => {
      const res = await get(`/api/v1/horses/${actors[role].horse.id}`, role);
      expectNoHiddenNames(res);
      expect(res.body.data.epigeneticModifiers).toEqual({
        positive: [visibleKey],
        negative: [],
        hiddenCount: 2,
      });
    });
  });

  describe('GET /horses (the stable list) and GET /horses/:id/overview', () => {
    it.each(othersThanOwner)('%s: neither names a hidden trait', async role => {
      const list = await get('/api/v1/horses', role);
      expectNoHiddenNames(list);
      expect(list.body.data.some(h => h.id === actors[role].horse.id)).toBe(true);
      expectNoHiddenNames(await get(`/api/v1/horses/${actors[role].horse.id}/overview`, role));
    });

    it('the owner: the stable list is private, no-store', async () => {
      expectPrivateNoStore(await get('/api/v1/horses', 'owner'));
    });
  });

  describe('GET /traits/horse/:id (the Genetics tab)', () => {
    it('the owner gets a separate hidden bucket with authored names', async () => {
      const res = await get(`/api/v1/traits/horse/${actors.owner.horse.id}`, 'owner');
      expectPrivateNoStore(res);
      const { traits, summary } = res.body.data;
      expect(traits.positive.map(t => t.name)).toEqual([visibleKey]);
      expect(traits.hiddenCount).toBe(2);
      expect(traits.hidden.map(t => t.name)).toEqual(hiddenKeys);
      expect(traits.hidden.map(t => t.definition.label)).toEqual(hiddenLabels);
      expect(traits.hidden.every(t => t.isNew === false)).toBe(true);
      expect(traits.hidden.every(t => !('rarity' in t.definition))).toBe(true);
      expect(summary).toEqual({ totalTraits: 3, visibleTraits: 1, hiddenTraits: 2 });
    });

    it.each(othersThanOwner)('%s gets no hidden bucket and no name', async role => {
      const res = await get(`/api/v1/traits/horse/${actors[role].horse.id}`, role);
      expectNoHiddenNames(res);
      expect(res.body.data.traits).not.toHaveProperty('hidden');
      expect(res.body.data.traits.hiddenCount).toBe(2);
    });
  });

  describe('GET /foals/:id', () => {
    it('the owner gets the hidden traits by name', async () => {
      const res = await get(`/api/v1/foals/${actors.owner.horse.id}`, 'owner');
      expectPrivateNoStore(res);
      expect(res.body.data.epigeneticModifiers.hidden).toEqual(hiddenKeys);
    });

    it.each(othersThanOwner)('%s gets the count only', async role => {
      const res = await get(`/api/v1/foals/${actors[role].horse.id}`, role);
      expectNoHiddenNames(res);
      expect(res.body.data.epigeneticModifiers.hiddenCount).toBe(2);
    });
  });

  describe("GET /horses/:id/visit (another player's horse)", () => {
    it("the owner visiting a player's horse sees its hidden traits by name", async () => {
      const res = await get(`/api/v1/horses/${actors.user.horse.id}/visit`, 'owner');
      expectPrivateNoStore(res);
      const discovery = res.body.data.traitDiscovery;
      expect(discovery.hiddenCount).toBe(2);
      expect(discovery.hidden.map(t => t.key)).toEqual(hiddenKeys);
      expect(discovery.hidden.map(t => t.label)).toEqual(hiddenLabels);
      expect(discovery.hidden.every(t => !('rarity' in t))).toBe(true);
    });

    it.each(othersThanOwner)("%s visiting the player's horse sees the count only", async role => {
      const res = await get(`/api/v1/horses/${actors.user.horse.id}/visit`, role);
      expectNoHiddenNames(res);
      expect(res.body.data.traitDiscovery).not.toHaveProperty('hidden');
      expect(res.body.data.traitDiscovery.hiddenCount).toBe(2);
      expect(res.headers['cache-control'] ?? '').not.toMatch(/public/);
    });
  });

  // No live route nests whole sire/dam rows today; the real guard is mounted on
  // a minimal app that echoes real database rows nested as a pedigree, with
  // req.user set as authenticateToken would set it.
  describe('response guard on nested sire/dam rows', () => {
    async function echoPedigreeAs(role) {
      const [foal, sire, dam] = await Promise.all(
        ['owner', 'admin', 'moderator'].map(r => prisma.horse.findUnique({ where: { id: actors[r].horse.id } })),
      );
      const echo = express();
      echo.use((req, _res, next) => {
        req.user = { id: actors[role].user.id, role };
        next();
      });
      echo.use(hiddenTraitResponseGuard);
      echo.get('/pedigree', (req, res) => res.json({ data: { ...foal, sire: { ...sire, dam }, dam } }));
      return request(echo).get('/pedigree');
    }

    it('the owner sees hidden traits at every depth', async () => {
      const res = await echoPedigreeAs('owner');
      expectPrivateNoStore(res);
      expect(res.body.data.epigeneticModifiers.hidden).toEqual(hiddenKeys);
      expect(res.body.data.sire.epigeneticModifiers.hidden).toEqual(hiddenKeys);
      expect(res.body.data.sire.dam.epigeneticModifiers.hidden).toEqual(hiddenKeys);
      expect(res.body.data.dam.traitLabels.peopleTrusting).toBe('People Trusting');
    });

    it.each(othersThanOwner)('%s sees no hidden name at any depth', async role => {
      const res = await echoPedigreeAs(role);
      expectNoHiddenNames(res);
      expect(res.body.data.sire.dam.epigeneticModifiers).toEqual({
        positive: [visibleKey],
        negative: [],
        hiddenCount: 2,
      });
      expect(res.headers['cache-control']).toBeUndefined();
    });
  });
});
