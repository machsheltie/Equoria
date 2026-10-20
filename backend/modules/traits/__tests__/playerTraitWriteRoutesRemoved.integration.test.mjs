/**
 * Players have zero HTTP paths that write traits, flags or trait history
 * (Equoria-gu8jk; owner ruling 2026-10-20).
 *
 * OWNER RULING: players must NEVER be able to write traits for themselves, by
 * any path. Only scheduled game jobs and game-internal birth/care code may
 * write Horse.epigeneticModifiers / epigeneticFlags / temporaryEpigeneticFlags /
 * ultraRareTraits / temperament / personality, TraitHistoryLog,
 * MilestoneTraitLog, UltraRareTraitEvent, Groom.bonusTraitMap /
 * rareTraitPerks and GroomAssignmentLog.traitsShaped.
 *
 * Every route below used to let the owner of a horse (or groom) write one of
 * those stores on demand:
 *   - POST /epigenetic-traits/log-trait          → any TraitHistoryLog row
 *   - POST /flags/evaluate                       → Horse.epigeneticFlags
 *   - POST /traits/discover/:id                  → epigeneticModifiers (reveal)
 *   - POST /traits/batch-discover                → epigeneticModifiers (reveal)
 *   - POST /trait-discovery/discover/batch       → epigeneticModifiers (reveal)
 *   - POST /trait-discovery/discover/:id         → epigeneticModifiers (reveal)
 *   - POST /trait-discovery/batch-discover       → epigeneticModifiers (reveal)
 *   - POST /foals/:id/reveal-traits              → epigeneticModifiers (reveal)
 *   - POST /ultra-rare-traits/evaluate/:id       → UltraRareTraitEvent rows
 *   - POST /ultra-rare-traits/groom/:id/assign-perks → Groom.rareTraitPerks
 *   - POST /personality-evolution/horse/:id/evolve   → Horse.temperament
 *   - POST /personality-evolution/batch-evolve       → Horse.temperament
 *   - POST /milestones/evaluate-milestone            → MilestoneTraitLog and
 *     UltraRareTraitEvent rows, scored from a body-supplied bondScore/taskLog
 * They are gone: an authenticated owner with a valid CSRF pair gets the app's
 * JSON "Route not found" 404, and the stores are untouched. On the old code
 * each request reached its handler (200/201/4xx with a handler body), so the
 * `Route not found` assertion fails there.
 *
 * GET /breeding/lineage-analysis stays (it is a read), but it no longer writes
 * a `_lineage_analysis` UltraRareTraitEvent row for the caller's horses.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures are uniquely named
 * and removed by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const ORIGIN = 'http://localhost:3000';

describe('Player trait-write routes are removed (Equoria-gu8jk)', () => {
  let player;
  let token;
  let csrf;
  let foal;
  let sire;
  let groom;
  const horseIds = [];

  beforeAll(async () => {
    const suffix = randomBytes(6).toString('hex');
    player = await prisma.user.create({
      data: {
        email: `gu8jk-${suffix}@test.invalid`,
        username: `gu8jk${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'NoWrite',
        lastName: 'Player',
        emailVerified: true,
      },
    });
    token = generateTestToken({ id: player.id, email: player.email, role: 'user' });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });

    // A newborn foal whose reveal conditions are all met (bond 95, stress 0)
    // and who carries hidden traits, so the old reveal routes would really
    // have moved them into the visible lists.
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-gu8jk-foal-${suffix}`,
        userId: player.id,
        sex: 'Filly',
        age: 0,
        dateOfBirth: new Date(),
        bondScore: 95,
        stressLevel: 0,
        temperament: 'nervous',
        epigeneticModifiers: { positive: [], negative: [], hidden: ['resilient', 'calm'] },
      },
    });
    sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-gu8jk-sire-${suffix}`,
        userId: player.id,
        sex: 'Stallion',
        age: 8,
        dateOfBirth: new Date('2018-01-01'),
      },
    });
    horseIds.push(foal.id, sire.id);

    groom = await prisma.groom.create({
      data: {
        name: `TestFixture-gu8jk-groom-${suffix}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: player.id,
        experience: 500,
        level: 10,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.ultraRareTraitEvent.deleteMany({ where: { horseId: { in: horseIds } } });
    if (groom) {
      await prisma.groom.deleteMany({ where: { id: groom.id } });
    }
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    if (player) {
      await prisma.refreshToken.deleteMany({ where: { userId: player.id } });
      await prisma.user.deleteMany({ where: { id: player.id } });
    }
  }, 60000);

  /** Everything a removed route could have written, for the fixture horse + groom. */
  async function snapshot() {
    const horse = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: {
        epigeneticModifiers: true,
        epigeneticFlags: true,
        temporaryEpigeneticFlags: true,
        ultraRareTraits: true,
        temperament: true,
        personality: true,
      },
    });
    const g = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { bonusTraitMap: true, rareTraitPerks: true },
    });
    return {
      horse,
      groom: g,
      traitHistory: await prisma.traitHistoryLog.count({ where: { horseId: { in: horseIds } } }),
      milestoneLogs: await prisma.milestoneTraitLog.count({ where: { horseId: { in: horseIds } } }),
      ultraRareEvents: await prisma.ultraRareTraitEvent.count({
        where: { horseId: { in: horseIds } },
      }),
    };
  }

  function post(path, body = {}) {
    return request(app)
      .post(path)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  }

  const REMOVED = [
    [
      'POST /epigenetic-traits/log-trait',
      () => '/api/v1/epigenetic-traits/log-trait',
      () => ({ horseId: foal.id, traitName: 'legendaryBloodline', sourceType: 'genetic' }),
    ],
    ['POST /flags/evaluate', () => '/api/v1/flags/evaluate', () => ({ horseId: foal.id })],
    ['POST /traits/discover/:id', () => `/api/v1/traits/discover/${foal.id}`, () => ({})],
    ['POST /traits/batch-discover', () => '/api/v1/traits/batch-discover', () => ({ horseIds: [foal.id] })],
    [
      'POST /trait-discovery/discover/batch',
      () => '/api/v1/trait-discovery/discover/batch',
      () => ({ horseIds: [foal.id] }),
    ],
    ['POST /trait-discovery/discover/:id', () => `/api/v1/trait-discovery/discover/${foal.id}`, () => ({})],
    [
      'POST /trait-discovery/batch-discover',
      () => '/api/v1/trait-discovery/batch-discover',
      () => ({ horseIds: [foal.id] }),
    ],
    ['POST /foals/:id/reveal-traits', () => `/api/v1/foals/${foal.id}/reveal-traits`, () => ({})],
    ['POST /ultra-rare-traits/evaluate/:id', () => `/api/v1/ultra-rare-traits/evaluate/${foal.id}`, () => ({})],
    [
      'POST /ultra-rare-traits/groom/:id/assign-perks',
      () => `/api/v1/ultra-rare-traits/groom/${groom.id}/assign-perks`,
      () => ({}),
    ],
    [
      'POST /personality-evolution/horse/:id/evolve',
      () => `/api/v1/personality-evolution/horse/${foal.id}/evolve`,
      () => ({}),
    ],
    [
      'POST /personality-evolution/batch-evolve',
      () => '/api/v1/personality-evolution/batch-evolve',
      () => ({ entities: [{ entityId: foal.id, entityType: 'horse' }] }),
    ],
    [
      'POST /milestones/evaluate-milestone',
      () => '/api/v1/milestones/evaluate-milestone',
      () => ({
        horseId: foal.id,
        milestoneType: 'imprinting',
        bondScore: 100,
        taskLog: [],
        forceReevaluate: true,
      }),
    ],
  ];

  it.each(REMOVED)('%s answers the JSON route-not-found 404 and writes nothing', async (_label, pathOf, bodyOf) => {
    const before = await snapshot();

    const res = await post(pathOf(), bodyOf());

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
    expect(await snapshot()).toEqual(before);
  });

  it('GET /breeding/lineage-analysis still answers but writes no UltraRareTraitEvent row', async () => {
    const before = await prisma.ultraRareTraitEvent.count({
      where: { horseId: { in: horseIds } },
    });

    // The caller owns both horses; the old route recorded a `_lineage_analysis`
    // event for each of them, which also surfaced as the newest "ultra-rare"
    // event on the horse page.
    const res = await request(app)
      .get(`/api/v1/breeding/lineage-analysis/${sire.id}/${foal.id}?generations=1`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await prisma.ultraRareTraitEvent.count({ where: { horseId: { in: horseIds } } })).toBe(before);
  });
});
