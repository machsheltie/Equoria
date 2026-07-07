/**
 * 🧪 INTEGRATION TEST (real DB, no mocks): Training eligibility — max-age + injury gates
 *
 * Equoria-oey96.15 — audit finding P2-5. computeCanTrain historically enforced
 * only the MINIMUM age (< 3) plus the Gaited-trait requirement and the 7-day
 * cooldown. It enforced NEITHER:
 *   - the MAXIMUM active age (PRD-03 §1.1 / game-balance-formulas §5: active
 *     3..20 inclusive, retires at 21), nor
 *   - the injury/health gate that SECURITY.md A04 already CLAIMS is implemented
 *     ("Injured horses cannot train").
 *
 * This suite pins the corrected contract:
 *   (a) age exactly 20 → eligible  (inclusive boundary)
 *   (b) age 21         → ineligible with a DISTINCT reason (not the age<3 msg)
 *   (c) injured horse  → ineligible with a DISTINCT injury reason
 *   (d) healthy 3..20  → eligible (control / regression pin for the happy path)
 *
 * Canonical age policy: backend/constants/horseAgePolicy.mjs
 * Age reads go through getHorseAgeYears (Equoria-vdw5) — never inline ms-math.
 * Game-year cadence: 1 game-year = 7 real days (floor(realDays / 7)).
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { canTrain } from '../../training/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const GAME_YEAR_MS = 7 * 24 * 60 * 60 * 1000;
// Backdate dateOfBirth to a whole game-age with a +1 day buffer so floor()
// lands cleanly inside the intended game-year and never rounds down near the
// day boundary (mirrors the existing training-suite convention).
const gameAgeDob = years => new Date(Date.now() - (years * GAME_YEAR_MS + 24 * 60 * 60 * 1000));

let testUser;
let testBreedId;
let horse20;
let horse21;
let horse21NoAgeField;
let horseInjured;
let horseHealthy;

describe('🏋️ INTEGRATION: Training eligibility — max-age (20) + injury gates (Equoria-oey96.15)', () => {
  beforeAll(async () => {
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `TestFixture-oey96-15-user-${timestamp}`,
        email: `testfixture-oey96-15-${timestamp}@test.com`,
        password: 'hashed_password',
        firstName: 'Age',
        lastName: 'Gate',
        money: 5000,
        xp: 0,
        level: 1,
      },
    });

    const testBreed = await prisma.breed.create({
      data: {
        name: `TestFixture-oey96-15-breed-${timestamp}`,
        description: 'Age/health gate test breed',
      },
    });
    testBreedId = testBreed.id;

    // Age exactly 20 — the last active game-year (inclusive max). Eligible.
    horse20 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-oey96-15-age20-${timestamp}`,
        dateOfBirth: gameAgeDob(20),
        age: 20,
        sex: 'Mare',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Excellent',
      },
    });

    // Age 21 — retired / over the active max. Ineligible.
    horse21 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-oey96-15-age21-${timestamp}`,
        dateOfBirth: gameAgeDob(21),
        age: 21,
        sex: 'Stallion',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Excellent',
      },
    });

    // Age 21 via dateOfBirth ONLY (age column null) — proves the gate reads age
    // through the getHorseAgeYears fallback (Equoria-vdw5), not just the stored
    // age integer. effectiveAge derives from getHorseAge → getHorseAgeYears here.
    horse21NoAgeField = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-oey96-15-age21-dob-${timestamp}`,
        dateOfBirth: gameAgeDob(21),
        age: null,
        sex: 'Mare',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Excellent',
      },
    });

    // Age 5, INJURED — healthy age but cannot train while injured.
    horseInjured = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-oey96-15-injured-${timestamp}`,
        dateOfBirth: gameAgeDob(5),
        age: 5,
        sex: 'Mare',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Injured',
      },
    });

    // Age 5, Excellent — control / happy path. Eligible.
    horseHealthy = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-oey96-15-healthy-${timestamp}`,
        dateOfBirth: gameAgeDob(5),
        age: 5,
        sex: 'Stallion',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Excellent',
      },
    });
  });

  afterAll(async () => {
    const ids = [horse20?.id, horse21?.id, horse21NoAgeField?.id, horseInjured?.id, horseHealthy?.id].filter(Boolean);
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: ids } } });
    await prisma.horse.deleteMany({ where: { id: { in: ids } } });
    if (testBreedId) {
      await prisma.breed.deleteMany({ where: { id: testBreedId } });
    }
    if (testUser?.id) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
    // Do NOT $disconnect — the shared ESM client is torn down globally.
  });

  describe('max-age gate (inclusive 20; retires at 21)', () => {
    it('age exactly 20 is ELIGIBLE (inclusive boundary)', async () => {
      const result = await canTrain(horse20.id, 'Dressage');
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('age 21 is INELIGIBLE with a distinct too-old reason', async () => {
      const result = await canTrain(horse21.id, 'Dressage');
      expect(result.eligible).toBe(false);
      // Distinct from the age<3 message ("Horse is under age").
      expect(result.reason).toBe('Horse is too old to train');
      expect(result.reason).not.toBe('Horse is under age');
    });

    it('age 21 via dateOfBirth only (age column null) is INELIGIBLE — proves the getHorseAgeYears path reaches the gate', async () => {
      const result = await canTrain(horse21NoAgeField.id, 'Dressage');
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Horse is too old to train');
    });
  });

  describe('injury gate', () => {
    it('an injured horse is INELIGIBLE with a distinct injury reason', async () => {
      const result = await canTrain(horseInjured.id, 'Dressage');
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Horse is injured and cannot train');
    });
  });

  describe('control (regression pin)', () => {
    it('a healthy horse aged 3..20 is ELIGIBLE', async () => {
      const result = await canTrain(horseHealthy.id, 'Dressage');
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeNull();
    });
  });
});
