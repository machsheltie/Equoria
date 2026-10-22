/**
 * Equoria-jy3f7: evolveHorseTemperament must not overwrite a temperament that
 * changed after it read the horse.
 *
 * The function reads the horse and its care history, decides on a new
 * temperament from the temperament it read, and then wrote it with a plain
 * `horse.update` outside any transaction or guard. A change committed between
 * that read and that write (another writer of Horse.temperament) was silently
 * replaced by a value computed from a temperament the horse no longer had.
 *
 * HOW THE INTERLEAVING IS FORCED: a second Prisma client locks the horse row,
 * the evolution is started and observed queued on that lock (it has already
 * read 'nervous'), and the barrier transaction changes the temperament to
 * 'Calm' and commits. The evolution's write then runs against a horse that is
 * no longer 'nervous'.
 *
 * No route reaches this function today (Equoria-gu8jk removed the temperament
 * routes); the write is still a player-state mutation and is fixed for its
 * atomicity only. Amounts, thresholds and the evolution table are untouched.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock, horseRowLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { evolveHorseTemperament } from '../services/personalityEvolutionSystem.mjs';

const tag = `jy3f7-${randomBytes(5).toString('hex')}`;

const barrierClient = createBarrierClient();

describe('Equoria-jy3f7: evolveHorseTemperament does not write over a newer temperament', () => {
  let user;
  let groom;
  let horse;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${tag}@test.com`,
        username: tag,
        password: 'irrelevant-hash',
        firstName: 'Test',
        lastName: 'Fixture',
        money: 1000,
      },
    });
    groom = await prisma.groom.create({
      data: { name: `TestFixture-${tag}-groom`, speciality: 'foal_care', personality: 'gentle', userId: user.id },
    });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-${tag}-horse`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -730),
        age: 2,
        userId: user.id,
        temperament: 'nervous',
      },
    });
    // Ten excellent sessions: the care history under which 'nervous' evolves.
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: horse.id,
          groomId: groom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'excellent',
          taskType: 'grooming',
          createdAt: new Date(now - (10 - i) * 60000),
          timestamp: new Date(now - (10 - i) * 60000),
        },
      });
    }
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: horse?.id } }), 'interactions');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse?.id } }), 'horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom?.id } }), 'groom');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id } }), 'user');
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
    await barrierClient.$disconnect();
  }, 60000);

  it('keeps a temperament committed between the evolution read and its write', async () => {
    let barrierTx;
    const barrier = await holdLock(barrierClient, async tx => {
      barrierTx = tx;
      await horseRowLock(horse.id)(tx);
    });
    let evolution;
    try {
      evolution = evolveHorseTemperament(horse.id);
      // Started, read 'nervous', and now queued on the horse row.
      await barrier.waitForQueued(1);
      await barrierTx.horse.update({ where: { id: horse.id }, data: { temperament: 'Calm' } });
    } finally {
      await barrier.release();
    }
    const result = await evolution;

    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { temperament: true } });
    expect(after.temperament).toBe('Calm');
    expect(result.temperamentEvolved).toBe(false);
  }, 90000);
});
