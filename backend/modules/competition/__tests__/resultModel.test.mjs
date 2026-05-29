/**
 * Result Model Tests
 *
 * Input validation tests run without any DB access (validation throws
 * before reaching any Prisma call).  All other tests use real DB
 * fixtures under the TestFixture-ResultModel- prefix.
 *
 * Cleanup strategy:
 *   - beforeAll: delete any stale fixtures from previous runs
 *   - per-test try/finally: delete horse (cascades → competitionResults),
 *     then delete show
 *   - afterAll: final safety-net sweep
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  saveResult,
  getResultsByHorse,
  getResultsByShow,
  getResultById,
  createResult,
  getResultsByUser,
} from '../../../models/resultModel.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-ResultModel-';
const USER_ID = 'test-user-result-model';
const RUN_DATE = new Date('2024-06-15');

async function mkHorse(suffix) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse-${suffix}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
      age: 4,
      userId: USER_ID,
    },
  });
}

async function rmHorse(id) {
  await prisma.horse.delete({ where: { id } }).catch(() => {});
}

async function mkShow(suffix) {
  return prisma.show.create({
    data: {
      name: `${PREFIX}Show-${suffix}`,
      discipline: 'Racing',
      levelMin: 0,
      levelMax: 10,
      entryFee: 100,
      prize: 500,
      runDate: new Date(),
    },
  });
}

async function rmShow(id) {
  await prisma.show.delete({ where: { id } }).catch(() => {});
}

// Normalise Prisma Decimal fields to JS number for assertions
function toNum(v) {
  return typeof v === 'number' ? v : parseFloat(v.toString());
}

beforeAll(async () => {
  // Stale-fixture sweep — Show cascade-deletes its CompetitionResults
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: {
      id: USER_ID,
      username: 'resultModelUser',
      email: 'resultmodel@example.com',
      password: 'TestPassword123!',
      firstName: 'Result',
      lastName: 'Model',
      money: 5000,
    },
  });
});

afterAll(async () => {
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

// ─── saveResult – input validation (no DB needed) ─────────────────────────────

describe('saveResult - input validation', () => {
  it('throws if horseId is missing', async () => {
    await expect(
      saveResult({ showId: 2, score: 85.5, discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Horse ID is required');
  });

  it('throws if showId is missing', async () => {
    await expect(
      saveResult({ horseId: 1, score: 85.5, discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Show ID is required');
  });

  it('throws if score is missing', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 2, discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Score is required');
  });

  it('throws if discipline is missing', async () => {
    await expect(saveResult({ horseId: 1, showId: 2, score: 85.5, runDate: RUN_DATE, showName: 'X' })).rejects.toThrow(
      'Discipline is required',
    );
  });

  it('throws if runDate is missing', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 2, score: 85.5, discipline: 'Racing', showName: 'X' }),
    ).rejects.toThrow('Run date is required');
  });

  it('throws if showName is missing', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 2, score: 85.5, discipline: 'Racing', runDate: RUN_DATE }),
    ).rejects.toThrow('Show name is required');
  });

  it('throws if showName is not a string', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 2, score: 85.5, discipline: 'Racing', runDate: RUN_DATE, showName: 123 }),
    ).rejects.toThrow('Show name is required');
  });

  it('throws if score is not a number', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 2, score: 'invalid', discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Score must be a number');
  });

  it('throws if horseId is a negative integer', async () => {
    await expect(
      saveResult({ horseId: -1, showId: 2, score: 85.5, discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Horse ID must be a positive integer');
  });

  it('throws if showId is zero', async () => {
    await expect(
      saveResult({ horseId: 1, showId: 0, score: 85.5, discipline: 'Racing', runDate: RUN_DATE, showName: 'X' }),
    ).rejects.toThrow('Show ID must be a positive integer');
  });
});

// ─── saveResult – database behaviour ─────────────────────────────────────────

describe('saveResult - database behaviour', () => {
  it('creates a new result when no placeholder exists', async () => {
    const horse = await mkHorse('Save1');
    const show = await mkShow('Save1');
    try {
      const result = await saveResult({
        horseId: horse.id,
        showId: show.id,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: RUN_DATE,
        showName: show.name,
        prizeWon: 500,
        statGains: { stat: 'speed', gain: 1 },
      });

      expect(result.horseId).toBe(horse.id);
      expect(result.showId).toBe(show.id);
      expect(toNum(result.score)).toBe(85.5);
      expect(result.placement).toBe('1st');
      expect(toNum(result.prizeWon)).toBe(500);
      expect(result.horse.id).toBe(horse.id);
      expect(result.show.id).toBe(show.id);
      // statGains stored as JSON-stringified string
      expect(JSON.parse(result.statGains)).toEqual({ stat: 'speed', gain: 1 });
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });

  it('creates a result with null placement and default prizeWon=0', async () => {
    const horse = await mkHorse('Save2');
    const show = await mkShow('Save2');
    try {
      const result = await saveResult({
        horseId: horse.id,
        showId: show.id,
        score: 65.2,
        placement: null,
        discipline: 'Racing',
        runDate: RUN_DATE,
        showName: show.name,
        // prizeWon omitted — should default to 0
      });

      expect(result.placement).toBeNull();
      expect(toNum(result.prizeWon)).toBe(0);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });

  it('converts string prizeWon to float before storing', async () => {
    const horse = await mkHorse('Save3');
    const show = await mkShow('Save3');
    try {
      const result = await saveResult({
        horseId: horse.id,
        showId: show.id,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: RUN_DATE,
        showName: show.name,
        prizeWon: '500.75',
      });

      expect(toNum(result.prizeWon)).toBeCloseTo(500.75, 2);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });

  it('updates an existing placeholder result instead of creating a new record', async () => {
    const horse = await mkHorse('Save4');
    const show = await mkShow('Save4');
    try {
      const placeholder = await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show.id,
          score: 0,
          placement: null,
          discipline: 'Racing',
          runDate: RUN_DATE,
          showName: show.name,
          prizeWon: 0,
        },
      });

      const result = await saveResult({
        horseId: horse.id,
        showId: show.id,
        score: 85.5,
        placement: '1st',
        discipline: 'Racing',
        runDate: RUN_DATE,
        showName: show.name,
        prizeWon: 500,
      });

      // Same ID proves it was an UPDATE, not a CREATE
      expect(result.id).toBe(placeholder.id);
      expect(toNum(result.score)).toBe(85.5);
      expect(result.placement).toBe('1st');
      expect(toNum(result.prizeWon)).toBe(500);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });
});

// ─── getResultsByHorse ────────────────────────────────────────────────────────

describe('getResultsByHorse', () => {
  it('throws for negative horseId', async () => {
    await expect(getResultsByHorse(-1)).rejects.toThrow('Horse ID must be a positive integer');
  });

  it('throws for non-numeric string horseId', async () => {
    await expect(getResultsByHorse('invalid')).rejects.toThrow('Horse ID must be a positive integer');
  });

  it('returns empty array when horse has no results', async () => {
    const horse = await mkHorse('GBH1');
    try {
      const results = await getResultsByHorse(horse.id);
      expect(results).toEqual([]);
    } finally {
      await rmHorse(horse.id);
    }
  });

  it('returns results ordered by runDate desc and includes horse + show relations', async () => {
    const horse = await mkHorse('GBH2');
    const show1 = await mkShow('GBH2a');
    const show2 = await mkShow('GBH2b');
    try {
      const earlier = new Date('2024-03-01');
      const later = new Date('2024-06-01');
      await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show1.id,
          score: 80,
          placement: '2nd',
          discipline: 'Racing',
          runDate: earlier,
          showName: show1.name,
          prizeWon: 0,
        },
      });
      await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show2.id,
          score: 90,
          placement: '1st',
          discipline: 'Racing',
          runDate: later,
          showName: show2.name,
          prizeWon: 0,
        },
      });

      const results = await getResultsByHorse(horse.id);

      expect(results.length).toBe(2);
      expect(new Date(results[0].runDate) >= new Date(results[1].runDate)).toBe(true);
      expect(results[0].horse).toBeDefined();
      expect(results[0].show).toBeDefined();
    } finally {
      await rmHorse(horse.id);
      await rmShow(show1.id);
      await rmShow(show2.id);
    }
  });

  it('accepts a string horse ID (converts to integer)', async () => {
    const horse = await mkHorse('GBH3');
    try {
      const results = await getResultsByHorse(String(horse.id));
      expect(Array.isArray(results)).toBe(true);
    } finally {
      await rmHorse(horse.id);
    }
  });
});

// ─── getResultsByShow ─────────────────────────────────────────────────────────

describe('getResultsByShow', () => {
  it('throws for negative showId', async () => {
    await expect(getResultsByShow(-1)).rejects.toThrow('Show ID must be a positive integer');
  });

  it('throws for non-numeric string showId', async () => {
    await expect(getResultsByShow('invalid')).rejects.toThrow('Show ID must be a positive integer');
  });

  it('returns empty array when show has no results', async () => {
    const show = await mkShow('GBS1');
    try {
      const results = await getResultsByShow(show.id);
      expect(results).toEqual([]);
    } finally {
      await rmShow(show.id);
    }
  });

  it('returns results ordered by score desc and includes horse + show relations', async () => {
    const horse1 = await mkHorse('GBS2a');
    const horse2 = await mkHorse('GBS2b');
    const show = await mkShow('GBS2');
    try {
      await prisma.competitionResult.create({
        data: {
          horseId: horse1.id,
          showId: show.id,
          score: 75,
          placement: '2nd',
          discipline: 'Racing',
          runDate: new Date(),
          showName: show.name,
          prizeWon: 0,
        },
      });
      await prisma.competitionResult.create({
        data: {
          horseId: horse2.id,
          showId: show.id,
          score: 90,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date(),
          showName: show.name,
          prizeWon: 0,
        },
      });

      const results = await getResultsByShow(show.id);

      expect(results.length).toBe(2);
      expect(toNum(results[0].score)).toBeGreaterThanOrEqual(toNum(results[1].score));
      expect(results[0].horse).toBeDefined();
      expect(results[0].show).toBeDefined();
    } finally {
      await rmHorse(horse1.id);
      await rmHorse(horse2.id);
      await rmShow(show.id);
    }
  });

  it('accepts a string show ID (converts to integer)', async () => {
    const show = await mkShow('GBS3');
    try {
      const results = await getResultsByShow(String(show.id));
      expect(Array.isArray(results)).toBe(true);
    } finally {
      await rmShow(show.id);
    }
  });
});

// ─── getResultById ────────────────────────────────────────────────────────────

describe('getResultById', () => {
  it('throws for negative resultId', async () => {
    await expect(getResultById(-1)).rejects.toThrow('Result ID must be a positive integer');
  });

  it('throws for non-numeric string resultId', async () => {
    await expect(getResultById('invalid')).rejects.toThrow('Result ID must be a positive integer');
  });

  it('returns null for a non-existent ID', async () => {
    const result = await getResultById(999999999);
    expect(result).toBeNull();
  });

  it('returns result with horse and show included', async () => {
    const horse = await mkHorse('GBI1');
    const show = await mkShow('GBI1');
    try {
      const created = await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show.id,
          score: 88,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date(),
          showName: show.name,
          prizeWon: 0,
        },
      });

      const result = await getResultById(created.id);

      expect(result).not.toBeNull();
      expect(result.id).toBe(created.id);
      expect(result.horseId).toBe(horse.id);
      expect(result.showId).toBe(show.id);
      expect(result.horse).toBeDefined();
      expect(result.show).toBeDefined();
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });

  it('accepts a string result ID (converts to integer)', async () => {
    const horse = await mkHorse('GBI2');
    const show = await mkShow('GBI2');
    try {
      const created = await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show.id,
          score: 70,
          placement: null,
          discipline: 'Racing',
          runDate: new Date(),
          showName: show.name,
          prizeWon: 0,
        },
      });

      const result = await getResultById(String(created.id));
      expect(result).not.toBeNull();
      expect(result.id).toBe(created.id);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });
});

// ─── createResult ─────────────────────────────────────────────────────────────

describe('createResult', () => {
  it('enforces the same input validation as saveResult', async () => {
    await expect(createResult({ showId: 2 })).rejects.toThrow('Horse ID is required');
  });

  it('creates a result (alias behaviour)', async () => {
    const horse = await mkHorse('CR1');
    const show = await mkShow('CR1');
    try {
      const result = await createResult({
        horseId: horse.id,
        showId: show.id,
        score: 80,
        placement: null,
        discipline: 'Racing',
        runDate: RUN_DATE,
        showName: show.name,
      });

      expect(result.horseId).toBe(horse.id);
      expect(toNum(result.score)).toBe(80);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });
});

// ─── getResultsByUser ─────────────────────────────────────────────────────────

describe('getResultsByUser', () => {
  it('returns results for all horses owned by the user', async () => {
    const horse = await mkHorse('GBU1');
    const show = await mkShow('GBU1');
    try {
      await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: show.id,
          score: 85,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date(),
          showName: show.name,
          prizeWon: 0,
        },
      });

      const results = await getResultsByUser(USER_ID);

      const ours = results.find(r => r.horseId === horse.id);
      expect(ours).toBeDefined();
      expect(ours.horse.userId).toBe(USER_ID);
    } finally {
      await rmHorse(horse.id);
      await rmShow(show.id);
    }
  });

  it('filters by discipline when the discipline option is provided', async () => {
    const horse = await mkHorse('GBU2');
    const showR = await mkShow('GBU2R');
    const showD = await mkShow('GBU2D');
    try {
      await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: showR.id,
          score: 85,
          placement: '1st',
          discipline: 'Racing',
          runDate: new Date(),
          showName: showR.name,
          prizeWon: 0,
        },
      });
      await prisma.competitionResult.create({
        data: {
          horseId: horse.id,
          showId: showD.id,
          score: 70,
          placement: null,
          discipline: 'Dressage',
          runDate: new Date(),
          showName: showD.name,
          prizeWon: 0,
        },
      });

      const results = await getResultsByUser(USER_ID, { discipline: 'Racing', limit: 100 });

      const horseResults = results.filter(r => r.horseId === horse.id);
      expect(horseResults.length).toBe(1);
      expect(horseResults[0].discipline).toBe('Racing');
    } finally {
      await rmHorse(horse.id);
      await rmShow(showR.id);
      await rmShow(showD.id);
    }
  });

  it('caps limit at 100 and enforces non-negative offset without throwing', async () => {
    const results = await getResultsByUser(USER_ID, { limit: 200, offset: -5 });
    expect(Array.isArray(results)).toBe(true);
  });
});
