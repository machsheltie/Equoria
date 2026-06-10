/**
 * Equoria-axad9.1 — TECH DEBT: scoring paths must not invent groom/class data.
 *
 * This real-DB integration test proves the no-longer-fabricated behavior of
 * executeConformationShow():
 *
 *   BEFORE: when a show entry had no active groom assignment at execution time,
 *   the service silently fabricated a `{ showHandlingSkill: 'novice',
 *   personality: 'gentle' }` placeholder groom and scored the horse as if it
 *   had a real handler — awarding a real handler-score component (20*0.20 = 4pt)
 *   + synergy to a horse with no handler.
 *
 *   AFTER: the service fails honest — it throws ConformationGroomMissingError
 *   (statusCode 400) naming the affected horse id(s), and persists NO
 *   CompetitionResult for the show. A handler is required for every entry
 *   (the same invariant validateConformationEntry enforces at entry time).
 *
 * No mocks — real Express-free service call against the canonical DB with
 * scoped TestFixture- fixtures and fail-loud scoped cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  executeConformationShow,
  ConformationGroomMissingError,
} from '../services/conformationShowService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('executeConformationShow — no fabricated groom (Equoria-axad9.1)', () => {
  let user;
  let horseWithGroom;
  let horseNoGroom;
  let groom;
  let showMissingGroom;
  let showAllGroomed;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    user = await prisma.user.create({
      data: {
        email: `axad-${ts}-${rand()}@test.com`,
        username: `axad${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'Axad',
        lastName: 'Tester',
        money: 1000,
      },
    });

    horseWithGroom = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-AXAD-Groomed-${ts}-${rand()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: user.id,
        healthStatus: 'Good',
        bondScore: 50,
      },
    });

    horseNoGroom = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-AXAD-NoGroom-${ts}-${rand()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: user.id,
        healthStatus: 'Good',
        bondScore: 50,
      },
    });

    groom = await prisma.groom.create({
      data: {
        name: `TestFixture-AXAD-Groom-${ts}-${rand()}`,
        speciality: 'showHandling',
        personality: 'gentle',
        showHandlingSkill: 'expert',
        userId: user.id,
      },
    });

    // Active assignment ONLY for horseWithGroom.
    await prisma.groomAssignment.create({
      data: {
        groomId: groom.id,
        foalId: horseWithGroom.id,
        userId: user.id,
        isActive: true,
        priority: 1,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    });

    // Show whose single entry (horseNoGroom) has NO active groom → must fail honest.
    showMissingGroom = await prisma.show.create({
      data: {
        name: `TestFixture-AXAD-MissingGroomShow-${ts}-${rand()}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });
    await prisma.showEntry.create({
      data: { showId: showMissingGroom.id, horseId: horseNoGroom.id, userId: user.id },
    });

    // Show whose single entry (horseWithGroom) has a real active groom → succeeds.
    showAllGroomed = await prisma.show.create({
      data: {
        name: `TestFixture-AXAD-AllGroomedShow-${ts}-${rand()}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });
    await prisma.showEntry.create({
      data: { showId: showAllGroomed.id, horseId: horseWithGroom.id, userId: user.id },
    });

    // FK-ordered, scoped, fail-loud cleanup.
    cleanup.add(
      () => prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-AXAD-' } } }),
      'show',
    );
    cleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-AXAD-' } } }),
      'groom',
    );
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-AXAD-' } } }),
      'horse',
    );
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : undefined), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('throws ConformationGroomMissingError (400) and persists NO result when an entry has no active groom', async () => {
    await expect(executeConformationShow(showMissingGroom.id)).rejects.toBeInstanceOf(
      ConformationGroomMissingError,
    );

    // The error names the affected horse and carries statusCode 400.
    let caught;
    try {
      await executeConformationShow(showMissingGroom.id);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
    expect(caught.horseIds).toContain(horseNoGroom.id);

    // No fabricated score was persisted for the handler-less horse.
    const persisted = await prisma.competitionResult.findFirst({
      where: { horseId: horseNoGroom.id, showId: showMissingGroom.id },
    });
    expect(persisted).toBeNull();

    // The show was NOT marked completed (the throw rolls back the transaction).
    const showAfter = await prisma.show.findUnique({ where: { id: showMissingGroom.id } });
    expect(showAfter.status).not.toBe('completed');
  });

  it('still scores + persists normally when every entry has a real active groom', async () => {
    const results = await executeConformationShow(showAllGroomed.id);
    expect(results).toHaveLength(1);
    expect(results[0].horseId).toBe(horseWithGroom.id);
    expect(typeof results[0].score).toBe('number');

    const persisted = await prisma.competitionResult.findFirst({
      where: { horseId: horseWithGroom.id, showId: showAllGroomed.id },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.discipline).toBe('conformation');
  });
});
