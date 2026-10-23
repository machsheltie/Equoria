/**
 * Player level curve and backfill — real DB (Equoria-smqn7).
 *
 * Owner decision 2026-07-07 (option A): level = floor(xp / 100) + 1, so level 2
 * begins at 100 xp. One helper (levelForXp / levelProgress) feeds the level-up
 * and the progress display; the backfill raises stored levels to the curve and
 * never lowers one. Old contract: level 1 spanned 0-199 xp (max(1, floor(xp/100))).
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { addXpToUser, getUserProgress, levelForXp, levelProgress } from '../services/userModelService.mjs';
import { backfillUserLevels } from '../../../scripts/backfill-user-levels.mjs';

const createdUserIds = [];

async function makeUser({ xp = 0, level = 1 } = {}) {
  const uniq = randomBytes(8).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `testfixture-smqn7-${uniq}@test.com`,
      username: `TestFixturesmqn7${uniq}`,
      password: 'irrelevant-hash',
      firstName: 'Curve',
      lastName: 'Tester',
      money: 1000,
      xp,
      level,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

const stored = id => prisma.user.findUnique({ where: { id }, select: { xp: true, level: true } });

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.xpEvent.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}, 120000);

describe('levelForXp boundaries', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [199, 2],
    [200, 3],
  ])('xp %i is level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });
});

describe('levelProgress is the display of the same curve', () => {
  it.each([
    [0, { level: 1, xpForCurrentLevel: 0, xpForNextLevel: 100, xpToNextLevel: 100, progressPercentage: 0 }],
    [99, { level: 1, xpForCurrentLevel: 0, xpForNextLevel: 100, xpToNextLevel: 1, progressPercentage: 99 }],
    [100, { level: 2, xpForCurrentLevel: 100, xpForNextLevel: 200, xpToNextLevel: 100, progressPercentage: 0 }],
    [199, { level: 2, xpForCurrentLevel: 100, xpForNextLevel: 200, xpToNextLevel: 1, progressPercentage: 99 }],
    [200, { level: 3, xpForCurrentLevel: 200, xpForNextLevel: 300, xpToNextLevel: 100, progressPercentage: 0 }],
    [250, { level: 3, xpForCurrentLevel: 200, xpForNextLevel: 300, xpToNextLevel: 50, progressPercentage: 50 }],
  ])('xp %i', (xp, expected) => {
    expect(levelProgress(xp)).toEqual(expected);
  });

  it('agrees with levelForXp at every xp from 0 to 400', () => {
    for (let xp = 0; xp <= 400; xp += 1) {
      expect(levelProgress(xp).level).toBe(levelForXp(xp));
    }
  });
});

describe('the award path and the progress read use that curve', () => {
  it('levels up at 100 xp, not 200, and reports the gain', async () => {
    const user = await makeUser();
    const first = await addXpToUser(user.id, 99, 'TestFixture-smqn7');
    expect(first).toMatchObject({ currentXP: 99, currentLevel: 1, leveledUp: false, levelsGained: 0 });
    const second = await addXpToUser(user.id, 1, 'TestFixture-smqn7');
    expect(second).toMatchObject({ currentXP: 100, currentLevel: 2, leveledUp: true, levelsGained: 1 });
    expect((await stored(user.id)).level).toBe(2);
    const third = await addXpToUser(user.id, 100, 'TestFixture-smqn7');
    expect(third).toMatchObject({ currentXP: 200, currentLevel: 3, leveledUp: true, levelsGained: 1 });
  });

  it('getUserProgress reports the same boundaries the award used', async () => {
    const user = await makeUser({ xp: 150, level: 2 });
    expect(await getUserProgress(user.id)).toEqual({
      userId: user.id,
      level: 2,
      xp: 150,
      xpToNextLevel: 50,
      xpForNextLevel: 200,
    });
  });
});

describe('backfill-user-levels', () => {
  it('dry run counts the players behind the curve and writes nothing', async () => {
    const behind = await makeUser({ xp: 250, level: 2 });
    const onCurve = await makeUser({ xp: 50, level: 1 });
    const ids = [behind.id, onCurve.id];

    expect(await backfillUserLevels({ userIds: ids })).toEqual({
      dryRun: true,
      scanned: 2,
      behind: 1,
      raised: 0,
    });
    expect((await stored(behind.id)).level).toBe(2);
  });

  it('raises a lagging level to the curve, never lowers a higher one, and is idempotent', async () => {
    const lagging = await makeUser({ xp: 250, level: 2 });
    const wayBehind = await makeUser({ xp: 1000, level: 1 });
    const onCurve = await makeUser({ xp: 100, level: 2 });
    const ahead = await makeUser({ xp: 100, level: 7 });
    const fresh = await makeUser({ xp: 0, level: 1 });
    const ids = [lagging.id, wayBehind.id, onCurve.id, ahead.id, fresh.id];

    const first = await backfillUserLevels({ dryRun: false, userIds: ids });
    expect(first).toEqual({ dryRun: false, scanned: 5, behind: 2, raised: 2 });
    expect((await stored(lagging.id)).level).toBe(3);
    expect((await stored(wayBehind.id)).level).toBe(11);
    expect((await stored(onCurve.id)).level).toBe(2);
    expect((await stored(ahead.id)).level).toBe(7);
    expect((await stored(fresh.id)).level).toBe(1);

    const second = await backfillUserLevels({ dryRun: false, userIds: ids });
    expect(second).toEqual({ dryRun: false, scanned: 5, behind: 0, raised: 0 });
    expect((await stored(ahead.id)).level).toBe(7);
  });
});
