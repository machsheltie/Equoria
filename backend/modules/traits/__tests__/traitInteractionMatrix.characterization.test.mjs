/**
 * Trait interaction analysis — output characterization (Equoria-q4uem.5).
 *
 * WS5 moves trait-interaction analysis onto one immutable horse snapshot. That
 * is a read-path refactor: for the same horse state every analysis field must
 * stay byte-for-byte the same. This suite pins the current outputs for a set of
 * representative horses at both seams callers use:
 *
 *   - service: generateInteractionMatrix(horseId) (also consumed by the
 *     enhanced-reporting routes)
 *   - HTTP: GET /api/v1/horses/:id/trait-interactions, /trait-matrix,
 *     /trait-stability (real app, real auth, real ownership middleware)
 *
 * The snapshots were written against the pre-refactor code and must stay green
 * after it. Only values that legitimately differ per run are normalized: the
 * analysis timestamps (wall clock) and the fixture horse id (database serial).
 * Horse age is deterministic because each fixture's date of birth is a whole
 * number of UTC days before today.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateInteractionMatrix } from '../services/traitInteractionMatrix.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

// Representative trait states: empty, synergistic, conflicting with high
// stress and low bond, many traits with emergent properties at maturity, an
// unknown trait only, and bond/stress-modulated social + negative traits.
const FIXTURES = {
  empty: { flags: [], stressLevel: 0, bondScore: 0, ageDays: 0 },
  synergistic: { flags: ['brave', 'confident', 'social'], stressLevel: 3, bondScore: 35, ageDays: 40 },
  conflictingHighStressLowBond: {
    flags: ['fearful', 'brave', 'reactive', 'calm', 'social', 'antisocial'],
    stressLevel: 9,
    bondScore: 2,
    ageDays: 10,
  },
  matureEmergent: {
    flags: ['confident', 'brave', 'intelligent', 'social', 'curious', 'calm', 'adaptable', 'sensitive'],
    stressLevel: 2,
    bondScore: 40,
    ageDays: 120,
  },
  unknownTraitOnly: { flags: ['developing'], stressLevel: 7, bondScore: 15, ageDays: 60 },
  socialAndNegative: {
    flags: ['social', 'affectionate', 'outgoing', 'trusting', 'fragile', 'reactive', 'aloof'],
    stressLevel: 5,
    bondScore: 5,
    ageDays: 89,
  },
};

/** Replace per-run values so the snapshot pins only analysis content. */
function normalize(value, horseId) {
  if (Array.isArray(value)) {
    return value.map(item => normalize(item, horseId));
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key === 'analysisTimestamp') {
        expect(Number.isNaN(new Date(inner).getTime())).toBe(false);
        out[key] = '<analysisTimestamp>';
      } else if (key === 'horseId') {
        expect(inner).toBe(horseId);
        out[key] = '<horseId>';
      } else {
        out[key] = normalize(inner, horseId);
      }
    }
    return out;
  }
  return value;
}

describe('trait interaction analysis characterization (Equoria-q4uem.5)', () => {
  const cleanup = createCleanupTracker();
  const horseIds = {};
  let user;
  let otherUser;
  let authToken;

  beforeAll(async () => {
    const suffix = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        username: `ws5char${suffix}`,
        email: `ws5char-${suffix}@test.com`,
        password: 'irrelevant-hash',
        firstName: 'WS5',
        lastName: 'Characterization',
        money: 1000,
      },
    });
    otherUser = await prisma.user.create({
      data: {
        username: `ws5charother${suffix}`,
        email: `ws5char-other-${suffix}@test.com`,
        password: 'irrelevant-hash',
        firstName: 'WS5',
        lastName: 'Other',
        money: 1000,
      },
    });
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: [user.id, otherUser.id] } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [user.id, otherUser.id] } } }), 'users');

    authToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    for (const [key, fixture] of Object.entries(FIXTURES)) {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-WS5Char-${key}-${suffix}`,
          sex: 'Filly',
          dateOfBirth: new Date(todayUtc - fixture.ageDays * DAY_MS),
          age: 0,
          userId: user.id,
          stressLevel: fixture.stressLevel,
          bondScore: fixture.bondScore,
          epigeneticFlags: fixture.flags,
        },
      });
      horseIds[key] = horse.id;
    }
    const foreign = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WS5Char-foreign-${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date(todayUtc),
        age: 0,
        userId: otherUser.id,
        epigeneticFlags: ['brave'],
      },
    });
    horseIds.foreign = foreign.id;
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  const get = path =>
    request(app).get(path).set('Origin', 'http://localhost:3000').set('Authorization', `Bearer ${authToken}`);

  describe.each(Object.keys(FIXTURES))('%s horse', key => {
    it('generateInteractionMatrix output is unchanged', async () => {
      const matrix = await generateInteractionMatrix(horseIds[key]);
      expect(normalize(matrix, horseIds[key])).toMatchSnapshot();
    });

    it.each(['trait-interactions', 'trait-matrix', 'trait-stability'])(
      'GET /api/v1/horses/:id/%s wire response is unchanged',
      async route => {
        const response = await get(`/api/v1/horses/${horseIds[key]}/${route}`);
        expect(response.status).toBe(200);
        expect(normalize(response.body, horseIds[key])).toMatchSnapshot();
      },
    );
  });

  it.each(['trait-interactions', 'trait-matrix', 'trait-stability'])(
    'GET /api/v1/horses/:id/%s is 404 for a missing horse and for a horse the user does not own',
    async route => {
      const missing = await get(`/api/v1/horses/2147483000/${route}`);
      const foreign = await get(`/api/v1/horses/${horseIds.foreign}/${route}`);
      expect(missing.status).toBe(404);
      expect(foreign.status).toBe(404);
      expect(foreign.body).toEqual(missing.body);
      expect(missing.body).toMatchSnapshot();
    },
  );
});
