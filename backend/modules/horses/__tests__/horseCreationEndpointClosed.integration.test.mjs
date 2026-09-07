/**
 * Finding 2 (2026-09-05 security audit) — free horse creation is closed.
 *
 * The defect: `POST /api/v1/horses` was mounted on the authenticated router
 * with nothing but `authenticateToken` + `validateHorseCreation` in front of
 * `createHorseFromRequest`. Any `role=user` account — including one holding
 * zero coins — could submit a name, an existing breed id, a sex and an age
 * and receive a persisted horse (HTTP 201). No payment, no entitlement, no
 * onboarding guard, no per-account cap. The audit reproduced it twice on one
 * zero-coin account while the wallet stayed at zero, which hands players free
 * breeding/sale stock and bypasses the 1,000-coin Horse Trader entirely.
 *
 * The invariant this file locks:
 *   A player may only acquire a horse through a server-owned workflow that
 *   charges or entitles them — registration's starter horse, the paid Horse
 *   Trader purchase, or breeding/foaling. There is NO generic player-facing
 *   "create me a horse" HTTP entry point.
 *
 * What the guard is: `POST /api/v1/horses` no longer reaches the creation
 * service at all. It answers 403 for every authenticated caller, regardless of
 * payload, role claim, or onboarding state. Unauthenticated callers are still
 * stopped earlier by `authenticateToken` (401), so the pre-existing
 * auth-bypass contract is unchanged.
 *
 * Why these assertions detect the old defect: every rejection case asserts the
 * PERSISTED state — the caller's horse row count and wallet balance before and
 * after — not merely the status code. Under the pre-fix route the two audit
 * requests returned 201 and left two extra horse rows behind; those exact
 * assertions fail loudly on the old code.
 *
 * Retained legitimate workflows proven here:
 *   - the paid Horse Trader purchase still charges exactly 1,000 coins once
 *     and creates exactly one horse;
 *   - an under-funded purchase leaves NO partial state (no horse, no debit,
 *     no ledger row);
 *   - the internal `createHorse` model function still works both on the
 *     default client (foaling/onboarding shape) and enlisted in a caller's
 *     transaction (`createHorse(data, tx)` — the Horse Trader shape).
 *
 * Registration's starter horse is covered by the auth module's own
 * `starterHorseBreedId.integration.test.mjs` / `starterHorseTemperament...`
 * suites and is exercised as part of this task's verification rather than
 * duplicated here.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures are uniquely named
 * and cleaned up by id in FK order (horses before users — Horse.userId is
 * onDelete: Restrict).
 *
 * @module modules/horses/__tests__/horseCreationEndpointClosed.integration
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createHorse } from '../services/horseModelService.mjs';

const ORIGIN = 'http://localhost:3000';
const STORE_PRICE = 1000; // mirrors marketplaceController.STORE_PRICE
const __dirname = dirname(fileURLToPath(import.meta.url));

const uid = () => randomBytes(6).toString('hex');
const uniqueEmail = () => `f2closed-${uid()}-${uid()}@test.com`;
const uniqueUsername = () => `f2closed${uid()}${uid()}`;

let seededBreedId;

beforeAll(async () => {
  // Use a REAL seeded breed: the pre-fix route resolved the breed row and its
  // breedGeneticProfile, so a breed that the generators accept is what the
  // audit's reproduction used. Fail loud rather than skipping (a silent skip
  // would make this whole security file vacuously green).
  const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
  const validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
  const breed = await prisma.breed.findFirst({
    where: { name: { in: validBreedNames } },
    select: { id: true },
  });
  if (!breed?.id) {
    throw new Error(
      'horseCreationEndpointClosed requires a seeded breed in the test DB ' +
        '(run `npm run seed:breeds`); none found. Refusing to skip silently.',
    );
  }
  seededBreedId = breed.id;
}, 30000);

describe('Finding 2 — POST /api/v1/horses is closed to players', () => {
  const cleanup = createCleanupTracker();
  let player;
  let playerToken;
  let createdHorseIds;

  beforeEach(async () => {
    createdHorseIds = [];
    // The audit's account: role=user, ZERO coins, onboarding NOT marked
    // complete (settings carries no onboarding markers).
    player = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Finding2',
        lastName: 'Player',
        money: 0,
        settings: {},
      },
    });
    playerToken = generateTestToken({ id: player.id, email: player.email, role: 'user' });

    const playerId = player.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'created horses');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: playerId } }), 'player horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: playerId } }), 'player user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  /** POST /api/v1/horses with a real CSRF pair and the given body. */
  async function postCreate(body, token = playerToken) {
    const csrf = await fetchCsrf(app);
    return request(app)
      .post('/api/v1/horses')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  }

  /**
   * A 403 alone is ambiguous — `csrfProtection` also answers 403 when the
   * token/cookie pair fails to bind, which would let this suite pass green
   * while the creation route was still wide open. Assert the ROUTE's own
   * rejection message so only the Finding 2 guard satisfies it.
   */
  function expectRouteClosed(res) {
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cannot be created directly/i);
    expect(res.body.message).toMatch(/Horse Trader/);
  }

  async function persistedState() {
    const [horseCount, row] = await Promise.all([
      prisma.horse.count({ where: { userId: player.id } }),
      prisma.user.findUnique({ where: { id: player.id }, select: { money: true } }),
    ]);
    return { horseCount, money: Number(row.money) };
  }

  it('rejects a zero-coin player and leaves horse count and balance unchanged', async () => {
    const before = await persistedState();
    expect(before).toEqual({ horseCount: 0, money: 0 });

    // The audit's exact reproduction: two distinct names, an existing breed
    // id, sex Mare, age 3 — both returned 201 and persisted before the fix.
    const first = await postCreate({
      name: `AuditFreeHorseA_${uid()}`,
      breedId: seededBreedId,
      sex: 'Mare',
      age: 3,
    });
    const second = await postCreate({
      name: `AuditFreeHorseB_${uid()}`,
      breedId: seededBreedId,
      sex: 'Mare',
      age: 3,
    });

    expectRouteClosed(first);
    expectRouteClosed(second);

    const after = await persistedState();
    expect(after.horseCount).toBe(before.horseCount);
    expect(after.money).toBe(before.money);
  }, 60000);

  it('does not reopen when the body supplies userId, a role field, or a starter-like name', async () => {
    const before = await persistedState();

    const otherUser = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Finding2',
        lastName: 'Victim',
        money: 0,
        settings: {},
      },
    });
    const otherUserId = otherUser.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: otherUserId } }), 'other user horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: otherUserId } }), 'other user');

    const payloads = [
      // mass-assignment of ownership
      { name: `Escalate_${uid()}`, breedId: seededBreedId, sex: 'Mare', age: 3, userId: otherUser.id },
      // role claim in the BODY (the JWT still says role=user)
      { name: `Escalate_${uid()}`, breedId: seededBreedId, sex: 'Mare', age: 3, role: 'admin' },
      { name: `Escalate_${uid()}`, breedId: seededBreedId, sex: 'Mare', age: 3, isAdmin: true },
      // a "starter horse" shaped request, as if onboarding were asking
      { name: 'Starter Horse', breedId: seededBreedId, sex: 'Mare', age: 3 },
      // no age / no sex — the shape onboarding uses internally
      { name: `Starter_${uid()}`, breedId: seededBreedId },
    ];

    for (const payload of payloads) {
      const res = await postCreate(payload);
      expect({ payload, status: res.status }).toEqual({ payload, status: 403 });
      expectRouteClosed(res);
    }

    // Neither the caller NOR the impersonated victim gained a horse.
    const after = await persistedState();
    expect(after.horseCount).toBe(before.horseCount);
    expect(after.money).toBe(before.money);
    expect(await prisma.horse.count({ where: { userId: otherUser.id } })).toBe(0);
  }, 90000);

  it('does not reopen for a player whose onboarding is still incomplete', async () => {
    // player.settings is {} — onboardingStep/onboardingCompleted absent.
    const fresh = await prisma.user.findUnique({
      where: { id: player.id },
      select: { settings: true },
    });
    expect(fresh.settings?.onboardingCompleted).toBeUndefined();

    const res = await postCreate({
      name: `MidOnboarding_${uid()}`,
      breedId: seededBreedId,
      sex: 'Stallion',
      age: 3,
    });

    expectRouteClosed(res);
    expect(await prisma.horse.count({ where: { userId: player.id } })).toBe(0);
  }, 60000);

  it('a CSRF-rejected request produces a DIFFERENT 403 than the route guard (assertion is not vacuous)', async () => {
    // Sentinel-positive for expectRouteClosed: prove the message matcher can
    // actually FAIL on the other 403 this route can produce. Without this, a
    // regression that reopened creation but broke CSRF binding would keep the
    // suite green on a bare `status === 403`.
    const res = await request(app)
      .post('/api/v1/horses')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${playerToken}`)
      .set('X-CSRF-Token', 'not-a-real-csrf-token')
      .send({ name: `CsrfMismatch_${uid()}`, breedId: seededBreedId, sex: 'Mare', age: 3 });

    expect(res.status).toBe(403);
    expect(res.body.message ?? '').not.toMatch(/cannot be created directly/i);
    expect(() => expectRouteClosed(res)).toThrow();
    expect(await prisma.horse.count({ where: { userId: player.id } })).toBe(0);
  }, 30000);

  it('still answers 401 (not 403) when no token is supplied', async () => {
    // Regression guard on the pre-existing auth contract asserted by
    // backend/__tests__/auth-bypass-attempts.test.mjs — the new rejection must
    // sit BEHIND authenticateToken, never in front of it.
    const res = await request(app)
      .post('/api/v1/horses')
      .set('Origin', ORIGIN)
      .send({ name: 'NoToken', breedId: seededBreedId, sex: 'Mare', age: 3 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  }, 30000);
});

describe('Finding 2 — the legitimate paid acquisition path is untouched', () => {
  const cleanup = createCleanupTracker();
  let buyer;
  let buyerToken;
  let createdHorseIds;

  beforeEach(async () => {
    createdHorseIds = [];
    buyer = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Finding2',
        lastName: 'Buyer',
        money: STORE_PRICE, // exactly enough for ONE purchase
        settings: {},
      },
    });
    buyerToken = generateTestToken({ id: buyer.id, email: buyer.email, role: 'user' });

    const buyerId = buyer.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'created horses');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: buyerId } }), 'buyer horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: buyerId } }), 'buyer user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  async function buyStoreHorse(token) {
    const csrf = await fetchCsrf(app);
    return request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ breedId: seededBreedId, sex: 'Mare' });
  }

  it('charges the Horse Trader price exactly once and creates exactly one horse', async () => {
    const res = await buyStoreHorse(buyerToken);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const horseId = res.body.data?.horse?.id;
    expect(typeof horseId).toBe('number');
    createdHorseIds.push(horseId);

    const after = await prisma.user.findUnique({
      where: { id: buyer.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(0); // STORE_PRICE - STORE_PRICE

    expect(await prisma.horse.count({ where: { userId: buyer.id } })).toBe(1);

    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, type: 'debit', category: 'horse_trader_purchase' },
    });
    expect(debitRows).toHaveLength(1);
    expect(Number(debitRows[0].amount)).toBe(STORE_PRICE);
  }, 60000);

  it('leaves no partial purchase when the buyer cannot afford the horse', async () => {
    const broke = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Finding2',
        lastName: 'Broke',
        money: STORE_PRICE - 1,
        settings: {},
      },
    });
    const brokeId = broke.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: brokeId } }), 'broke horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: brokeId } }), 'broke user');

    const token = generateTestToken({ id: broke.id, email: broke.email, role: 'user' });
    const res = await buyStoreHorse(token);

    expect(res.status).toBe(400);

    const after = await prisma.user.findUnique({
      where: { id: broke.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(STORE_PRICE - 1); // untouched
    expect(await prisma.horse.count({ where: { userId: broke.id } })).toBe(0);
    expect(await prisma.userTransaction.count({ where: { userId: broke.id } })).toBe(0);
  }, 60000);
});

describe('Finding 2 — internal createHorse callers still work', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let createdHorseIds;

  beforeEach(async () => {
    createdHorseIds = [];
    owner = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Finding2',
        lastName: 'Internal',
        money: 0,
        settings: {},
      },
    });
    const ownerId = owner.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'created horses');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: ownerId } }), 'owner horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: ownerId } }), 'owner user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  const horseShape = name => ({
    name,
    breedId: seededBreedId,
    sex: 'Mare',
    age: 3,
    dateOfBirth: new Date(Date.now() - 3 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    healthStatus: 'Excellent',
  });

  it('createHorse(data) on the default client still persists a horse (foaling/onboarding shape)', async () => {
    const horse = await createHorse({ ...horseShape(`InternalDefault_${uid()}`), userId: owner.id });
    createdHorseIds.push(horse.id);

    expect(horse.id).toBeGreaterThan(0);
    expect(horse.userId).toBe(owner.id);
  }, 60000);

  it('createHorse(data, tx) still enlists in the caller transaction (Horse Trader shape)', async () => {
    const horse = await prisma.$transaction(async tx =>
      createHorse({ ...horseShape(`InternalTx_${uid()}`), userId: owner.id }, tx),
    );
    createdHorseIds.push(horse.id);

    const persisted = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(persisted?.userId).toBe(owner.id);
  }, 60000);

  it('rolls the horse back when the enclosing transaction fails', async () => {
    const name = `InternalRollback_${uid()}`;
    await expect(
      prisma.$transaction(async tx => {
        await createHorse({ ...horseShape(name), userId: owner.id }, tx);
        throw new Error('deliberate rollback');
      }),
    ).rejects.toThrow('deliberate rollback');

    expect(await prisma.horse.count({ where: { name } })).toBe(0);
  }, 60000);
});
