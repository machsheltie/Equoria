/**
 * Breeding predictions for a mare and another player's stud stallion, with
 * unrevealed hidden traits withheld (Equoria-q4uem.9 slice 4; Equoria-3867b).
 *
 * Owner rulings (Stacey): 2026-10-15 S9 — predictions (genetic odds,
 * lineage, lethal-white) are allowed for public AND private stud stallions;
 * 2026-10-16 S-Q6 — inbreeding and compatibility analyses too; S-Q9 — a
 * revealed trait is public forever, to everyone, on stallions and ancestors;
 * an UNREVEALED hidden trait stays hidden (for every horse, the caller's own
 * included).
 *
 * Leak-proof method, per endpoint the breeding page uses:
 *   1. No unrevealed hidden trait NAME appears anywhere in the response JSON
 *      (stallion, mare, a third player's grandsire).
 *   2. Nothing can be INFERRED from them: the response is identical, value
 *      for value, to the response after every hidden list is emptied.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { sharedBreed, makePlayer, makeHorse, sendJson, tag } from './helpers/studBookingFixtures.mjs';
import advancedBreedingGeneticsRoutes from '../routes/advancedBreedingGeneticsRoutes.mjs';
import { queryRateLimiter } from '../../../middleware/rateLimiting.mjs';

const PREFIX = 'TestFixture-q4uem9-predict';
const SECRETS = ['q4uem9StudSecret', 'q4uem9MareSecret', 'q4uem9GrandsireSecret'];

const mods = (revealed, secret) => ({ positive: [revealed], negative: [], hidden: [secret] });

/** Every endpoint the breeding page calls for a pair (frontend/src/lib/api/breedingPrediction.ts). */
const ENDPOINTS = {
  geneticProbability: (token, stallionId, mareId) =>
    sendJson('post', '/api/v1/breeding/genetic-probability', token, {
      stallionId,
      mareId,
      includeLineage: true,
      generations: 3,
    }),
  lineage: (token, stallionId, mareId) =>
    sendJson('get', `/api/v1/breeding/lineage-analysis/${stallionId}/${mareId}?generations=3`, token),
  inbreeding: (token, stallionId, mareId) =>
    sendJson('post', '/api/v1/genetics/inbreeding-analysis', token, { stallionId, mareId }),
  compatibility: (token, stallionId, mareId) =>
    sendJson('post', '/api/v1/genetics/breeding-compatibility', token, { stallionId, mareId }),
  colorPrediction: (token, stallionId, mareId) =>
    sendJson('post', '/api/v1/horses/breeding/color-prediction', token, {
      sireId: stallionId,
      damId: mareId,
    }),
};

/** Drop values that legitimately change between two identical calls. */
function stable(body) {
  return JSON.parse(
    JSON.stringify(body, (key, value) =>
      ['timestamp', 'generatedAt', 'analyzedAt', 'calculatedAt', 'createdAt', 'updatedAt'].includes(key)
        ? undefined
        : value,
    ),
  );
}

describe('stud-pair predictions: access and the unrevealed-trait guard (Equoria-q4uem.9 slice 4)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner;
  let studOwner;
  let thirdPlayer;
  let grandsire;
  let stud;
  let mare;
  const userIds = [];
  const horseIds = [];

  async function player(role) {
    const p = await makePlayer(PREFIX, role, 1000);
    userIds.push(p.user.id);
    return p;
  }

  async function horse(spec) {
    const h = await makeHorse(PREFIX, { breedId: breed.id, ...spec });
    horseIds.push(h.id);
    return h;
  }

  async function clearAllHidden() {
    for (const h of [stud, mare, grandsire]) {
      const row = await prisma.horse.findUnique({ where: { id: h.id }, select: { epigeneticModifiers: true } });
      await prisma.horse.update({
        where: { id: h.id },
        data: { epigeneticModifiers: { ...row.epigeneticModifiers, hidden: [] } },
      });
    }
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    mareOwner = await player('mareOwner');
    studOwner = await player('studOwner');
    thirdPlayer = await player('thirdPlayer');
    grandsire = await horse({
      ownerId: thirdPlayer.user.id,
      sex: 'Stallion',
      epigeneticModifiers: mods('q4uem9GrandsireRevealed', 'q4uem9GrandsireSecret'),
    });
    stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      sireId: grandsire.id,
      studStatus: 'At Public Stud',
      studFee: 10,
      epigeneticModifiers: mods('q4uem9StudRevealed', 'q4uem9StudSecret'),
    });
    mare = await horse({
      ownerId: mareOwner.user.id,
      sex: 'Mare',
      epigeneticModifiers: mods('q4uem9MareRevealed', 'q4uem9MareSecret'),
    });
    const ids = horseIds;
    const users = userIds;
    // Lineage FKs are Restrict: break them before the horses go.
    cleanup.add(
      () => prisma.horse.updateMany({ where: { id: { in: ids } }, data: { sireId: null, damId: null } }),
      'lineage',
    );
    cleanup.add(
      () => prisma.ultraRareTraitEvent.deleteMany({ where: { horseId: { in: ids } } }),
      'ultraRareTraitEvents',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: users } } }), 'users');
  });

  afterEach(async () => {
    await cleanup.run();
  });

  describe('access', () => {
    it.each(Object.keys(ENDPOINTS))(
      '%s: the mare owner gets 200 for a PUBLIC stud stallion she does not own',
      async name => {
        const res = await ENDPOINTS[name](mareOwner.token, stud.id, mare.id);
        expect(res.status).toBe(200);
      },
    );

    it.each(Object.keys(ENDPOINTS))('%s: S9 also allows a PRIVATE stud stallion', async name => {
      await prisma.horse.update({ where: { id: stud.id }, data: { studStatus: 'At Private Stud' } });
      const res = await ENDPOINTS[name](mareOwner.token, stud.id, mare.id);
      expect(res.status).toBe(200);
    });

    it.each(Object.keys(ENDPOINTS))(
      "%s: an unlisted stallion of another player, or someone else's mare, stays 404",
      async name => {
        await prisma.horse.update({ where: { id: stud.id }, data: { studStatus: 'Not at Stud' } });
        const unlisted = await ENDPOINTS[name](mareOwner.token, stud.id, mare.id);
        await prisma.horse.update({ where: { id: stud.id }, data: { studStatus: 'At Public Stud' } });
        const foreignMare = await ENDPOINTS[name](studOwner.token, stud.id, mare.id);
        expect(unlisted.status).toBe(404);
        expect(foreignMare.status).toBe(404);
      },
    );
  });

  it('the other genetics endpoints that read whole horse rows stay owner-only: a stud stallion the caller does not own gets 404', async () => {
    const results = await Promise.all([
      sendJson('post', '/api/v1/breeding/breeding-recommendations', mareOwner.token, {
        stallionId: stud.id,
        mareId: mare.id,
      }),
      sendJson('post', '/api/v1/genetics/population-analysis', mareOwner.token, {
        horseIds: [stud.id, mare.id],
      }),
      sendJson('post', '/api/v1/genetics/optimal-breeding', mareOwner.token, {
        horseIds: [stud.id, mare.id],
      }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(404);
      for (const secret of SECRETS) {
        expect(JSON.stringify(res.body)).not.toContain(secret);
      }
    }
  });

  describe('S-Q9: unrevealed hidden traits never reach the caller, by name or by inference', () => {
    it.each(Object.keys(ENDPOINTS))(
      '%s (stud pair): no unrevealed trait name in the response, and the response equals the one with every hidden list emptied',
      async name => {
        const withHidden = await ENDPOINTS[name](mareOwner.token, stud.id, mare.id);
        expect(withHidden.status).toBe(200);
        const text = JSON.stringify(withHidden.body);
        for (const secret of SECRETS) {
          expect(text).not.toContain(secret);
        }

        await clearAllHidden();
        const withoutHidden = await ENDPOINTS[name](mareOwner.token, stud.id, mare.id);

        expect(stable(withHidden.body)).toEqual(stable(withoutHidden.body));
      },
    );

    it.each(Object.keys(ENDPOINTS))(
      "%s (own pair): the caller's own unrevealed traits are withheld too",
      async name => {
        const ownStallion = await horse({
          ownerId: mareOwner.user.id,
          sex: 'Stallion',
          sireId: grandsire.id,
          epigeneticModifiers: mods('q4uem9StudRevealed', 'q4uem9StudSecret'),
        });

        const withHidden = await ENDPOINTS[name](mareOwner.token, ownStallion.id, mare.id);
        expect(withHidden.status).toBe(200);
        for (const secret of SECRETS) {
          expect(JSON.stringify(withHidden.body)).not.toContain(secret);
        }

        await prisma.horse.update({
          where: { id: ownStallion.id },
          data: { epigeneticModifiers: { positive: ['q4uem9StudRevealed'], negative: [], hidden: [] } },
        });
        await clearAllHidden();
        const withoutHidden = await ENDPOINTS[name](mareOwner.token, ownStallion.id, mare.id);

        expect(stable(withHidden.body)).toEqual(stable(withoutHidden.body));
      },
    );

    it("revealed traits stay visible to everyone (S-Q9): the compatibility forecast names both parents' revealed traits", async () => {
      const res = await ENDPOINTS.compatibility(mareOwner.token, stud.id, mare.id);

      expect(res.status).toBe(200);
      expect(res.body.data.expectedTraits.likelyTraits).toEqual(
        expect.arrayContaining(['q4uem9StudRevealed', 'q4uem9MareRevealed']),
      );
    });
  });

  describe("design §0 default (slice 4b): other players' competition records are withheld; the caller's own are kept", () => {
    const SHOW = {
      grandsire: 'q4uem9-GrandsireShow',
      stud: 'q4uem9-StudShow',
      mare: 'q4uem9-MareShow',
      ownStallion: 'q4uem9-OwnStallionShow',
    };
    let show;

    async function record(horseId, showName, disciplineScore) {
      await prisma.competitionResult.create({
        data: {
          horseId,
          showId: show.id,
          score: 88,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date(Date.now() - 86400000),
          showName,
          prizeWon: 500,
        },
      });
      await prisma.horse.update({ where: { id: horseId }, data: { disciplineScores: { Racing: disciplineScore } } });
    }

    function findNode(node, id) {
      if (!node) {
        return null;
      }
      if (node.id === id) {
        return node;
      }
      return findNode(node.sire, id) ?? findNode(node.dam, id);
    }

    beforeEach(async () => {
      show = await prisma.show.create({
        data: {
          name: `${PREFIX}-show-${tag()}`,
          discipline: 'Racing',
          levelMin: 1,
          levelMax: 20,
          entryFee: 0,
          prize: 1000,
          runDate: new Date(Date.now() - 86400000),
        },
      });
      const showId = show.id;
      cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId } }), 'competitionResults');
      cleanup.add(() => prisma.show.deleteMany({ where: { id: showId } }), 'show');
      await record(grandsire.id, SHOW.grandsire, 71);
      // The stud scores HIGHER than the mare, so a leak shows as a max/average above 73.
      await record(stud.id, SHOW.stud, 90);
      await record(mare.id, SHOW.mare, 73);
    });

    it("lineage-analysis: the stud stallion and the third player's grandsire carry no records; the mare keeps hers; shapes stay arrays/objects", async () => {
      const res = await ENDPOINTS.lineage(mareOwner.token, stud.id, mare.id);

      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(SHOW.stud);
      expect(text).not.toContain(SHOW.grandsire);
      expect(text).toContain(SHOW.mare);

      const root = res.body.data.lineageTree.root;
      const studNode = root.stallion;
      const grandsireNode = findNode(root.stallion, grandsire.id);
      expect(grandsireNode).not.toBeNull();
      for (const node of [studNode, grandsireNode]) {
        expect(node.competitionResults).toEqual([]);
        expect(node.disciplineScores).toEqual({});
      }
      expect(root.mare.competitionResults).toHaveLength(1);
      expect(root.mare.disciplineScores).toEqual({ Racing: 73 });

      for (const generation of res.body.data.lineageTree.generations) {
        for (const h of generation.horses) {
          expect(Array.isArray(h.competitionResults)).toBe(true);
          expect(typeof h.disciplineScores).toBe('object');
          if (h.id !== mare.id) {
            expect(h.competitionResults).toEqual([]);
            expect(h.disciplineScores).toEqual({});
          }
        }
      }
    });

    it("genetic-probability with lineage: no record of the stud or the third player's grandsire in the response", async () => {
      const res = await ENDPOINTS.geneticProbability(mareOwner.token, stud.id, mare.id);

      expect(res.status).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(SHOW.stud);
      expect(text).not.toContain(SHOW.grandsire);
    });

    it('genetic-probability: the stud’s discipline score cannot be derived (potentialScore is the mare’s own 73)', async () => {
      const res = await ENDPOINTS.geneticProbability(mareOwner.token, stud.id, mare.id);

      expect(res.status).toBe(200);
      expect(res.body.data.disciplineProbabilities.Racing).toMatchObject({
        potentialScore: 73,
        inheritanceStrength: 'moderate',
      });
    });

    it('lineage-analysis performanceAnalysis has no stud contribution; the unscored stud reads as an unscored horse always did', async () => {
      const res = await ENDPOINTS.lineage(mareOwner.token, stud.id, mare.id);

      expect(res.status).toBe(200);
      const performance = res.body.data.performanceAnalysis;
      expect(performance.generationalTrends[0].averageDisciplines).toEqual({ Racing: 73 });
      const studPerformer = performance.performanceMetrics.topPerformers.find(p => p.id === stud.id);
      // This analysis receives raw horse rows (no `stats` object -> 50) and
      // "no discipline scores" falls back to 50, as an unscored horse always
      // did; before the fix the withheld `{}` produced 0/0 = NaN -> null.
      expect(studPerformer.performanceScore).toBe(50);
    });

    it('breeding-recommendations (own pair): a scored third-party ancestor’s exact score never appears', async () => {
      const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', sireId: grandsire.id });
      await prisma.horse.update({ where: { id: mare.id }, data: { disciplineScores: null } });
      await prisma.horse.update({ where: { id: grandsire.id }, data: { disciplineScores: { Racing: 67 } } });

      const res = await sendJson('post', '/api/v1/breeding/breeding-recommendations', mareOwner.token, {
        stallionId: ownStallion.id,
        mareId: mare.id,
      });

      expect(res.status).toBe(200);
      // The grandsire is the ONLY scored horse in the lineage: any discipline
      // strength or likely discipline could only have come from its record.
      expect(res.body.data.strengths.filter(x => x.type === 'discipline')).toEqual([]);
      expect(res.body.data.expectedOutcomes.likelyDisciplines).toEqual([]);
    });

    it("the caller's OWN stallion keeps its records (only other players' horses are withheld)", async () => {
      const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', sireId: grandsire.id });
      await record(ownStallion.id, SHOW.ownStallion, 74);

      const res = await ENDPOINTS.lineage(mareOwner.token, ownStallion.id, mare.id);

      expect(res.status).toBe(200);
      const root = res.body.data.lineageTree.root;
      expect(root.stallion.competitionResults).toHaveLength(1);
      expect(root.stallion.disciplineScores).toEqual({ Racing: 74 });
      expect(findNode(root.stallion, grandsire.id).competitionResults).toEqual([]);
    });
  });

  it('review item 5: the pair keeps its roles even when the mare has the lower id (parental contributions are not swapped)', async () => {
    const ownStallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion', speed: 11 });
    await prisma.horse.update({ where: { id: mare.id }, data: { speed: 22 } });
    expect(mare.id).toBeLessThan(ownStallion.id);

    const res = await ENDPOINTS.geneticProbability(mareOwner.token, ownStallion.id, mare.id);

    expect(res.status).toBe(200);
    expect(res.body.data.statProbabilities.speed.parentalContribution).toEqual({ stallion: 11, mare: 22 });
  });

  it('review item 6: the four advanced prediction routes carry queryRateLimiter', () => {
    const paths = [
      '/breeding/genetic-probability',
      '/breeding/lineage-analysis/:stallionId/:mareId',
      '/genetics/inbreeding-analysis',
      '/genetics/breeding-compatibility',
    ];
    for (const path of paths) {
      const layer = advancedBreedingGeneticsRoutes.stack.find(l => l.route?.path === path);
      expect(layer).toBeDefined();
      expect(layer.route.stack.map(s => s.handle)).toContain(queryRateLimiter);
    }
  });

  it.each(Object.keys(ENDPOINTS))(
    'review item 6, %s: two horses of other players answer the same 404 as two missing horses',
    async name => {
      const othersMare = await horse({ ownerId: thirdPlayer.user.id, sex: 'Mare' });
      const others = await ENDPOINTS[name](mareOwner.token, stud.id, othersMare.id);
      const missing = await ENDPOINTS[name](mareOwner.token, 2147483000, 2147483001);

      expect(others.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(others.body).toEqual(missing.body);
    },
  );

  // OLD CONTRACT (Equoria-245bt / q4uem.9 slice 4): a lineage analysis wrote a
  // `_lineage_analysis` UltraRareTraitEvent for the caller's own mare (never the
  // stud stallion). NEW RULING (Equoria-gu8jk, owner 2026-10-20): players never
  // write traits or trait events, so the analysis writes no event row at all.
  it('lineage analysis writes no UltraRareTraitEvent for either horse', async () => {
    const res = await ENDPOINTS.lineage(mareOwner.token, stud.id, mare.id);

    expect(res.status).toBe(200);
    expect(await prisma.ultraRareTraitEvent.count({ where: { horseId: stud.id } })).toBe(0);
    expect(await prisma.ultraRareTraitEvent.count({ where: { horseId: mare.id } })).toBe(0);
  });
});
