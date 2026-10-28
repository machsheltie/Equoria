/**
 * Equoria-ic0vv — the ownerless fallback-recipient path of processRetirement,
 * driven for real.
 *
 * WHAT IS BEING PINNED. When a retiring groom has no `userId` ("on nobody's
 * staff"), processRetirement does not retire it silently: it falls back to the
 * distinct players named by the `userId` of the assignments it just ended, writes
 * each of them their OWN `groomRetired` Notification, and each notification's
 * `horses` list must hold only that player's horses. The failure mode this guards
 * is the worst one the notice can have: showing one player another player's horse
 * names. Until now the scoping (`horsesForRecipient`, a strict
 * `a.userId === recipientId` in the fallback case) was argued from the source, and
 * the branch was unreachable from ordinary play, so nothing exercised it.
 *
 * WHAT IS DRIVEN. A real groom with `userId: null`, active assignments on horses
 * owned by two different players, retired through the real `processRetirement`
 * against the real database. The assertions read the STORED notification rows (the
 * thing a player would see), not just the returned value.
 *
 * ALSO PINNED: the attribution-mismatch branch. An ending assignment that carries
 * no `userId` either lands on no recipient's list, and the service then logs
 * `logger.error` and carries on (loud but non-fatal, by design: a retirement the
 * game decided on must not be undone by a data oddity). The test observes the log
 * call through a pass-through spy; nothing is stubbed.
 *
 * Real database. No mocks of any Equoria-owned path. Fixtures are uniquely named
 * and cleaned up by id, fail-loud.
 *
 * @module modules/grooms/__tests__/groomRetirementFallbackRecipients.integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processRetirement } from '../services/groomRetirementService.mjs';

const fixturePrefix = 'TestFixture-ic0vv';
// The notification type the service writes (GROOM_RETIRED_NOTIFICATION_TYPE in the service),
// spelled out so a change to the stored type is a visible failure here.
const groomRetiredType = 'groomRetired';
const fixtureStartAge = 20; // inside the 18..24 band the grooms_start_age_range CHECK enforces

const tag = () => randomBytes(6).toString('hex');

async function makeUser(label) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${fixturePrefix}-${label}-${suffix}`,
      email: `${fixturePrefix}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Ic0vv',
      lastName: label,
      money: 5000,
      settings: {},
    },
  });
}

async function makeHorse(ownerId, label) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${fixturePrefix}-${label}-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2024-06-15'),
      age: 1,
      userId: ownerId,
      healthStatus: 'Excellent',
    },
  });
}

describe('Equoria-ic0vv — processRetirement for a groom on nobody’s staff', () => {
  const cleanup = createCleanupTracker();
  let playerA;
  let playerB;
  let groom;
  let horsesA;
  let horseB;

  beforeEach(async () => {
    playerA = await makeUser('playerA');
    playerB = await makeUser('playerB');
    horsesA = [await makeHorse(playerA.id, 'a1'), await makeHorse(playerA.id, 'a2')];
    horseB = await makeHorse(playerB.id, 'b1');

    // userId: null is the whole point — this groom is on nobody's staff.
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${tag()}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'intermediate',
        careerWeeks: 5,
        startAge: fixtureStartAge,
        userId: null,
      },
    });

    const ids = {
      groomId: groom.id,
      userIds: [playerA.id, playerB.id],
      horseIds: [...horsesA.map(h => h.id), horseB.id],
    };
    // Reverse dependency order: notifications, assignments (cascade from groom too,
    // but explicit), groom, horses, users.
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: ids.userIds } } }), 'notifications');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: ids.groomId } }), 'assignments');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: ids.groomId } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }), 'users');
  }, 60000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup.run();
  }, 60000);

  const assign = (horse, userId) =>
    prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId, isActive: true },
    });

  it('notifies each assignment owner separately, and each notice names only that player’s horses', async () => {
    await assign(horsesA[0], playerA.id);
    await assign(horsesA[1], playerA.id);
    await assign(horseB, playerB.id);

    const result = await processRetirement(groom.id, 'voluntary', true);

    // Two recipients, the distinct assignment owners, in sorted id order.
    expect(result.notificationRecipientIds).toEqual([playerA.id, playerB.id].sort());
    expect(result.endedAssignmentCount).toBe(3);

    // The STORED rows, which are what each player would read.
    const noticeA = await prisma.notification.findMany({
      where: { userId: playerA.id, type: groomRetiredType },
    });
    const noticeB = await prisma.notification.findMany({
      where: { userId: playerB.id, type: groomRetiredType },
    });
    expect(noticeA).toHaveLength(1);
    expect(noticeB).toHaveLength(1);

    const expectedA = horsesA.map(h => ({ id: h.id, name: h.name })).sort((x, y) => x.id - y.id);
    expect(noticeA[0].payload.horses).toEqual(expectedA);
    expect(noticeA[0].payload.horsesLeftUnattended).toBe(2);
    expect(noticeB[0].payload.horses).toEqual([{ id: horseB.id, name: horseB.name }]);
    expect(noticeB[0].payload.horsesLeftUnattended).toBe(1);

    // The disclosure property, stated directly: no horse name of one player appears
    // anywhere in the other player's stored payload.
    const serialisedA = JSON.stringify(noticeA[0].payload);
    const serialisedB = JSON.stringify(noticeB[0].payload);
    expect(serialisedA).not.toContain(horseB.name);
    for (const horse of horsesA) {
      expect(serialisedB).not.toContain(horse.name);
    }

    // The value returned to the caller carries the SAME per-recipient payloads the
    // rows hold, so the real-time nudge cannot describe a different event.
    const returned = new Map(result.notificationPayloadsByRecipient);
    expect(returned.get(playerA.id).horses).toEqual(expectedA);
    expect(returned.get(playerB.id).horses).toEqual([{ id: horseB.id, name: horseB.name }]);

    // The retirement itself happened, and every attributed horse was announced, so
    // the loud mismatch branch stayed quiet on this clean fallback.
    const retiredRow = await prisma.groom.findUnique({ where: { id: groom.id }, select: { retired: true } });
    expect(retiredRow).toEqual({ retired: true });
  }, 120000);

  it('logs loudly, and still retires, when an ending assignment names no player at all', async () => {
    await assign(horsesA[0], playerA.id);
    await assign(horseB, playerB.id);
    // No userId of its own and the groom has none either: it lands on nobody's list.
    await assign(horsesA[1], null);

    const errorSpy = jest.spyOn(logger, 'error');

    const result = await processRetirement(groom.id, 'voluntary', true);

    // Non-fatal: the retirement committed and the two attributable players were told.
    expect(result.endedAssignmentCount).toBe(3);
    expect(result.notificationRecipientIds).toEqual([playerA.id, playerB.id].sort());
    const retiredRow = await prisma.groom.findUnique({ where: { id: groom.id }, select: { retired: true } });
    expect(retiredRow).toEqual({ retired: true });

    // Loud: the service says that a horse lost its groom without its owner being told.
    const mismatchCalls = errorSpy.mock.calls
      .map(call => String(call[0]))
      .filter(message => message.includes(`Groom ${groom.id} ended 3 active assignment(s)`));
    expect(mismatchCalls).toHaveLength(1);
    expect(mismatchCalls[0]).toContain('only 2 reached one of 2 notified player(s)');

    // The unattributable horse is on no one's notice.
    const notices = await prisma.notification.findMany({
      where: { userId: { in: [playerA.id, playerB.id] }, type: groomRetiredType },
    });
    const namedIds = notices.flatMap(n => n.payload.horses.map(h => h.id));
    expect(namedIds).not.toContain(horsesA[1].id);
    expect(namedIds.sort((x, y) => x - y)).toEqual([horsesA[0].id, horseB.id].sort((x, y) => x - y));
  }, 120000);

  it('retires with no notification and a loud log when no assignment names a player either', async () => {
    await assign(horsesA[0], null);

    const errorSpy = jest.spyOn(logger, 'error');
    const result = await processRetirement(groom.id, 'voluntary', true);

    expect(result.notificationRecipientIds).toEqual([]);
    expect(result.notificationIds).toEqual([]);
    expect(result.endedAssignmentCount).toBe(1);
    const mismatchCalls = errorSpy.mock.calls
      .map(call => String(call[0]))
      .filter(message => message.includes(`Groom ${groom.id} ended 1 active assignment(s)`));
    expect(mismatchCalls).toHaveLength(1);
    expect(mismatchCalls[0]).toContain('only 0 reached one of 0 notified player(s)');
    expect(
      await prisma.notification.count({
        where: { userId: { in: [playerA.id, playerB.id] }, type: groomRetiredType },
      }),
    ).toBe(0);
  }, 120000);
});
