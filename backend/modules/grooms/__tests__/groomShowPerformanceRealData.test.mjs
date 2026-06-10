/**
 * Equoria-axad9.1 — groom showPerformance metric must derive from REAL
 * persisted conformation results, not the hardcoded 75 placeholder.
 *
 * BEFORE: calculatePerformanceMetrics() set `showPerformance = 75` for every
 * groom unconditionally — a fabricated value feeding the weighted reputation
 * score (15% weight) regardless of the groom's actual show record.
 *
 * AFTER: updateGroomMetrics() derives showPerformance from
 * deriveShowPerformance(groomId), which averages the persisted
 * CompetitionResult scores (discipline 'conformation') across the horses the
 * groom has handled. With no show history it falls back to the explicit named
 * neutral baseline (50), NOT 75.
 *
 * Real-DB integration — no mocks. The metric is recomputed as a side effect of
 * recordGroomPerformance() → updateGroomMetrics(), then read back from the
 * persisted GroomMetrics row.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  PERFORMANCE_CONFIG,
  recordGroomPerformance,
} from '../services/groomPerformanceService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('groom showPerformance — real persisted data (Equoria-axad9.1)', () => {
  let user;
  let provenGroom; // handled a horse with a high conformation result
  let unprovenGroom; // no show history
  let provenHorse;
  let show;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    user = await prisma.user.create({
      data: {
        email: `gsp-${ts}-${rand()}@test.com`,
        username: `gsp${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GSP',
        lastName: 'Tester',
        money: 1000,
      },
    });

    provenHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GSP-Horse-${ts}-${rand()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: user.id,
        healthStatus: 'Good',
      },
    });

    provenGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GSP-Proven-${ts}-${rand()}`,
        speciality: 'showHandling',
        personality: 'gentle',
        showHandlingSkill: 'expert',
        userId: user.id,
      },
    });

    unprovenGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GSP-Unproven-${ts}-${rand()}`,
        speciality: 'general',
        personality: 'gentle',
        userId: user.id,
      },
    });

    // provenGroom handled provenHorse.
    await prisma.groomAssignment.create({
      data: {
        groomId: provenGroom.id,
        foalId: provenHorse.id,
        userId: user.id,
        isActive: true,
        priority: 1,
      },
    });

    // A conformation show + a persisted high-score result for provenHorse.
    show = await prisma.show.create({
      data: {
        name: `TestFixture-GSP-Show-${ts}-${rand()}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });
    await prisma.competitionResult.create({
      data: {
        horseId: provenHorse.id,
        showId: show.id,
        score: 90,
        placement: '1',
        discipline: 'conformation',
        runDate: new Date(),
        showName: show.name,
        prizeWon: 0,
      },
    });

    // FK-ordered scoped fail-loud cleanup. groom_performance_records + metrics
    // + assignments cascade from groom delete; competition_results + entries
    // cascade from show delete; horses then user.
    cleanup.add(
      () => prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-GSP-' } } }),
      'show',
    );
    cleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GSP-' } } }),
      'groom',
    );
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GSP-' } } }),
      'horse',
    );
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : undefined), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('derives showPerformance from the real conformation result (90), not the old hardcoded 75', async () => {
    // Recording a performance triggers updateGroomMetrics → deriveShowPerformance.
    await recordGroomPerformance(provenGroom.id, user.id, 'grooming', {
      horseId: provenHorse.id,
      bondGain: 4,
      taskSuccess: true,
      wellbeingImpact: 2,
      duration: 30,
      playerRating: 5,
    });

    const metrics = await prisma.groomMetrics.findUnique({ where: { groomId: provenGroom.id } });
    expect(metrics).not.toBeNull();
    // The real average conformation score is 90 — NOT the old placeholder 75.
    expect(metrics.showPerformance).toBe(90);
    expect(metrics.showPerformance).not.toBe(75);
  });

  it('falls back to the named neutral baseline (50) for a groom with no show history (not 75)', async () => {
    await recordGroomPerformance(unprovenGroom.id, user.id, 'grooming', {
      horseId: provenHorse.id,
      bondGain: 3,
      taskSuccess: true,
      wellbeingImpact: 1,
      duration: 20,
      playerRating: 4,
    });

    const metrics = await prisma.groomMetrics.findUnique({ where: { groomId: unprovenGroom.id } });
    expect(metrics).not.toBeNull();
    expect(metrics.showPerformance).toBe(PERFORMANCE_CONFIG.NEUTRAL_SHOW_PERFORMANCE);
    expect(PERFORMANCE_CONFIG.NEUTRAL_SHOW_PERFORMANCE).toBe(50);
    expect(metrics.showPerformance).not.toBe(75);
  });
});
