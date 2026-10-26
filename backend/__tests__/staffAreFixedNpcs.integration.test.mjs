/**
 * staffAreFixedNpcs.integration.test.mjs (Equoria-dea06)
 *
 * OWNER RULINGS
 *   2026-10-21: "Trainers do not gain xp. Only players do. Trainers are just
 *   game generated NPCs." Confirmed the same day for ALL staff: trainers,
 *   riders and grooms are fixed NPCs. None earns XP from training sessions,
 *   shows or grooming interactions; each keeps the level it was generated with.
 *   2026-10-19/20: training only adds +5 to the trained discipline's score; it
 *   never raises a horse stat. The player still earns XP for training.
 *
 * WHAT FAILED BEFORE THE FIX
 *   - trainHorse awarded the assigned trainer 5 XP and recomputed its level.
 *   - executeClosedShows awarded the assigned rider 5..30 XP per show and
 *     recomputed its level.
 *   - recordInteraction awarded the groom 2 XP per session inside its tx.
 *
 * Each path below runs the REAL production entry point against the real DB
 * (no mocks), with a staff member whose generated experience/level are not the
 * level the XP curve would give it, and asserts both columns are untouched.
 * The training path also pins the stat contract: the 12 horse stats are
 * unchanged and the trained discipline gains exactly +5.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';
import { trainHorse } from '../modules/training/controllers/trainingController.mjs';
import { executeClosedShows } from '../modules/competition/shows/showExecutionService.mjs';
import { recordInteraction } from '../modules/grooms/controllers/groomInteractionController.mjs';

const tag = () => randomBytes(6).toString('hex');
const PREFIX = 'TestFixture-dea06';
// Two trackers, because a tracker runs its callbacks in registration order:
// `cleanup` holds each test's dependants; `baseCleanup` (horses, user) runs after.
const cleanup = createCleanupTracker();
const baseCleanup = createCleanupTracker();

// Generated staff values that are deliberately NOT where the 100*level XP
// curve would put them, so neither an XP award nor a level recompute can
// leave them looking unchanged by coincidence.
const staffExperience = 37;
const staffLevel = 4;

// The 12 horse stats (constants/schema.mjs HORSE_STATS), listed here as an
// independent pin of "training changes no stat".
const horseStats = [
  'speed',
  'stamina',
  'agility',
  'endurance',
  'strength',
  'precision',
  'balance',
  'intelligence',
  'focus',
  'obedience',
  'boldness',
  'flexibility',
];

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

let user;
const horseIds = [];

beforeAll(async () => {
  const suffix = tag();
  user = await prisma.user.create({
    data: {
      username: `${PREFIX}-${suffix}`.slice(0, 30),
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Fixed',
      lastName: 'Npc',
      money: 5000,
      xp: 0,
      level: 1,
      settings: {},
    },
  });
  baseCleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  baseCleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: user.id } }), 'xpEvents');
  baseCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(async () => {
  try {
    await cleanup.run();
  } finally {
    await baseCleanup.run();
  }
}, 60000);

describe('Equoria-dea06 — staff are fixed NPCs (no XP, generated level kept)', () => {
  it('training: the trainer gains no XP, and the horse gains only +5 in the trained discipline', async () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const stats = Object.fromEntries(horseStats.map((s, i) => [s, 40 + i]));
    const horse = await createTestHorse(
      prisma,
      {
        name: `${PREFIX}-train-${tag()}`,
        sex: 'Mare',
        age: 5,
        dateOfBirth: fiveYearsAgo,
        userId: user.id,
        temperament: 'Calm',
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
        trainingCooldown: null,
        disciplineScores: { Racing: 12 },
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        ...stats,
      },
      horseIds,
    );
    // novice (+0.02), wrong speciality, patient has no Calm cell → net +0.02,
    // round(5 × 1.02) = 5: the trainer is present but leaves the +5 intact.
    const trainer = await prisma.trainer.create({
      data: {
        firstName: 'TestFixture',
        lastName: `dea06-Trainer-${tag()}`,
        personality: 'patient',
        skillLevel: 'novice',
        speciality: 'Racing',
        experience: staffExperience,
        level: staffLevel,
        userId: user.id,
      },
    });
    cleanup.add(() => prisma.trainerAssignment.deleteMany({ where: { trainerId: trainer.id } }), 'trainerAssignment');
    cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: horse.id } }), 'trainingLog');
    cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: horse.id } }), 'horseXpEvent');
    cleanup.add(() => prisma.trainer.delete({ where: { id: trainer.id } }), 'trainer');
    await prisma.trainerAssignment.create({
      data: { trainerId: trainer.id, horseId: horse.id, userId: user.id, isActive: true },
    });

    const userBefore = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });

    const result = await trainHorse(horse.id, 'Dressage');
    expect(result.success).toBe(true);
    expect(result.disciplineScoreIncrease).toBe(5);

    const trainerAfter = await prisma.trainer.findUnique({
      where: { id: trainer.id },
      select: { experience: true, level: true },
    });
    expect(trainerAfter).toEqual({ experience: staffExperience, level: staffLevel });

    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { ...Object.fromEntries(horseStats.map(s => [s, true])), disciplineScores: true },
    });
    for (const stat of horseStats) {
      expect({ stat, value: horseAfter[stat] }).toEqual({ stat, value: stats[stat] });
    }
    expect(horseAfter.disciplineScores).toEqual({ Racing: 12, Dressage: 5 });

    // The player's training XP stays (owner ruling 2026-10-20).
    const userAfter = await prisma.user.findUnique({ where: { id: user.id }, select: { xp: true } });
    expect(userAfter.xp).toBeGreaterThan(userBefore.xp);
  }, 60000);

  // Owner ruling 2026-10-22 (Equoria-0d4wa): rider prestige also stays at its
  // generated value - a win never raises it (old contract: +2 for 1st, +1 for 2nd).
  it('shows: the rider gains no XP or prestige and keeps its generated level', async () => {
    const horse = await createTestHorse(
      prisma,
      {
        name: `${PREFIX}-show-${tag()}`,
        sex: 'Mare',
        age: 7,
        dateOfBirth: new Date('2018-01-01'),
        userId: user.id,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      },
      horseIds,
    );
    const rider = await prisma.rider.create({
      data: {
        firstName: 'TestFixture',
        lastName: `dea06-Rider-${tag()}`,
        personality: 'methodical',
        skillLevel: 'developing',
        speciality: 'Dressage',
        experience: staffExperience,
        level: staffLevel,
        prestige: 40,
        userId: user.id,
      },
    });
    const pastClose = new Date(Date.now() - 60 * 60 * 1000);
    const show = await prisma.show.create({
      data: {
        name: `${PREFIX}-show-${tag()}`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: pastClose,
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastClose,
        createdByUserId: user.id,
      },
    });
    cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: show.id } }), 'competitionResult');
    cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: show.id } }), 'showEntry');
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { riderId: rider.id } }), 'riderAssignment');
    cleanup.add(() => prisma.show.delete({ where: { id: show.id } }), 'show');
    cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: horse.id } }), 'horseXpEvent');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    cleanup.add(() => prisma.rider.delete({ where: { id: rider.id } }), 'rider');
    await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: user.id, isActive: true },
    });
    await prisma.showEntry.create({
      data: { showId: show.id, horseId: horse.id, userId: user.id, feePaid: 0 },
    });

    // Scoped execute — never unscoped against the shared database.
    await executeClosedShows({ body: { showIds: [show.id] } }, null);

    const results = await prisma.competitionResult.findMany({ where: { showId: show.id } });
    expect(results).toHaveLength(1);

    const riderAfter = await prisma.rider.findUnique({
      where: { id: rider.id },
      select: { experience: true, level: true, totalCompetitions: true, prestige: true },
    });
    expect(results[0].placement).toBe(1);
    expect(riderAfter.prestige).toBe(40);
    expect(riderAfter.experience).toBe(staffExperience);
    expect(riderAfter.level).toBe(staffLevel);
    // The ride itself is still on the rider's record.
    expect(riderAfter.totalCompetitions).toBe(1);
  }, 60000);

  it('grooming: the groom gains no XP and keeps its generated level', async () => {
    const suffix = tag();
    const foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-foal-${suffix}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -60),
        age: 0,
        userId: user.id,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
        bondScore: 40,
      },
    });
    horseIds.push(foal.id);
    const groom = await prisma.groom.create({
      data: {
        name: `${PREFIX}-groom-${suffix}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'expert',
        sessionRate: 40,
        startAge: 20,
        experience: staffExperience,
        level: staffLevel,
        userId: user.id,
      },
    });
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom.id } }), 'groomInteractions');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: foal.id } }), 'foalActivities');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: groom.id } }), 'groomSynergies');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: groom.id } }), 'groomAssignments');
    cleanup.add(() => prisma.groomEngagement.deleteMany({ where: { groomId: groom.id } }), 'groomEngagements');
    cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: foal.id, userId: user.id, isActive: true },
    });

    const res = fakeRes();
    await recordInteraction(
      {
        user: { id: user.id },
        body: { foalId: foal.id, groomId: groom.id, interactionType: 'desensitization', duration: 30 },
      },
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(await prisma.groomInteraction.count({ where: { groomId: groom.id } })).toBe(1);

    const groomAfter = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { experience: true, level: true },
    });
    expect(groomAfter).toEqual({ experience: staffExperience, level: staffLevel });
  }, 60000);
});
