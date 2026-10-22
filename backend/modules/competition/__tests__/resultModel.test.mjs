/**
 * Result Model Tests
 *
 * Input validation tests run without any DB access (validation throws
 * before reaching any Prisma call).  All other tests use real DB
 * fixtures under the TestFixture-ResultModel- prefix.
 *
 * Cleanup strategy (Equoria-1ohys — fail-loud):
 *   - beforeAll: delete any stale fixtures from previous runs.
 *   - afterAll: scoped, name-prefix sweep (Show cascade-deletes its
 *     CompetitionResults + ShowEntries; then Horses by prefix; then the USER_ID
 *     user). These deleteMany calls have NO swallowing `.catch` — a cleanup
 *     failure fails the suite so a leaked fixture surfaces at the source.
 *   - Per-test cleanup was previously done with swallowed-error helpers
 *     (rmHorse/rmShow) inside try/finally. Those are removed: every
 *     fixture uses a unique `TestFixture-ResultModel-` suffix and every
 *     assertion is scoped to its own horse/show ids, so fixtures from one test
 *     never affect another. Routing a delete through `finally` would also risk
 *     masking a test-body assertion failure if the delete threw. The prefix
 *     sweep is the single fail-loud cleanup point.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  getResultsByHorse,
  getResultsByShow,
  getResultById,
  getResultsByUser,
} from '../services/resultModelService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-ResultModel-';
const USER_ID = 'test-user-result-model';

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
    const results = await getResultsByHorse(horse.id);
    expect(results).toEqual([]);
  });

  it('returns results ordered by runDate desc and includes horse + show relations', async () => {
    const horse = await mkHorse('GBH2');
    const show1 = await mkShow('GBH2a');
    const show2 = await mkShow('GBH2b');
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
  });

  it('accepts a string horse ID (converts to integer)', async () => {
    const horse = await mkHorse('GBH3');
    const results = await getResultsByHorse(String(horse.id));
    expect(Array.isArray(results)).toBe(true);
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
    const results = await getResultsByShow(show.id);
    expect(results).toEqual([]);
  });

  it('returns results ordered by score desc and includes horse + show relations', async () => {
    const horse1 = await mkHorse('GBS2a');
    const horse2 = await mkHorse('GBS2b');
    const show = await mkShow('GBS2');
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
  });

  it('accepts a string show ID (converts to integer)', async () => {
    const show = await mkShow('GBS3');
    const results = await getResultsByShow(String(show.id));
    expect(Array.isArray(results)).toBe(true);
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
  });

  it('accepts a string result ID (converts to integer)', async () => {
    const horse = await mkHorse('GBI2');
    const show = await mkShow('GBI2');
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
  });
});

// ─── getResultsByUser ─────────────────────────────────────────────────────────

describe('getResultsByUser', () => {
  it('returns results for all horses owned by the user', async () => {
    const horse = await mkHorse('GBU1');
    const show = await mkShow('GBU1');
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
  });

  it('filters by discipline when the discipline option is provided', async () => {
    const horse = await mkHorse('GBU2');
    const showR = await mkShow('GBU2R');
    const showD = await mkShow('GBU2D');
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
  });

  it('caps limit at 100 and enforces non-negative offset without throwing', async () => {
    const results = await getResultsByUser(USER_ID, { limit: 200, offset: -5 });
    expect(Array.isArray(results)).toBe(true);
  });
});
