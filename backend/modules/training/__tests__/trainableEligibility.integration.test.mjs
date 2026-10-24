/**
 * GET /api/v1/training/trainable/:userId reports the server's own eligibility
 * verdict per horse (Equoria-du9bn).
 *
 * The list carried no health and no refusal, so the client re-derived
 * eligibility from age and cooldown alone and showed a retired or Bad-health
 * horse as ready; the train call then refused it. Each horse now carries
 * `canTrain` and `ineligibleReason`, produced by the SAME rules the train call
 * applies (age window 3-20, Fair-or-better health, owner rulings 2026-10-23):
 * the reason equals canTrain()'s reason for that horse.
 *
 * Real backend, real auth, real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { canTrain } from '../controllers/trainingController.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const prefix = 'TestFixture-trainable-eligibility';

let owner;
let token;
const horses = {};

const fit = { healthStatus: 'Excellent', lastFedDate: new Date(), lastVettedDate: new Date() };

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const a = await createTestUser({
    username: `${prefix}-${tag}`,
    email: `${prefix}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  const make = (key, extra) =>
    createTestHorse({ name: `${prefix}-${key}-${tag}`, userId: owner.id, ...fit, ...extra }).then(h => {
      horses[key] = h;
    });
  await make('fit', { age: 6 });
  await make('lastYear', { age: 20 });
  await make('retired', { age: 21 });
  await make('foal', { age: 2 });
  await make('injured', { age: 6, healthStatus: 'Injured' });
  // Owner ruling 2026-10-23: Bad health needs vet days too (never fed alone is Good).
  await make('unfed', {
    age: 6,
    lastFedDate: null,
    lastVettedDate: gameCalendarDate(new Date(), -25),
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

async function listed() {
  const res = await request(app)
    .get(`/api/v1/training/trainable/${owner.id}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', 'http://localhost:3000');
  expect(res.status).toBe(200);
  const byId = new Map(res.body.data.map(h => [h.id, h]));
  return key => byId.get(horses[key].id);
}

describe('GET /api/v1/training/trainable/:userId carries the server verdict (Equoria-du9bn)', () => {
  it('lets a fit horse in the active window train, with no refusal', async () => {
    const get = await listed();
    for (const key of ['fit', 'lastYear']) {
      expect(get(key).canTrain).toBe(true);
      expect(get(key).ineligibleReason).toBeNull();
    }
  }, 60000);

  it('refuses a retired horse, a foal, an injured horse and an unfed one, each with a reason', async () => {
    const get = await listed();
    for (const key of ['retired', 'foal', 'injured', 'unfed']) {
      expect(get(key).canTrain).toBe(false);
      expect(typeof get(key).ineligibleReason).toBe('string');
      expect(get(key).ineligibleReason.length).toBeGreaterThan(0);
    }
    expect(get('retired').ineligibleReason).toMatch(/too old/i);
    expect(get('foal').ineligibleReason).toMatch(/under age/i);
    expect(get('injured').ineligibleReason).toMatch(/injured/i);
    expect(get('unfed').ineligibleReason).toMatch(/Bad health/);
  }, 60000);

  it('says exactly what the train call says for the same horse', async () => {
    const get = await listed();
    for (const key of ['fit', 'lastYear', 'retired', 'foal', 'injured', 'unfed']) {
      const verdict = await canTrain(horses[key].id, 'Dressage');
      expect(get(key).canTrain).toBe(verdict.eligible);
      expect(get(key).ineligibleReason).toBe(verdict.eligible ? null : verdict.reason);
    }
  }, 60000);
});
