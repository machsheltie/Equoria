/**
 * GET /api/v1/horses/:id/offspring (Equoria-oey96.55).
 *
 * Owner ruling 2026-10-23: the pedigree tab lists a horse's offspring by name,
 * each a link to that horse, and exposes no private data. Offspring sold to
 * other players still count (they are this horse's foals), so the read cannot
 * be derived from the viewer's own stable list. Each offspring is its id and
 * name only — no owner, stats, genetics or traits (hidden or revealed).
 *
 * Real DB, real Express app, scoped fail-loud fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import config from '../../../config/config.mjs';

const PREFIX = 'TestFixture-oey9655';
const createdUserIds = [];
const createdHorseIds = [];
const cleanup = createCleanupTracker();

let owner;
let ownerToken;
let otherToken;
let sire;
let dam;
let barren;
let foalOwned;
let foalSold;

async function makeUser(suffix) {
  const tag = randomBytes(4).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${suffix}-${tag}`,
      email: `${PREFIX}-${suffix}-${tag}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Offspring',
      lastName: suffix,
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

async function makeHorse(userId, label, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-${label}-${randomBytes(3).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-04-01'),
      age: 8,
      userId,
      healthStatus: 'healthy',
      ...extra,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  let other;
  ({ user: owner, token: ownerToken } = await makeUser('owner'));
  ({ user: other, token: otherToken } = await makeUser('other'));

  sire = await makeHorse(owner.id, 'sire', { sex: 'Stallion' });
  dam = await makeHorse(owner.id, 'dam', { sex: 'Mare' });
  barren = await makeHorse(owner.id, 'barren', { sex: 'Mare' });
  foalOwned = await makeHorse(owner.id, 'foal-owned', {
    sireId: sire.id,
    damId: dam.id,
    dateOfBirth: new Date('2024-03-01'),
    age: 2,
    epigeneticModifiers: { positive: [], negative: [], hidden: ['secretTrait'] },
  });
  // Sold to another player: still the sire's offspring.
  foalSold = await makeHorse(other.id, 'foal-sold', {
    sireId: sire.id,
    dateOfBirth: new Date('2025-03-01'),
    age: 1,
  });

  // Foals reference their parents (onDelete: Restrict), so they go first.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: [foalOwned.id, foalSold.id] } } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'parent horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 30000);

const getOffspring = (horseId, token) =>
  request(app)
    .get(`/api/v1/horses/${horseId}/offspring`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`);

describe('GET /api/v1/horses/:id/offspring (Equoria-oey96.55)', () => {
  it('lists every foal a sire produced, including one sold to another player, oldest first', async () => {
    const res = await getOffspring(sire.id, ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      { id: foalOwned.id, name: foalOwned.name },
      { id: foalSold.id, name: foalSold.name },
    ]);
  });

  it('lists a dam’s foals through the dam side', async () => {
    const res = await getOffspring(dam.id, ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: foalOwned.id, name: foalOwned.name }]);
  });

  it('answers an empty list for a horse with no foals', async () => {
    const res = await getOffspring(barren.id, ownerToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('exposes only id and name for each offspring — no owner, traits or stats', async () => {
    const res = await getOffspring(sire.id, ownerToken);

    for (const row of res.body.data) {
      expect(Object.keys(row).sort()).toEqual(['id', 'name']);
    }
    expect(JSON.stringify(res.body)).not.toContain('secretTrait');
  });

  it("refuses another player's horse without revealing its foals", async () => {
    const res = await getOffspring(sire.id, otherToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty('data');
  });

  it('refuses an anonymous caller', async () => {
    const res = await request(app).get(`/api/v1/horses/${sire.id}/offspring`).set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
  });
});
