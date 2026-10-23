/**
 * GET /horses/:id/epigenetic-insights reads each thing once (Equoria-glgyw).
 *
 * The defect: the handler read the horse six times (ownership check, a horse +
 * trait-history load whose logs it never used, then once inside each of the four
 * analyses) and the groom interactions twice (environmental report, milestones).
 * The contract now: one horse read (the ownership middleware's row, threaded
 * down) and one groom-interaction read, whatever the analyses are.
 *
 * Mechanism (no Prisma mock, no spy), as in traitInteractionSnapshotReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before it
 * loads, pointed at a REAL PrismaClient with Prisma's query-event logging.
 *
 * The response itself must not change: each section is compared with what the
 * standalone service function returns for the same horse (timestamps aside).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

let observedClient = null;
const appClientHandle = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!observedClient) {
        return prop === '$disconnect' ? async () => {} : undefined;
      }
      const value = Reflect.get(observedClient, prop);
      return typeof value === 'function' ? value.bind(observedClient) : value;
    },
  },
);
globalThis.__prisma = appClientHandle;

const { default: prisma, PrismaClient } = await import('../../../../packages/database/prismaClient.mjs');
const { buildDatabaseUrl } = await import('../../../../packages/database/dbPoolConfig.mjs');

observedClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});
const { createQueryEventRecorder } = await import('../../../__tests__/helpers/queryEventRecorder.mjs');
const recorder = createQueryEventRecorder(observedClient);

const { default: app } = await import('../../../app.mjs');
const { generateInteractionMatrix } = await import('../services/traitInteractionMatrix.mjs');
const { generateEnvironmentalReport } = await import('../services/environmentalTriggerSystem.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');
const { createCleanupTracker } = await import('../../../__tests__/helpers/failLoudCleanup.mjs');

const selectsOn = (statements, table) =>
  statements.filter(sql => /^SELECT\b/i.test(sql) && sql.includes(`FROM "public"."${table}"`));

/** A response section as plain JSON with every *Timestamp field (analysis, report) removed. */
function withoutTimestamps(value) {
  return JSON.parse(JSON.stringify(value), (key, inner) => (/Timestamp$/.test(key) ? undefined : inner));
}

describe('epigenetic-insights reads one horse and one interaction history (Equoria-glgyw)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let horse;
  let authToken;

  beforeAll(async () => {
    expect(prisma).toBe(appClientHandle);
    const suffix = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        username: `glgyw${suffix}`,
        email: `glgyw-${suffix}@test.com`,
        password: 'irrelevant-hash',
        firstName: 'Glgyw',
        lastName: 'Reads',
        money: 1000,
      },
    });
    // Cleanup runs in registration order: children first, the user last.
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Glgyw-${suffix}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -40),
        age: 0,
        userId: user.id,
        stressLevel: 8,
        bondScore: 10,
        epigeneticFlags: ['brave', 'confident', 'social', 'fearful', 'reactive', 'calm'],
      },
    });
    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-Glgyw-Groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: user.id,
      },
    });
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: horse.id } }), 'interactions');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    for (const [interactionType, quality] of [
      ['brushing', 'excellent'],
      ['bonding', 'good'],
      ['desensitizing', 'good'],
    ]) {
      await prisma.groomInteraction.create({
        data: { interactionType, duration: 20, quality, foalId: horse.id, groomId: groom.id },
      });
    }
    authToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  const get = () =>
    request(app)
      .get(`/api/v1/horses/${horse.id}/epigenetic-insights`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`);

  it('performs one horse query and one groom-interaction query in total, ownership check included', async () => {
    const { result, statements } = await recorder.measure(get);
    expect(result.status).toBe(200);
    expect(selectsOn(statements, 'horses')).toHaveLength(1);
    expect(selectsOn(statements, 'groom_interactions')).toHaveLength(1);
  }, 60000);

  it('answers with what each standalone analysis returns for the same horse', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    const data = response.body.data;
    const [traitAnalysis, environmentalInfluences] = await Promise.all([
      generateInteractionMatrix(horse.id),
      generateEnvironmentalReport(horse.id),
    ]);

    expect(data.horseId).toBe(horse.id);
    expect(withoutTimestamps(data.traitAnalysis)).toEqual(withoutTimestamps(traitAnalysis));
    expect(withoutTimestamps(data.environmentalInfluences)).toEqual(withoutTimestamps(environmentalInfluences));
    expect(data.environmentalInfluences.environmentalTriggers.interactionCount).toBeGreaterThan(0);
    // Owner ruling 2026-10-07 (Equoria-5ovgv): no advice, no forecast, no milestone countdown.
    // Old contract: developmentalProgress, predictiveInsights and recommendations were returned.
    expect(Object.keys(data).sort()).toEqual(['environmentalInfluences', 'horseId', 'traitAnalysis']);
  }, 60000);
});
