/**
 * Groom growth through conformation shows (Equoria-xlw03) — owner rulings 2026-10-28
 * (q160): each conformation show a groom presents a horse in counts toward its next
 * level; the 100th show at Rookie makes it a Novice and reveals 3 of its hidden items.
 * The player's groom profile then shows exactly those 3.
 *
 * Real settlement (executeConformationShow), real DB, real app; id-scoped cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';
import { ensureGrowthProfileTx } from '../../../services/staffGrowthService.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';

const ORIGIN = 'http://localhost:3000';
const prefix = 'TestFixture-xlw03-confgroom';
const tag = () => randomBytes(4).toString('hex');
const userIds = [];
const groomIds = [];
const horseIds = [];
const showIds = [];
const cleanup = createCleanupTracker();

async function makeUser() {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Groom',
      lastName: 'Shows',
      money: 5000,
      settings: {},
    },
  });
  userIds.push(user.id);
  return { user, token: generateTestToken({ id: user.id, email: user.email, role: 'user' }) };
}

async function hireGroom(user) {
  const groom = await prisma.groom.create({
    data: {
      name: `${prefix}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      starLevel: 'rookie',
      userId: user.id,
    },
  });
  groomIds.push(groom.id);
  await prisma.$transaction(tx => ensureGrowthProfileTx(tx, 'groom', groom.id));
  return groom;
}

const profileOf = groomId => prisma.groomGrowthProfile.findUnique({ where: { groomId } });

async function labelsOf(items) {
  const breeds = await prisma.breed.findMany({
    where: { id: { in: items.filter(i => i.kind === 'breed').map(i => i.value) } },
    select: { id: true, name: true },
  });
  const names = new Map(breeds.map(b => [b.id, b.name]));
  return items.map(i =>
    i.kind === 'trait' ? getTraitDefinition(i.value).label : i.kind === 'breed' ? names.get(i.value) : i.value,
  );
}

const shownLabels = growth => growth.categories.flatMap(c => c.revealed.map(r => r.label)).sort();

const call = (path, token) => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

beforeAll(() => {
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResult');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'show');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groomAssignment');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'groom');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
});

afterAll(() => cleanup.run(), 60000);

describe('groom growth through conformation shows (Equoria-xlw03)', () => {
  it('the 100th conformation show a Rookie groom presents makes it a Novice with 3 items shown', async () => {
    const { user, token } = await makeUser();
    const groom = await hireGroom(user);
    await prisma.groomGrowthProfile.update({
      where: { groomId: groom.id },
      data: { showsAtLevel: 99 },
    });
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${prefix}-horse-${tag()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: user.id,
        healthStatus: 'Good',
        bondScore: 50,
      },
    });
    horseIds.push(horse.id);
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
    });
    const show = await prisma.show.create({
      data: {
        name: `${prefix}-show-${tag()}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        closeDate: new Date(Date.now() - 60 * 60 * 1000),
        showType: 'conformation',
      },
    });
    showIds.push(show.id);
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: horse.id, userId: user.id, groomId: groom.id },
    });

    const results = await executeConformationShow(show.id);
    expect(results).toHaveLength(1);

    expect((await prisma.groom.findUnique({ where: { id: groom.id } })).starLevel).toBe('novice');
    const { items, showsAtLevel } = await profileOf(groom.id);
    expect(showsAtLevel).toBe(0);
    expect(items.filter(i => i.revealed)).toHaveLength(3);

    const res = await call(`/api/v1/grooms/${groom.id}/profile`, token);
    expect(shownLabels(res.body.groom.growth)).toEqual((await labelsOf(items.filter(i => i.revealed))).sort());
  }, 60000);
});
