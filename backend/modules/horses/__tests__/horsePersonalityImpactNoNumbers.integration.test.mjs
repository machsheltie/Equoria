/**
 * GET /horses/:id/personality-impact keeps the game's numbers to itself
 * (Equoria-2wdp8).
 *
 * Owner ruling 2026-10-28 (q164): "We want to hide anything a player might be
 * able to use to abuse the game and create loopholes." The route sent each
 * groom's trait modifier, bond modifier and strong-match flag (which gives away
 * the bond threshold), and a table of every groom personality that suits the
 * temperament with its trait-development bonus and bond modifier. No screen
 * reads any of those numbers.
 *
 * What stays: which of the player's grooms suit the horse, in authored words.
 *
 * Real app, real database, real auth; fixtures are this file's own.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { GROOM_PERSONALITY_TYPES, FOAL_TEMPERAMENT_TYPES } from '../../../utils/groomPersonalityTraitBonus.mjs';

const fixturePrefix = 'TestFixture-2wdp8-impact';
const internals = ['traitModifier', 'bondModifier', 'traitDevBonus', 'isStrongMatch', 'idealMatches'];

let token;
let horse;
let groomId;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const created = await createTestUser({
    username: `${fixturePrefix}-${tag}`,
    email: `${fixturePrefix}-${tag}@example.com`,
  });
  token = created.token;
  horse = await createTestHorse({
    name: `${fixturePrefix}-${tag}`,
    userId: created.user.id,
    temperament: FOAL_TEMPERAMENT_TYPES.REACTIVE,
    bondScore: 80,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${fixturePrefix}-groom-${tag}`,
      speciality: 'foalCare',
      personality: GROOM_PERSONALITY_TYPES.CALM,
      skillLevel: 'novice',
      userId: created.user.id,
    },
  });
  groomId = groom.id;
}, 120000);

afterAll(async () => {
  if (groomId) {
    await prisma.groom.deleteMany({ where: { id: groomId } });
  }
  await cleanupTestData();
});

describe('the personality-impact read says whether grooms suit, not by how much', () => {
  it('names the suiting groom and sends no modifier, bonus or threshold', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/personality-impact`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const entry = res.body.groomCompatibility.find(g => g.groom.id === groomId);
    expect(entry.compatibility.isMatch).toBe(true);
    expect(typeof entry.compatibility.description).toBe('string');
    expect(res.body.generalCompatibility.length).toBeGreaterThan(0);

    const wire = JSON.stringify(res.body);
    for (const internal of internals) {
      expect({ internal, sent: wire.includes(internal) }).toEqual({ internal, sent: false });
    }
  });
});
