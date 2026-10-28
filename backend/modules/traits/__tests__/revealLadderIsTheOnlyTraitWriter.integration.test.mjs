/**
 * The nightly reveal ladder is the only thing that changes a horse's traits
 * (Equoria-kqdde).
 *
 * Owner rulings 2026-10-27 (q112-q118) and 2026-10-28 (q139): traits are
 * revealed and switched off only by grooming and neglect days in a foal's first
 * 21 days (modules/traits/services/traitRevealEngine.mjs). The 2026-10-22 ruling
 * recorded on Equoria-q4uem.17 eliminated temporary flags, and there is no adult
 * discovery. This file pins the other paths that used to claim trait changes:
 *   - the daily temporary-flag sweep and the environmental-event flag writer;
 *   - the invented ultra-rare trigger run after every foal milestone (it recorded
 *     off-roster traits such as phoenix-born as triggered);
 *   - the adult discovery conditions (age 3+ bond, weekly training) advertised
 *     by GET /api/traits/discovery-status.
 *
 * Real database for the milestone foal.
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import cronJobRegistry from '../../../services/jobs/index.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import * as environmentalTriggerSystem from '../services/environmentalTriggerSystem.mjs';
import * as traitsApi from '../index.mjs';
import { evaluateEnhancedMilestone } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import { checkDiscoveryConditions } from '../../../utils/traitDiscovery.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const RUN = randomBytes(5).toString('hex');
const moduleGone = rel => !existsSync(fileURLToPath(new URL(rel, import.meta.url)));

let user;
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `tf-onlywriter-${RUN}`,
      email: `tf-onlywriter-${RUN}@example.com`,
      password: 'x',
      firstName: 'Test',
      lastName: 'Fixture',
    },
  });
}, 60_000);

afterAll(async () => {
  const cleanup = createCleanupTracker();
  const ids = [...horseIds];
  cleanup.add(() => prisma.ultraRareTraitEvent.deleteMany({ where: { horseId: { in: ids } } }), 'ultraRareTraitEvents');
  cleanup.add(() => prisma.milestoneTraitLog.deleteMany({ where: { horseId: { in: ids } } }), 'milestoneTraitLogs');
  cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: ids } } }), 'traitHistoryLog');
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id ?? 'none' } }), 'user');
  await cleanup.run();
}, 60_000);

describe('temporary flags are gone (Equoria-kqdde)', () => {
  it('no scheduled job sweeps temporary flags, and nothing can apply one', () => {
    expect(cronJobRegistry.map(j => j.jobName)).not.toContain('temporaryFlagExpiry');
    expect(cronJobService.sweepExpiredTemporaryFlags).toBeUndefined();
    expect(traitsApi).not.toHaveProperty('sweepExpiredTemporaryFlags');
    expect(environmentalTriggerSystem).not.toHaveProperty('applyEnvironmentalEventFlag');
    expect(moduleGone('../services/temporaryFlagSystem.mjs')).toBe(true);
    expect(moduleGone('../../../services/jobs/temporaryFlagExpiryJob.mjs')).toBe(true);
  });
});

describe('foal milestones claim no traits (Equoria-kqdde)', () => {
  it('a milestone evaluation runs no invented ultra-rare trigger and leaves the traits as they were', async () => {
    const modifiers = { positive: [], negative: [], hidden: ['brave'] };
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-onlywriter-${RUN}`,
        sex: 'Colt',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        age: 0,
        userId: user.id,
        bondScore: 60,
        epigeneticModifiers: modifiers,
      },
      horseIds,
    );

    const result = await evaluateEnhancedMilestone(foal.id, 'socialization');

    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('ultraRareEvaluation');
    expect(await prisma.ultraRareTraitEvent.count({ where: { horseId: foal.id } })).toBe(0);
    const after = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(after.epigeneticModifiers).toEqual(modifiers);
    expect(after.epigeneticFlags).toEqual([]);
    expect(traitsApi).not.toHaveProperty('evaluateAndPersistUltraRareTraits');
  }, 60_000);
});

describe('no adult discovery (Equoria-kqdde)', () => {
  it('an adult horse meets exactly the conditions a foal with the same bond meets', async () => {
    const adult = await checkDiscoveryConditions({ id: -1, age: 4, bondScore: 100 });
    const foal = await checkDiscoveryConditions({ id: -1, age: 1, bondScore: 100 });
    expect(adult).toEqual(foal);
  });
});
