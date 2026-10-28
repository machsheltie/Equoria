/**
 * starterHorseNameFitsPolicy.integration.test.mjs (Equoria-4fnro)
 *
 * INVARIANT: the starter horse onboarding generates for a new player carries a
 * name the shared horse-name policy accepts (owner ruling 2026-09-14,
 * Equoria-zalyb: horse names are at most 40 characters).
 *
 * The generated name is `<username>'s First Horse`. Registration allows a
 * username of up to 30 characters (authRoutes.mjs), and the suffix is 14, so an
 * untrimmed name could reach 44 — a name the game would refuse if the player
 * typed it herself. The username part is shortened so the whole name fits; the
 * "'s First Horse" shape is kept.
 *
 * NO MOCKS: the service runs against the real database and the stored row is
 * read back. Scoped cleanup deletes only the ids this suite created.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createStarterHorseForNewUser } from '../services/onboardingService.mjs';
import { horseNameRejectionReason } from '../../horses/index.mjs';

const suffix = "'s First Horse";

describe('INTEGRATION: the generated starter horse name fits the horse-name policy (Equoria-4fnro)', () => {
  const createdUserIds = [];
  const cleanup = createCleanupTracker();

  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }), 'horse');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refreshToken');
  cleanup.add(() => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }), 'auditLog');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');

  afterAll(() => cleanup.run(), 60000);

  async function makeUser(username) {
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@test.com`,
        password: 'not-a-real-hash-fixture-only',
        firstName: 'Starter',
        lastName: 'Name',
      },
      select: { id: true, username: true },
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function starterName(userId) {
    const horses = await prisma.horse.findMany({ where: { userId }, select: { name: true } });
    expect(horses).toHaveLength(1);
    return horses[0].name;
  }

  it('a 30-character username (the registration maximum) yields a name of at most 40 characters', async () => {
    // 'snm' + 24 hex + 'xyz' = exactly 30 characters, letters/digits only, as registration allows.
    const username = `snm${randomBytes(12).toString('hex')}xyz`;
    expect(username).toHaveLength(30);
    const user = await makeUser(username);

    await createStarterHorseForNewUser(user);

    const name = await starterName(user.id);
    // Pre-fix this was 44 characters and the policy said 'length'.
    expect(name.length).toBeLessThanOrEqual(40);
    expect(horseNameRejectionReason(name)).toBeNull();
    expect(name).toBe(`${username.slice(0, 40 - suffix.length)}${suffix}`);
  }, 60000);

  it('a short username keeps the full "<username>\'s First Horse" name', async () => {
    const username = `sn${randomBytes(4).toString('hex')}`;
    const user = await makeUser(username);

    await createStarterHorseForNewUser(user);

    expect(await starterName(user.id)).toBe(`${username}${suffix}`);
  }, 60000);
});
