/**
 * Equoria-fby1t — a groom's age is shown to the player, always.
 *
 * OWNER RULING (2026-09-14 10:23, via the decision register):
 *   "Show a groom's age always and accept the age-64 case, since the existing ruling
 *    already requires notifying a player when a groom is retiring."
 *
 * The age was backend-only: no response emitted it (groomAgeService's header said so
 * in as many words). It now reaches the player wherever a groom's identity is read.
 *
 * THE AGE-64 CASE, ACCEPTED ON PURPOSE. Retirement age is uniform on 50..65, so a
 * visible age narrows it: nothing below 50, fifteen values left at 50, one at 64 —
 * a guaranteed one-week warning. The owner ruled that acceptable because the game
 * already notifies a player in the week a groom retires. What stays hidden is the
 * RETIREMENT age itself (Equoria-m9lz1, invariant I3), and this file asserts that
 * boundary rather than assuming it.
 *
 * WHAT IS ASSERTED, AND WHY EACH FAILS ON THE PRE-RULING CODE:
 *   1. The roster list carries `ageYears`         -> no response emitted any age
 *   2. The groom profile carries `ageYears`       -> same
 *   3. Both speak in YEARS: the raw `careerWeeks` / `startAge` counters are NOT in
 *      the payload (Equoria-maeba — the career-weeks reading is retired, and two
 *      numbers a player must add up are not an age)
 *   4. The hidden retirement age is still absent from both reads
 *
 * Real DB, no mocks; controllers driven with a fake req/res (the Equoria-otii0
 * pattern in this directory).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { getUserGrooms, getGroomProfile } from '../controllers/groomRosterController.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';

const FIXTURE_PREFIX = 'TestFixture-fby1t-age';
const FIXTURE_START_AGE = 21;
const FIXTURE_CAREER_WEEKS = 13; // so the groom is 34
const tag = () => randomBytes(6).toString('hex');

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Equoria-fby1t — the player can see how old their groom is', () => {
  let user;
  let groom;
  let retirementAge;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${suffix}`.slice(0, 30),
        email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Age',
        lastName: 'Visible',
        money: 1000,
        settings: {},
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: FIXTURE_START_AGE,
        careerWeeks: FIXTURE_CAREER_WEEKS,
        userId: user.id,
      },
    });
    retirementAge = await ensureRetirementSchedule(prisma, groom.id);

    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: groom.id } }),
      'retirement schedule',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the roster list gives each groom an age in years, and no raw counters', async () => {
    const res = fakeRes();
    await getUserGrooms({ params: { userId: user.id }, query: {} }, res);
    expect(res.statusCode).toBe(200);

    const row = res.body.grooms.find(g => g.id === groom.id);
    expect(row).toBeDefined();
    expect(row.ageYears).toBe(FIXTURE_START_AGE + FIXTURE_CAREER_WEEKS);
    expect(row).not.toHaveProperty('careerWeeks');
    expect(row).not.toHaveProperty('startAge');
    expect(row).not.toHaveProperty('retirementSchedule');
  }, 30000);

  it('the groom profile gives the same age', async () => {
    const res = fakeRes();
    await getGroomProfile({ params: { id: String(groom.id) }, user: { id: user.id } }, res);
    expect(res.statusCode).toBe(200);

    expect(res.body.groom.ageYears).toBe(FIXTURE_START_AGE + FIXTURE_CAREER_WEEKS);
    expect(res.body.groom).not.toHaveProperty('careerWeeks');
    expect(res.body.groom).not.toHaveProperty('startAge');
  }, 30000);

  it('a groom whose age is not yet known reports it as unknown, not as zero', async () => {
    // A groom that predates Equoria-ypb7d has no start age until the next weekly
    // pass draws one. Unknown is null — the surface shows an em dash, and nothing
    // pretends they are newborn.
    const ageless = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-ageless-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        careerWeeks: 4,
        userId: user.id,
      },
    });

    const res = fakeRes();
    await getUserGrooms({ params: { userId: user.id }, query: {} }, res);
    const row = res.body.grooms.find(g => g.id === ageless.id);
    expect(row.ageYears).toBeNull();
  }, 30000);

  it('neither read exposes the HIDDEN retirement age (Equoria-m9lz1 must not regress)', async () => {
    const listRes = fakeRes();
    await getUserGrooms({ params: { userId: user.id }, query: {} }, listRes);
    const profileRes = fakeRes();
    await getGroomProfile({ params: { id: String(groom.id) }, user: { id: user.id } }, profileRes);

    for (const body of [listRes.body, profileRes.body]) {
      const serialized = JSON.stringify(body);
      expect(serialized).not.toMatch(/retirementAge/i);
      expect(serialized).not.toMatch(/retirementSchedule/i);
      expect(serialized).not.toMatch(/weeksUntilRetirement|noticeRequired/i);
    }
    // The drawn age is a real number in 50..65; the guard above is meaningful only
    // because that value exists for this groom.
    expect(retirementAge).toBeGreaterThanOrEqual(50);
    expect(retirementAge).toBeLessThanOrEqual(65);
  }, 30000);
});
