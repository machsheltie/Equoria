/**
 * nextActionsEntryRules.integration.test.mjs (Equoria-576c0 B9 round 2)
 *
 * The `compete` suggestion applies the same entry rules as the entry
 * transaction (utils/competitionEntryRules.evaluateEntryRules): age 3-20 game
 * years from dateOfBirth, an eligible rider (C10), Gaited needs gaiting (C12),
 * not already entered, not injured. Old contract: age >= 3 from the age column,
 * not injured, and the XP level bracket (R9 removed it).
 *
 * A horse that can enter no ridden show (too old, no rider) is never
 * suggested, whatever other open shows exist. For the positive case the
 * fixture show closes in about two minutes, so it is the soonest-closing open
 * show and the one the suggestion names.
 *
 * Real DB and HTTP; free shows; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const rand = () => randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const showIds = [];
const riderIds = [];
let tooOldUser;
let riderlessUser;
let xpUser;
let xpHorse;
let show;
let limitedUser;

cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      email: `b9na-${rand()}@test.local`,
      username: `b9na${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Next',
      lastName: 'Action',
      money: 0,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeHorse(user, { years = 7, rider = true, ...fields } = {}) {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-b9na-${rand()}`,
      sex: 'Rig',
      age: years,
      dateOfBirth: competitionDateOfBirth(years),
      healthStatus: 'Excellent',
      // Training cooldown running, so no `train` action clutters the list.
      trainingCooldown: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      userId: user.id,
      ...fields,
    },
    horseIds,
  );
  if (rider) {
    await giveEligibleRider(prisma, { horseId: horse.id, userId: user.id }, riderIds);
  }
  return horse;
}

function competeActions(user) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return request(app)
    .get('/api/v1/next-actions')
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .then(res => {
      expect(res.status).toBe(200);
      return res.body.data.actions.filter(a => a.type === 'compete');
    });
}

beforeAll(async () => {
  const now = Date.now();
  // Labelled level 999: the old XP bracket hid every horse below level 999 from it.
  show = await prisma.show.create({
    data: {
      name: `TestFixture-b9na-show-${rand()}`,
      discipline: 'Dressage',
      levelMin: 999,
      levelMax: 999,
      entryFee: 0,
      prize: 0,
      runDate: new Date(now + 2 * 60 * 1000),
      status: 'open',
      openDate: new Date(now - 60 * 1000),
      closeDate: new Date(now + 2 * 60 * 1000),
    },
  });
  showIds.push(show.id);

  tooOldUser = await makeUser();
  await makeHorse(tooOldUser, { years: 21 });

  riderlessUser = await makeUser();
  await makeHorse(riderlessUser, { rider: false });

  xpUser = await makeUser();
  xpHorse = await makeHorse(xpUser, { horseXp: 0 }); // old XP level 1

  // B10: a horse already active in 3 other discipline types; the fixture show
  // above (Dressage) would be its 4th type.
  limitedUser = await makeUser();
  const limited = await makeHorse(limitedUser);
  for (const discipline of ['Racing', 'Show Jumping', 'Western Pleasure']) {
    const other = await prisma.show.create({
      data: {
        name: `TestFixture-b10na-${rand()}`,
        discipline,
        entryFee: 0,
        prize: 0,
        levelMin: 1,
        levelMax: 999,
        runDate: new Date(now + 3 * 24 * 60 * 60 * 1000),
        status: 'open',
        openDate: new Date(now - 60 * 1000),
        closeDate: new Date(now + 3 * 24 * 60 * 60 * 1000),
      },
    });
    showIds.push(other.id);
    await prisma.showEntry.create({
      data: { showId: other.id, horseId: limited.id, userId: limitedUser.id, feePaid: 0 },
    });
  }
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('the compete suggestion uses the entry rules (B9)', () => {
  it('never suggests a 21-year-old horse', async () => {
    expect(await competeActions(tooOldUser)).toHaveLength(0);
  });

  it('never suggests a horse with no rider', async () => {
    expect(await competeActions(riderlessUser)).toHaveLength(0);
  });

  it('suggests a horse the XP bracket used to hide (R9)', async () => {
    const compete = await competeActions(xpUser);
    expect(compete).toHaveLength(1);
    expect(compete[0]).toMatchObject({ horseId: xpHorse.id, metadata: { showId: show.id } });
  });

  it('does not suggest a show that would be a 4th discipline type (B10)', async () => {
    const compete = await competeActions(limitedUser);
    expect(compete.every(a => a.metadata?.showId !== show.id)).toBe(true);
  });
});
