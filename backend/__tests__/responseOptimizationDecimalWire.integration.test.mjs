/**
 * Equoria-6ftvc / Equoria-wl6ln — what `app.use(responseOptimization())` actually
 * puts on the wire for the two value shapes Prisma hands it that are `typeof
 * object` but are NOT plain objects: `Decimal` and `DateTime`.
 *
 * THE DEFECT THIS FILE PINS (6ftvc, production-reachable).
 *   `SerializationService.compressDataStructure` had three branches — array,
 *   Date (brand-checked), and a catch-all that rebuilds anything `typeof
 *   object` with `Object.entries`. A Prisma `Decimal` has no branch, so the
 *   catch-all claimed it and rebuilt it as a PLAIN object, discarding the
 *   prototype that carries `toJSON`. Measured: `new Prisma.Decimal(17.5)`
 *   reached the wire as `{"s":1,"e":1,"d":[17,5000000]}`.
 *
 *   `compress` defaults to true (apiResponseOptimizationService.mjs) and the
 *   middleware is mounted app-wide (app.mjs), so EVERY response was affected —
 *   no realm split required, unlike the sibling Date defect. SIX live `Decimal`
 *   columns exist in the schema — `Groom.sessionRate`, `GroomInteraction.cost`,
 *   `CompetitionResult.score`, `CompetitionResult.prizeWon`,
 *   `UltraRareTraitEvent.baseChance` and `.finalChance`; the issue's count of
 *   seven predates `Horse.earnings`, which Equoria-8nmxm removed by migration.
 *   `Groom.sessionRate` is the one the player
 *   feels, because `GroomList.tsx` declares it `number` and gates hiring on
 *   `(user.money || 0) >= sessionRate * 7`. Object times seven is `NaN`, and
 *   every comparison with `NaN` is false, so no groom could ever be afforded.
 *
 * WHY A NUMBER AND NOT `Decimal.toJSON()`'s STRING.
 *   `toJSON()` yields a numeric STRING ("17.5"). Every frontend consumer types
 *   these as `number` and does arithmetic on them —
 *   `CompetitionResultsList.tsx` totals prizes with `sum + r.prizeWon`, which
 *   CONCATENATES on strings. The backend had already settled the question at 16
 *   sites in 9 files (`resultModelService`, `groomFreeAgentController`,
 *   `groomMarketplaceController`, `horseOverviewController`, `userStatsService`,
 *   the leaderboards…), every one of them `Number(...)`. The middleware now
 *   applies the same rule to the paths that forgot it, so a controller that
 *   coerces and a controller that does not produce the SAME wire shape.
 *
 * THE THREE LAYERS BELOW, deliberately, because each one can be green while the
 * next is red: the pure function, the middleware's `res.json` override, and a
 * real authenticated route over HTTP against the real database.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../app.mjs';
import prisma, { Prisma } from '../../packages/database/prismaClient.mjs';
import { SerializationService } from '../services/apiResponseOptimizationService.mjs';
import { responseOptimization } from '../middleware/responseOptimization.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6ftvc-wire';

// Two decimal places, the shape of `@db.Decimal(10, 2)`, and NOT a whole number —
// a whole number would survive several wrong implementations by accident.
const SESSION_RATE = '17.50';

// ─── Layer 1: the pure function ──────────────────────────────────────────────

describe('Equoria-6ftvc — SerializationService.compressDataStructure and Prisma Decimal', () => {
  it('detects a Decimal by BRAND, not by constructor identity', () => {
    // The reason the guard is written this way rather than
    // `data instanceof Prisma.Decimal`: `instanceof` is constructor identity and
    // fails across module realms, which is precisely the bug Equoria-oeg8k fixed
    // for Date in this same function. `Object.prototype.toString` reads the
    // value's own `Symbol.toStringTag`, so it crosses realms by construction.
    const rate = new Prisma.Decimal(SESSION_RATE);
    expect(Object.prototype.toString.call(rate)).toBe('[object Decimal]');
  });

  it('emits a Decimal as a JSON NUMBER, not its internal {s,e,d} representation', () => {
    const compressed = SerializationService.compressDataStructure({
      sessionRate: new Prisma.Decimal(SESSION_RATE),
    });

    // The value the frontend can do arithmetic on.
    expect(typeof compressed.sessionRate).toBe('number');
    expect(compressed.sessionRate).toBe(17.5);
    // And the bytes, because that is what the defect was measured in.
    expect(JSON.stringify(compressed)).toBe('{"sessionRate":17.5}');
  });

  it('emits a Decimal nested inside arrays and objects', () => {
    const compressed = SerializationService.compressDataStructure({
      grooms: [{ id: 1, sessionRate: new Prisma.Decimal('20.00') }],
      results: { prizeWon: new Prisma.Decimal('1500.00'), finalChance: new Prisma.Decimal('0.1234') },
    });

    expect(JSON.stringify(compressed)).toBe(
      '{"grooms":[{"id":1,"sessionRate":20}],"results":{"prizeWon":1500,"finalChance":0.1234}}',
    );
  });

  it('carries the full Decimal(10,2) range without loss', () => {
    // The precision claim behind choosing Number over the toJSON string: an
    // IEEE-754 double round-trips any decimal of 15 or fewer significant digits,
    // and the widest Decimal column in the schema is Decimal(10, 2) — ten.
    const widest = new Prisma.Decimal('99999999.99');
    const compressed = SerializationService.compressDataStructure({ cost: widest });
    expect(JSON.stringify(compressed)).toBe('{"cost":99999999.99}');
    expect(String(compressed.cost)).toBe(widest.toJSON());
  });
});

// ─── Layer 2: the middleware's res.json override ─────────────────────────────

describe('Equoria-6ftvc / wl6ln — responseOptimization() res.json override', () => {
  /**
   * Drive the real middleware and return what it handed the ORIGINAL `res.json`,
   * i.e. the value Express would serialize.
   */
  function throughMiddleware(payload) {
    let sent;
    const headers = {};
    const req = { method: 'GET', path: '/test', query: {}, headers: {} };
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(k, v) {
        headers[k] = v;
      },
      getHeader(k) {
        return headers[k];
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        sent = body;
        return this;
      },
    };
    responseOptimization()(req, res, () => {});
    res.json(payload);
    return sent;
  }

  it('puts a Decimal on the wire as a number (6ftvc)', () => {
    const sent = throughMiddleware({
      success: true,
      groom: { id: 7, sessionRate: new Prisma.Decimal(SESSION_RATE) },
    });
    expect(JSON.stringify(sent)).toBe('{"success":true,"groom":{"id":7,"sessionRate":17.5}}');
  });

  it('puts a REALM-FOREIGN Date on the wire as an ISO string (wl6ln)', () => {
    // A Date minted in another module realm — the state a Prisma `DateTime`
    // reaches under `--experimental-vm-modules`. `runInNewContext` reproduces
    // the condition deterministically on every machine, where depending on the
    // Prisma client's module resolution would not.
    const foreign = runInNewContext('new Date(1767225600000)');
    expect(foreign instanceof Date).toBe(false);
    expect(Object.prototype.toString.call(foreign)).toBe('[object Date]');

    const sent = throughMiddleware({ success: true, groom: { hiredDate: foreign } });
    expect(JSON.stringify(sent)).toBe('{"success":true,"groom":{"hiredDate":"2026-01-01T00:00:00.000Z"}}');
  });
});

// ─── Layer 3: a real authenticated route, over HTTP, against the real database ──

describe('Equoria-6ftvc — GET /api/v1/grooms/:id/profile over real HTTP', () => {
  let cleanup;
  let token;
  let groomId;

  beforeAll(async () => {
    cleanup = createCleanupTracker();
    const suffix = randomBytes(6).toString('hex');

    const user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${suffix}`,
        email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Wire',
        lastName: 'Decimal',
        money: 20000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // `groomRosterController.getGroomProfile` emits `sessionRate: groom.sessionRate`
    // and `hiredDate: groom.hiredDate` RAW — no `Number()`, no `toISOString()`.
    // That is the point: the middleware, not the controller, is what this asserts.
    const groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${suffix}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        startAge: 20,
        sessionRate: SESSION_RATE,
        userId: user.id,
      },
    });
    groomId = groom.id;

    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groomId } }));
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }));
  });

  afterAll(async () => {
    await cleanup.run();
  });

  it('serves sessionRate as a JSON number the frontend can afford a groom with', async () => {
    const response = await request(app)
      .get(`/api/v1/grooms/${groomId}/profile`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // The raw bytes first — `response.body` is already-parsed JSON and would hide
    // the difference between a number and a string.
    expect(response.text).toContain('"sessionRate":17.5');
    expect(response.text).not.toContain('"s":1');

    const { sessionRate } = response.body.groom;
    expect(typeof sessionRate).toBe('number');
    expect(sessionRate).toBe(17.5);

    // The player-facing consequence the issue named, reproduced against the wire
    // value: GroomList.tsx computes `sessionRate * 7` and compares it to money.
    const hiringCost = sessionRate * 7;
    expect(Number.isNaN(hiringCost)).toBe(false);
    expect(hiringCost).toBe(122.5);
    expect(20000 >= hiringCost).toBe(true);
  });

  it('serves a Prisma DateTime as an ISO string, not {} (wl6ln)', async () => {
    const response = await request(app)
      .get(`/api/v1/grooms/${groomId}/profile`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const { hiredDate } = response.body.groom;
    expect(typeof hiredDate).toBe('string');
    expect(Number.isFinite(Date.parse(hiredDate))).toBe(true);
  });
});
