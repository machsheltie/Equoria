/**
 * A visitor sees everything on a horse's page, read-only (owner rulings
 * 2026-10-28: q205 Care Team and "they can see everything on a horse's page";
 * q215 the show record; q174 / q213 Trait Discovery with a hidden COUNT and
 * dormant traits by name; q214 the coat shade).
 *
 * GET /horses/:id/visit, through the real app and the real test database, as
 * another player. Hidden trait names and the genotype still never leave.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestShow } from '../../tests/helpers/testAuth.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

const hiddenKeys = ['heart', 'competitive'];

describe('GET /horses/:id/visit shows the whole horse page (q205)', () => {
  const tag = randomBytes(4).toString('hex');
  let owner;
  let visitor;
  let breed;
  let horse;
  const shows = [];
  const staff = {};

  beforeAll(async () => {
    owner = await createTestUser({ role: 'user' });
    visitor = await createTestUser({ role: 'user' });
    breed = await prisma.breed.create({ data: { name: `VisitWholeBreed ${tag}` } });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        phenotype: {
          colorName: 'Bay',
          shade: 'dark',
          faceMarking: 'blaze',
          legMarkings: { frontLeft: 'sock' },
        },
        name: `VisitWholeHorse ${tag}`,
        sex: 'Mare',
        temperament: 'Willing',
        dateOfBirth: gameCalendarDate(new Date(), -40),
        horseXp: 2350,
        breed: { connect: { id: breed.id } },
        user: { connect: { id: owner.user.id } },
        epigeneticModifiers: {
          positive: ['resilient'],
          negative: [],
          hidden: hiddenKeys,
          dormant: ['fearful'],
        },
      },
    });
    // One result per show and horse (unique), so one show per placing.
    const placings = [1, 1, 2, 3, 5];
    for (const [i] of placings.entries()) {
      shows.push(await createTestShow({ name: `VisitWholeShow ${tag} ${i}`, discipline: 'Dressage' }));
    }
    const result = (placement, show) => ({
      horseId: horse.id,
      showId: show.id,
      score: 80,
      placement,
      discipline: 'Dressage',
      runDate: new Date('2026-06-01T10:00:00Z'),
      showName: show.name,
      prizeWon: placement === 1 ? 500 : 100,
    });
    await prisma.competitionResult.createMany({
      data: placings.map((placement, i) => result(placement, shows[i])),
    });
    staff.trainer = await prisma.trainer.create({
      data: {
        firstName: 'Alice',
        lastName: `Thornton${tag}`,
        personality: 'focused',
        skillLevel: 'novice',
        starLevel: 'advanced',
        speciality: 'Dressage',
        userId: owner.user.id,
      },
      select: { id: true },
    });
    await prisma.trainerAssignment.create({
      data: { trainerId: staff.trainer.id, horseId: horse.id, userId: owner.user.id },
    });
    staff.groom = await prisma.groom.create({
      data: {
        name: `Maya ${tag}`,
        speciality: 'foalCare',
        personality: 'gentle',
        starLevel: 'novice',
        userId: owner.user.id,
      },
      select: { id: true },
    });
    await prisma.groomAssignment.create({
      data: { foalId: horse.id, groomId: staff.groom.id, userId: owner.user.id },
    });
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(
      () => (horse ? prisma.competitionResult.deleteMany({ where: { horseId: horse.id } }) : null),
      'results',
    );
    cleanup.add(
      () => (horse ? prisma.trainerAssignment.deleteMany({ where: { horseId: horse.id } }) : null),
      'trainer assignment',
    );
    cleanup.add(
      () => (horse ? prisma.groomAssignment.deleteMany({ where: { foalId: horse.id } }) : null),
      'groom assignment',
    );
    cleanup.add(
      () => (staff.trainer ? prisma.trainer.deleteMany({ where: { id: staff.trainer.id } }) : null),
      'trainer',
    );
    cleanup.add(() => (staff.groom ? prisma.groom.deleteMany({ where: { id: staff.groom.id } }) : null), 'groom');
    cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: shows.map(s => s.id) } } }), 'shows');
    cleanup.add(() => (horse ? prisma.horse.deleteMany({ where: { id: horse.id } }) : null), 'horse');
    cleanup.add(() => (breed ? prisma.breed.deleteMany({ where: { id: breed.id } }) : null), 'breed');
    cleanup.add(
      () => prisma.user.deleteMany({ where: { id: { in: [owner?.user.id, visitor?.user.id].filter(Boolean) } } }),
      'users',
    );
    await cleanup.run();
  });

  it('carries the show record, horse details, care team and trait discovery, and no hidden name', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/visit`)
      .set('Authorization', `Bearer ${visitor.token}`);

    expect(res.status).toBe(200);
    const view = res.body.data;
    expect(view.isOwn).toBe(false);
    expect(view.showRecord).toEqual({
      wins: 2,
      secondPlaces: 1,
      thirdPlaces: 1,
      winnings: 1300,
      points: 2350,
    });
    expect(view).toMatchObject({
      colorName: 'Bay',
      shade: 'dark',
      faceMarking: 'blaze',
      legMarkings: { frontLeft: 'sock' },
      temperament: 'Willing',
    });
    expect(typeof view.dateOfBirth).toBe('string');
    expect(view.careTeam).toEqual({
      trainer: { name: `Alice Thornton${tag}`, starLevel: 'advanced' },
      groom: { name: `Maya ${tag}`, starLevel: 'novice' },
      rider: null,
    });
    expect(view.traitDiscovery.positive.map(t => t.label)).toEqual(['Resilient']);
    expect(view.traitDiscovery.dormant.map(t => t.label)).toEqual(['Fearful']);
    expect(view.traitDiscovery.hiddenCount).toBe(2);

    const body = JSON.stringify(res.body);
    for (const key of hiddenKeys) {
      expect(body).not.toContain(key);
    }
    expect(body).not.toContain('rarity');
    expect(view).not.toHaveProperty('colorGenotype');
    expect(view).not.toHaveProperty('userId');
  });
});
