/**
 * Unrevealed hidden trait names never leave the server (Equoria-6dace, the
 * leak half of Equoria-3867b).
 *
 * Owner ruling (Stacey, 2026-10-16): an unrevealed hidden trait stays hidden
 * from everyone, the horse's owner included; once revealed it is public
 * forever. A COUNT of hidden traits may still be sent (HiddenTraitIndicator).
 *
 * Every test calls a real route through the real app, as the horse's OWNER,
 * against the real test database, and asserts the serialised body names none
 * of the horse's still-hidden traits. Each also asserts a 200 so an error
 * response cannot pass by accident.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { hiddenTraitResponseGuard } from '../../../middleware/hiddenTraitResponseGuard.mjs';

// Two hidden names: one with a trait definition, one without (peopleTrusting
// has no definition, so no reveal can ever select it — it stays hidden).
const HIDDEN = ['legendaryBloodline', 'peopleTrusting'];
const VISIBLE = 'resilient';

describe('Hidden trait names never leave the server (Equoria-6dace)', () => {
  let user;
  let token;
  let csrf;
  let breed;
  let foal;

  const tag = () => randomBytes(4).toString('hex');

  async function makeFoal(data = {}) {
    return prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `HiddenTraitFoal ${tag()}`,
        sex: 'filly',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        breed: { connect: { id: breed.id } },
        user: { connect: { id: user.id } },
        bondScore: 50,
        stressLevel: 50,
        epigeneticModifiers: { positive: [VISIBLE], negative: [], hidden: HIDDEN },
        ...data,
      },
    });
  }

  const get = path => request(app).get(path).set('Authorization', `Bearer ${token}`);
  const post = (path, body) =>
    request(app)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);

  function expectNoHiddenNames(res, names = HIDDEN) {
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    for (const name of names) {
      expect(body).not.toContain(name);
    }
  }

  beforeAll(async () => {
    const auth = await createTestUser({ role: 'user' });
    user = auth.user;
    token = auth.token;
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    breed = await prisma.breed.create({ data: { name: `HiddenTraitBreed ${tag()}_${tag()}` } });
    foal = await makeFoal();
    // History rows the nightly job writes: one for the visible trait, one for
    // each still-hidden trait (foalTraitEvaluation logs hidden ones too).
    await prisma.traitHistoryLog.createMany({
      data: [VISIBLE, ...HIDDEN].map((traitName, i) => ({
        horseId: foal.id,
        traitName,
        sourceType: 'milestone',
        ageInDays: i,
        bondScore: 50,
        stressLevel: 50,
      })),
    });
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (user) {
        return prisma.horse.deleteMany({ where: { userId: user.id } });
      }
    }, 'user horses');
    cleanup.add(() => {
      if (user) {
        return prisma.user.deleteMany({ where: { id: user.id } });
      }
    }, 'user');
    cleanup.add(() => {
      if (breed) {
        return prisma.breed.deleteMany({ where: { id: breed.id } });
      }
    }, 'breed');
    await cleanup.run();
  });

  describe('epigeneticModifiers on horse rows', () => {
    it('GET /horses/:id sends the hidden count but no hidden name', async () => {
      const res = await get(`/api/v1/horses/${foal.id}`);
      expectNoHiddenNames(res);
      expect(res.body.data.epigeneticModifiers).toEqual({
        positive: [VISIBLE],
        negative: [],
        hiddenCount: 2,
      });
    });

    // Guard, not a red test: the list reads a column subset without
    // epigeneticModifiers today (listHorses); this pins that it stays so.
    it('GET /horses (the stable list) sends no hidden name', async () => {
      const res = await get('/api/v1/horses');
      expectNoHiddenNames(res);
      expect(res.body.data.some(h => h.id === foal.id)).toBe(true);
    });

    it('GET /foals/:id sends no hidden name', async () => {
      const res = await get(`/api/v1/foals/${foal.id}`);
      expectNoHiddenNames(res);
      expect(res.body.data.epigeneticModifiers.hiddenCount).toBe(2);
    });
  });

  // Fix round 1 (review C1): one loaded row sent more than once in a body
  // (a parent shared by siblings, a row echoed in two places) must be
  // scrubbed at every occurrence. No live route does this today, so the real
  // guard is mounted on a minimal app that echoes a real database row.
  describe('response guard on a repeated row', () => {
    it('a horse row repeated in one body names no hidden trait at any occurrence', async () => {
      const row = await prisma.horse.findUnique({ where: { id: foal.id } });
      const echo = express();
      echo.use(hiddenTraitResponseGuard);
      echo.get('/repeat', (req, res) =>
        res.json({ data: { horse: row, foals: [{ dam: row }, { dam: row }], again: [row] } }),
      );
      const res = await request(echo).get('/repeat');
      expectNoHiddenNames(res);
      expect(res.body.data.foals[1].dam.epigeneticModifiers.hiddenCount).toBe(2);
      expect(res.body.data.again[0].epigeneticModifiers.hiddenCount).toBe(2);
    });
  });

  describe('trait endpoints', () => {
    it('GET /traits/horse/:id keeps the hidden count and names no hidden trait', async () => {
      const res = await get(`/api/v1/traits/horse/${foal.id}`);
      expectNoHiddenNames(res);
      expect(res.body.data.summary.hiddenTraits).toBe(2);
      expect(res.body.data.traits.positive.map(t => t.name)).toEqual([VISIBLE]);
    });

    it('GET /trait-discovery/progress/:id names no hidden trait', async () => {
      const res = await get(`/api/v1/trait-discovery/progress/${foal.id}`);
      expectNoHiddenNames(res);
      expect(res.body.data.hiddenTraitsCount).toBe(2);
    });

    it('GET /environment/comfort-zone/:id names no hidden trait', async () => {
      const res = await get(`/api/v1/environment/comfort-zone/${foal.id}`);
      expectNoHiddenNames(res);
      expect(res.body.data.traits).toEqual([VISIBLE]);
    });
  });

  // Owner ruling 2026-10-19 (fix round 1): the fixed per-condition trait-name
  // hint lists ("revealableTraits") are not sent. They are not the horse's
  // traits and read as hints about hidden ones.
  describe('discovery responses carry no per-condition trait hint lists', () => {
    it('GET /trait-discovery/progress/:id', async () => {
      const res = await get(`/api/v1/trait-discovery/progress/${foal.id}`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('revealableTraits');
    });

    it('GET /trait-discovery/conditions', async () => {
      const res = await get('/api/v1/trait-discovery/conditions');
      expect(res.status).toBe(200);
      expect(res.body.data.conditions.length).toBeGreaterThan(0);
      expect(JSON.stringify(res.body)).not.toContain('revealableTraits');
    });

    it('POST /trait-discovery/check-conditions/:id', async () => {
      const res = await post(`/api/v1/trait-discovery/check-conditions/${foal.id}`, {});
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('revealableTraits');
    });
  });

  describe('breeding data', () => {
    it('GET /horses/:id/breeding-data names no hidden trait', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/breeding-data`);
      expectNoHiddenNames(res);
      expect(res.body.data.breedingData.epigeneticFlags.hiddenCount).toBe(2);
    });

    // Owner ruling 2026-10-19 (fix round 1): the per-category counts must not
    // come from history rows of traits still hidden on the horse.
    it('GET /horses/:id/breeding-data counts no history row of a still-hidden trait', async () => {
      const horse = await makeFoal({
        epigeneticModifiers: { positive: ['athletic'], negative: [], hidden: ['bold', 'sensitive'] },
      });
      await prisma.traitHistoryLog.createMany({
        data: ['athletic', 'bold', 'sensitive'].map((traitName, i) => ({
          horseId: horse.id,
          traitName,
          sourceType: 'milestone',
          ageInDays: i,
        })),
      });
      const res = await get(`/api/v1/horses/${horse.id}/breeding-data`);
      expect(res.status).toBe(200);
      const { traitSummary, flagInheritanceScore } = res.body.data.breedingData;
      expect(traitSummary.totalTraits).toBe(1);
      expect(traitSummary.rareTraits).toBe(0); // sensitive is rare, and hidden
      expect(traitSummary.traitsByCategory).toMatchObject({ physical: 1, boldness: 0, empathy: 0 });
      expect(flagInheritanceScore.flags).toMatchObject({ physical: 1, boldness: 0, empathy: 0 });
      expect(flagInheritanceScore.dominantCategories).toEqual(['physical']);
    });

    it('POST /genetics/population-analysis names no hidden trait', async () => {
      const res = await post('/api/v1/genetics/population-analysis', { horseIds: [foal.id] });
      expectNoHiddenNames(res);
    });

    it('GET /genetics/diversity-report/:userId names no hidden trait', async () => {
      const res = await get(`/api/v1/genetics/diversity-report/${user.id}`);
      expectNoHiddenNames(res);
    });
  });

  describe('trait history (TraitHistoryLog rows naming a still-hidden trait)', () => {
    it('GET /horses/:id/trait-timeline shows the visible trait, not the hidden ones', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/trait-timeline`);
      expectNoHiddenNames(res);
      expect(res.body.data.timeline.map(e => e.event)).toContain(`Discovered trait: ${VISIBLE}`);
    });

    it('GET /horses/:id/trait-card names no hidden trait', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/trait-card`);
      expectNoHiddenNames(res);
    });

    it('GET /horses/:id/legacy-score names no hidden trait', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/legacy-score`);
      expectNoHiddenNames(res);
    });

    it('GET /epigenetic-traits/history/:id names no hidden trait', async () => {
      const res = await get(`/api/v1/epigenetic-traits/history/${foal.id}`);
      expectNoHiddenNames(res);
    });

    it('GET /horses/:id/enhanced-trait-history names no hidden trait', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/enhanced-trait-history`);
      expectNoHiddenNames(res);
    });

    it('GET /horses/:id/epigenetic-report-export names no hidden trait', async () => {
      const res = await get(`/api/v1/horses/${foal.id}/epigenetic-report-export?reportType=detailed`);
      expectNoHiddenNames(res);
    });

    it('GET /users/:id/stable-epigenetic-report names no hidden trait', async () => {
      const res = await get(`/api/v1/users/${user.id}/stable-epigenetic-report`);
      expectNoHiddenNames(res);
    });
  });

  describe('reveal: only the traits just revealed may be named', () => {
    // bond 85 / stress 15 meets the bond and stress discovery conditions;
    // bold (common) is the only hidden trait any condition can select, so a
    // reveal moves bold and leaves peopleTrusting hidden.
    const revealable = { bondScore: 85, stressLevel: 15 };
    const hiddenPair = { positive: [], negative: [], hidden: ['bold', 'peopleTrusting'] };

    it('POST /foals/:id/reveal-traits names the revealed trait, never the still-hidden one', async () => {
      const horse = await makeFoal({ ...revealable, epigeneticModifiers: hiddenPair });
      const res = await post(`/api/v1/foals/${horse.id}/reveal-traits`, {});
      expectNoHiddenNames(res, ['peopleTrusting']);
      expect(res.body.data.traits).toEqual(['bold']);
      expect(res.body.data.hiddenCount).toBe(1);
    });

    it('POST /traits/batch-discover names no still-hidden trait', async () => {
      const horse = await makeFoal({ ...revealable, epigeneticModifiers: hiddenPair });
      const res = await post('/api/v1/traits/batch-discover', { horseIds: [horse.id] });
      expectNoHiddenNames(res, ['peopleTrusting']);
      expect(res.body.data.summary.totalRevealed).toBe(1);
    });

    it('POST /trait-discovery/discover/batch names no still-hidden trait', async () => {
      const horse = await makeFoal({ ...revealable, epigeneticModifiers: hiddenPair });
      const res = await post('/api/v1/trait-discovery/discover/batch', { horseIds: [horse.id] });
      expectNoHiddenNames(res, ['peopleTrusting']);
      expect(res.body.data.summary.totalTraitsRevealed).toBe(1);
    });
  });
});
