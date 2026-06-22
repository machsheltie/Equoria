/**
 * Horse History Controller — Competition History Retrieval
 *
 * Tests getHorseHistory() against the real DB. No mocks of any kind.
 *
 * Coverage:
 *   - ID validation (400 for non-numeric, negative, zero)
 *   - Empty result set → 200 + []
 *   - Field mapping: prizeWon → prize, statGains → statGain
 *   - JSON parsing of statGains
 *   - statGains null → statGain null
 *   - Order preserved from DB query (newest runDate first)
 *
 * Note: The "malformed statGains → 500" and "DB error → 500" scenarios are
 * not covered here because (a) PostgreSQL JSONB columns reject invalid JSON on
 * insert, making that state unreachable via Prisma, and (b) a live DB error
 * cannot be injected without mocking infrastructure.
 *
 * Fixtures: prefix TestFixture-HorseHistory-  Cleaned in beforeAll/afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseHistory } from '../../horses/index.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-HorseHistory-';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
}

function makeReq(id) {
  return { params: { id: String(id) } };
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

let testHorse;

// Migration 20260521120000 added UNIQUE(showId, horseId) on
// competition_results — testHorse appears in many results below, so each
// result needs its OWN show. This helper mints a distinct prefixed show
// (cleaned by the PREFIX-scoped deleteMany in afterAll).
let __showSeq = 0;
async function makeShow(discipline = 'Barrel Racing') {
  __showSeq += 1;
  return prisma.show.create({
    data: {
      name: `${PREFIX}Show-${__showSeq}`,
      discipline,
      levelMin: 1,
      levelMax: 10,
      entryFee: 50,
      prize: 1000,
      runDate: new Date('2025-06-01'),
    },
  });
}

beforeAll(async () => {
  await prisma.competitionResult.deleteMany({
    where: { horse: { name: { startsWith: PREFIX } } },
  });
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });

  testHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
    },
  });
});

afterAll(async () => {
  await prisma.competitionResult.deleteMany({ where: { horseId: testHorse?.id } });
  await prisma.show.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
});

// ─── ID validation ───────────────────────────────────────────────────────────

describe('ID validation', () => {
  it('rejects non-numeric horse ID with 400', async () => {
    const res = makeRes();
    await getHorseHistory(makeReq('invalid'), res);

    expect(res._status).toBe(400);
    expect(res._json).toMatchObject({
      success: false,
      message: 'Invalid horse ID. Must be a positive integer.',
      data: null,
    });
  });

  it('rejects negative horse ID with 400', async () => {
    const res = makeRes();
    await getHorseHistory(makeReq('-1'), res);

    expect(res._status).toBe(400);
    expect(res._json.success).toBe(false);
  });

  it('rejects zero horse ID with 400', async () => {
    const res = makeRes();
    await getHorseHistory(makeReq('0'), res);

    expect(res._status).toBe(400);
    expect(res._json.success).toBe(false);
  });
});

// ─── empty history ────────────────────────────────────────────────────────────

describe('empty history', () => {
  it('returns empty array when horse has no competition history', async () => {
    // Equoria-n7qa3: the emptyHorse fixture is PREFIX-named, so the afterAll
    // `horse name startsWith PREFIX` sweep removes it. The old per-test
    // delete used a swallowed empty-arm catch that hid cleanup failures (a
    // leaked NULL-phenotype-risk row); dropping it lets the fail-loud prefix
    // sweep own teardown. The test asserts by emptyHorse.id, unaffected by
    // other rows.
    const emptyHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}Empty`,
        sex: 'Filly',
        dateOfBirth: new Date('2020-06-01'),
      },
    });

    const res = makeRes();
    await getHorseHistory(makeReq(emptyHorse.id), res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
    expect(res._json.data).toEqual([]);
  });

  it('returns 200 for a valid large horse ID with no results', async () => {
    const res = makeRes();
    await getHorseHistory(makeReq('999999999'), res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);
    expect(Array.isArray(res._json.data)).toBe(true);
  });
});

// ─── response shape and field mapping ────────────────────────────────────────

describe('response shape and field mapping', () => {
  it('maps prizeWon → prize and returns correct response structure', async () => {
    const show = await makeShow('Barrel Racing');
    const r = await prisma.competitionResult.create({
      data: {
        horseId: testHorse.id,
        showId: show.id,
        showName: `${PREFIX}Barrel Show`,
        discipline: 'Barrel Racing',
        placement: '1st',
        score: 100,
        prizeWon: 500,
        statGains: null,
        runDate: new Date('2025-06-01'),
      },
    });

    // Equoria-n7qa3: results are scoped to testHorse.id and cleaned by the
    // afterAll `competitionResult where horseId: testHorse.id` sweep. The old
    // per-test delete used a swallowed empty-arm catch that hid cleanup
    // failures; dropping it lets the fail-loud afterAll own teardown.
    // Assertions use `.find(d => d.id === r.id)`, so cross-test result
    // accumulation is benign.
    const res = makeRes();
    await getHorseHistory(makeReq(testHorse.id), res);

    expect(res._status).toBe(200);
    expect(res._json.success).toBe(true);

    const found = res._json.data.find(d => d.id === r.id);
    expect(found).toBeDefined();
    expect(found.showName).toBe(`${PREFIX}Barrel Show`);
    expect(found.discipline).toBe('Barrel Racing');
    expect(found.placement).toBe('1st');
    expect(Number(found.prize)).toBe(500);
    expect(found.statGain).toBeNull();
    expect(found.runDate).toBeDefined();
  });

  it('parses statGains JSON string into statGain object', async () => {
    const show = await makeShow('Dressage');
    const r = await prisma.competitionResult.create({
      data: {
        horseId: testHorse.id,
        showId: show.id,
        showName: `${PREFIX}Dressage Show`,
        discipline: 'Dressage',
        placement: '2nd',
        score: 90,
        prizeWon: 200,
        statGains: JSON.stringify({ stat: 'stamina', gain: 1 }),
        runDate: new Date('2025-05-15'),
      },
    });

    // Equoria-n7qa3: see the prizeWon→prize test above — afterAll's
    // testHorse.id-scoped sweep owns teardown; dropped the swallowed per-test
    // delete. Assertion is id-scoped, so result accumulation is benign.
    const res = makeRes();
    await getHorseHistory(makeReq(testHorse.id), res);

    const found = res._json.data.find(d => d.id === r.id);
    expect(found).toBeDefined();
    expect(found.statGain).toEqual({ stat: 'stamina', gain: 1 });
  });

  it('sets statGain to null when statGains is null in DB', async () => {
    const show = await makeShow('Show Jumping');
    const r = await prisma.competitionResult.create({
      data: {
        horseId: testHorse.id,
        showId: show.id,
        showName: `${PREFIX}No Stat Show`,
        discipline: 'Show Jumping',
        placement: null,
        score: 75,
        prizeWon: 0,
        statGains: null,
        runDate: new Date('2025-04-01'),
      },
    });

    // Equoria-n7qa3: see the prizeWon→prize test above — afterAll's
    // testHorse.id-scoped sweep owns teardown; dropped the swallowed per-test
    // delete. Assertion is id-scoped, so result accumulation is benign.
    const res = makeRes();
    await getHorseHistory(makeReq(testHorse.id), res);

    const found = res._json.data.find(d => d.id === r.id);
    expect(found).toBeDefined();
    expect(found.statGain).toBeNull();
    expect(found.placement).toBeNull();
  });
});

// ─── ordering ─────────────────────────────────────────────────────────────────

describe('result ordering', () => {
  it('returns results ordered newest runDate first', async () => {
    const olderShow = await makeShow('Racing');
    const newerShow = await makeShow('Racing');
    const older = await prisma.competitionResult.create({
      data: {
        horseId: testHorse.id,
        showId: olderShow.id,
        showName: `${PREFIX}Older Show`,
        discipline: 'Racing',
        score: 80,
        prizeWon: 100,
        statGains: null,
        runDate: new Date('2025-01-01'),
      },
    });
    const newer = await prisma.competitionResult.create({
      data: {
        horseId: testHorse.id,
        showId: newerShow.id,
        showName: `${PREFIX}Newer Show`,
        discipline: 'Racing',
        score: 85,
        prizeWon: 150,
        statGains: null,
        runDate: new Date('2025-06-15'),
      },
    });

    // Equoria-n7qa3: afterAll's testHorse.id-scoped sweep owns teardown;
    // dropped the swallowed per-test deleteMany. The assertion compares only the
    // RELATIVE order of these two ids (newer before older) within the global
    // runDate-DESC ordering, so other accumulated results are benign.
    const res = makeRes();
    await getHorseHistory(makeReq(testHorse.id), res);

    const ids = res._json.data.map(d => d.id);
    const newerIdx = ids.indexOf(newer.id);
    const olderIdx = ids.indexOf(older.id);

    expect(newerIdx).toBeGreaterThanOrEqual(0);
    expect(olderIdx).toBeGreaterThanOrEqual(0);
    expect(newerIdx).toBeLessThan(olderIdx); // newer appears before older
  });
});
