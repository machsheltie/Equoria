/**
 * flagDefinitionsRosterParity.integration.test.mjs (Equoria-oey96.33)
 *
 * SENTINEL (real DB + real Express, no mocks): the TWO public flag-definition
 * endpoints must agree on the SAME canonical 9-flag roster.
 *
 *   GET /api/v1/flags/definitions              -> canonical (epigeneticFlagDefinitions.mjs)
 *   GET /api/v1/epigenetic-traits/definitions  -> was STALE (utils/epigeneticFlags.mjs)
 *
 * PRE-FIX (RED): the epigenetic-traits endpoint served antisocial/social/sensitive
 * (which the live flag engine does not have) instead of aloof/skittish/fragile, so
 * the two endpoints' flag-name sets DIFFERED — a public API contradiction about
 * which epigenetic flags exist.
 *
 * POST-FIX (GREEN): both endpoints serve the canonical roster; the flag-name sets
 * are equal and equal to the canonical 9.
 *
 * Both endpoints live on authRouter (authenticateToken), so both need a bearer.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { EPIGENETIC_FLAG_DEFINITIONS } from '../../../config/epigeneticFlagDefinitions.mjs';

const ORIGIN = 'http://localhost:3000';

// The single source of truth: the canonical roster's flag names.
const CANONICAL_NAMES = Object.values(EPIGENETIC_FLAG_DEFINITIONS)
  .map(f => f.name)
  .sort();

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `oey9633-${randomBytes(4).toString('hex')}@test.com`,
      username: `oey9633${randomBytes(5).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Oey9633',
      lastName: 'RosterParity',
      money: 1000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
}, 30000);

describe('Equoria-oey96.33: both flag-definition endpoints serve the SAME canonical roster', () => {
  it('exposes exactly the canonical 9 (no stale antisocial/social/sensitive)', () => {
    // Guards the source of truth itself: the canonical roster must not drift.
    expect(CANONICAL_NAMES).toEqual(
      ['affectionate', 'aloof', 'brave', 'confident', 'fearful', 'fragile', 'insecure', 'resilient', 'skittish'].sort(),
    );
  });

  it('the two endpoints agree on the flag-name set (canonical)', async () => {
    const flagsRes = await request(app)
      .get('/api/v1/flags/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(flagsRes.status).toBe(200);
    const flagsNames = flagsRes.body.data.flags.map(f => f.name).sort();

    const traitsRes = await request(app)
      .get('/api/v1/epigenetic-traits/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(traitsRes.status).toBe(200);
    const traitsNames = Object.values(traitsRes.body.data.epigeneticFlags)
      .map(f => f.name)
      .sort();

    // Both endpoints match the canonical roster...
    expect(flagsNames).toEqual(CANONICAL_NAMES);
    expect(traitsNames).toEqual(CANONICAL_NAMES); // RED pre-fix: had antisocial/social/sensitive
    // ...and therefore each other.
    expect(traitsNames).toEqual(flagsNames);
  });

  it('the epigenetic-traits endpoint no longer serves any stale-only flag', async () => {
    const traitsRes = await request(app)
      .get('/api/v1/epigenetic-traits/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(traitsRes.status).toBe(200);
    const traitsNames = Object.values(traitsRes.body.data.epigeneticFlags).map(f => f.name);
    for (const stale of ['antisocial', 'social', 'sensitive']) {
      expect(traitsNames).not.toContain(stale);
    }
  });
});
