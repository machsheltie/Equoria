/**
 * Trait interaction analysis reads the horse once per request (Equoria-q4uem.5).
 *
 * Mechanism (no Prisma mock, no spy): before the app or the shared client
 * module loads, this file builds a REAL PrismaClient — the same @prisma/client
 * copy and the same database URL builder prismaClient.mjs uses — with Prisma's
 * own query-event logging enabled, and installs it as `globalThis.__prisma`.
 * prismaClient.mjs reuses an existing `globalThis.__prisma` outside production,
 * so the real app (auth, ownership middleware, routes, services) runs every
 * statement through this client against the real test database, and the
 * engine reports each SQL statement it sends. Jest gives each test file its
 * own global, so no other suite sees this client.
 *
 * The client omits the horse-sex write extension; this file writes only
 * canonical sex values, and every request under test is read-only.
 *
 * A "horse-state read" is a SELECT on "horses" that loads epigeneticFlags and
 * is not the ownership middleware's id+userId lookup (which runs before the
 * handler and is not part of the analysis).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const { PrismaClient } = await import('../../../../packages/database/node_modules/@prisma/client/default.js');
const { buildDatabaseUrl } = await import('../../../../packages/database/dbPoolConfig.mjs');

const statements = [];
const observedClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});
observedClient.$on('query', event => statements.push(event.query));
globalThis.__prisma = observedClient;

const { default: prisma } = await import('../../../../packages/database/prismaClient.mjs');
const { default: app } = await import('../../../app.mjs');
const { generateInteractionMatrix } = await import('../services/traitInteractionMatrix.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');
const { createCleanupTracker } = await import('../../../__tests__/helpers/failLoudCleanup.mjs');

function horseStateReads() {
  return statements.filter(
    sql =>
      /^SELECT\b/i.test(sql) &&
      sql.includes('FROM "public"."horses"') &&
      sql.includes('"epigeneticFlags"') &&
      !sql.includes('"horses"."userId" ='),
  );
}

async function measure(fn) {
  statements.length = 0;
  const result = await fn();
  return { result, reads: horseStateReads() };
}

describe('trait interaction analysis reads one horse snapshot (Equoria-q4uem.5)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let horse;
  let authToken;

  beforeAll(async () => {
    expect(prisma).toBe(observedClient);
    const suffix = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        username: `ws5reads${suffix}`,
        email: `ws5reads-${suffix}@test.com`,
        password: 'irrelevant-hash',
        firstName: 'WS5',
        lastName: 'Reads',
        money: 1000,
      },
    });
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WS5Reads-${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        age: 0,
        userId: user.id,
        stressLevel: 8,
        bondScore: 10,
        epigeneticFlags: ['brave', 'confident', 'social', 'fearful', 'reactive', 'calm'],
      },
    });
    authToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  const get = path =>
    request(app).get(path).set('Origin', 'http://localhost:3000').set('Authorization', `Bearer ${authToken}`);

  it('the counter observes the app: a request emits SQL through the observed client', async () => {
    const { result } = await measure(() => get(`/api/v1/horses/${horse.id}/trait-stability`));
    expect(result.status).toBe(200);
    expect(statements.some(sql => sql.includes('FROM "public"."horses"'))).toBe(true);
  });

  it('generateInteractionMatrix performs exactly one horse-state read', async () => {
    const { reads } = await measure(() => generateInteractionMatrix(horse.id));
    expect(reads).toHaveLength(1);
  });

  it.each(['trait-interactions', 'trait-matrix', 'trait-stability'])(
    'GET /api/v1/horses/:id/%s performs exactly one horse-state read',
    async route => {
      const { result, reads } = await measure(() => get(`/api/v1/horses/${horse.id}/${route}`));
      expect(result.status).toBe(200);
      expect(reads).toHaveLength(1);
    },
  );

  it('every section of a trait-matrix response carries the same analysis timestamp', async () => {
    const response = await get(`/api/v1/horses/${horse.id}/trait-matrix`);
    expect(response.status).toBe(200);
    const matrix = response.body.data;
    const sections = [
      'traitInteractions',
      'synergies',
      'conflicts',
      'dominance',
      'complexInteractions',
      'stability',
      'temporalModel',
    ];
    for (const section of sections) {
      expect({ section, at: matrix[section].analysisTimestamp }).toEqual({
        section,
        at: matrix.analysisTimestamp,
      });
    }
  });

  it('every section of a trait-interactions response carries the same analysis timestamp', async () => {
    const response = await get(`/api/v1/horses/${horse.id}/trait-interactions`);
    expect(response.status).toBe(200);
    const { traitInteractions, synergies, conflicts, dominance } = response.body.data;
    expect(synergies.analysisTimestamp).toBe(traitInteractions.analysisTimestamp);
    expect(conflicts.analysisTimestamp).toBe(traitInteractions.analysisTimestamp);
    expect(dominance.analysisTimestamp).toBe(traitInteractions.analysisTimestamp);
  });
});
