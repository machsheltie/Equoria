/**
 * Breeding from the stallion's page (Equoria-q4uem.9, Equoria-m13fh).
 *
 * Owner rulings (Stacey):
 *   2026-10-26 q89/q91/q94 — no Breeding Hall. On a stallion's page the player
 *     presses "Breed to <name> (<fee>)" and picks one of her mares. Her own
 *     stallion: free and at once. A Public Stud: at once, and the fee is
 *     charged. A Private Stud: a request is sent. No foal preview, no
 *     before/after balance, no receipt.
 *   2026-10-26 q90 — another player's horse is the same horse page in visitor
 *     mode: public facts and revealed traits only.
 *   2026-10-27 q105 — the "Breeding requests" button sits on the stallion's own
 *     page, so the request list can be read for one stallion (or one mare).
 *   2026-10-27 q106 — a Private request is refused when the mare owner cannot
 *     afford the fee.
 *   2026-10-27 q107 — the requesting mare is seen read-only, revealed traits only.
 *   q91 / Equoria-m13fh — the foal colour prediction is removed (it leaked an
 *     untested genotype, and players see no foal outcome).
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  sharedBreed,
  makePlayer,
  makeHorse,
  bookStud,
  breedOwnPair,
  moneyOf,
  disconnectLockClient,
  registerCleanup,
  requestPrivateStud,
  actOnRequest,
  listStudRequests,
  listAtStud,
  sendJson,
} from './helpers/studBookingFixtures.mjs';

const PREFIX = 'TestFixture-q4uem9-studpage';
const FEE = 400;
const hiddenTrait = 'zzSecretHiddenTraitQ4uem9';

describe('breeding from the stallion page (Equoria-q4uem.9)', () => {
  const cleanup = createCleanupTracker();
  let breed;
  let mareOwner;
  let studOwner;
  const userIds = [];
  const horseIds = [];

  async function player(role, money) {
    const p = await makePlayer(PREFIX, role, money);
    userIds.push(p.user.id);
    return p;
  }

  async function horse(spec) {
    const h = await makeHorse(PREFIX, { breedId: breed.id, ...spec });
    horseIds.push(h.id);
    return h;
  }

  async function studAt(mode, owner = studOwner) {
    const stud = await horse({ ownerId: owner.user.id, sex: 'Stallion' });
    const listed = await listAtStud(owner.token, stud.id, { studFee: FEE, mode });
    expect(listed.status).toBe(200);
    return stud;
  }

  beforeEach(async () => {
    userIds.length = 0;
    horseIds.length = 0;
    breed = await sharedBreed();
    mareOwner = await player('mareOwner', 5000);
    studOwner = await player('studOwner', 100);
    registerCleanup(cleanup, { userIds, horseIds });
  });

  afterEach(async () => {
    await cleanup.run();
  });

  afterAll(async () => {
    await disconnectLockClient();
  });

  it('her own stallion: the breeding happens at once and costs nothing', async () => {
    const stallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await breedOwnPair(mareOwner.token, stallion.id, mare.id);

    expect(res.status).toBeLessThan(300);
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).not.toBeNull();
    expect(dam.pregnancySireId).toBe(stallion.id);
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);
  });

  it('a Public Stud: the breeding happens at once and the fee moves to the stallion owner', async () => {
    const stud = await studAt('public');
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(200);
    expect(res.body.data.pregnancyStarted).toBe(true);
    const dam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dam.inFoalSinceDate).not.toBeNull();
    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
  });

  it('a Private Stud: a request is sent; the owner accepts one (fee moves, mare in foal) and rejects another (nothing moves)', async () => {
    const stud = await studAt('private');
    const first = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    const second = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const sent = await requestPrivateStud(mareOwner.token, stud.id, { damId: first.id, expectedStudFee: FEE });
    expect(sent.status).toBe(201);
    expect(await moneyOf(mareOwner.user.id)).toBe(5000);

    const accepted = await actOnRequest(studOwner.token, sent.body.data.requestId, 'approve');
    expect(accepted.status).toBe(200);
    expect((await prisma.horse.findUnique({ where: { id: first.id } })).inFoalSinceDate).not.toBeNull();
    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);

    const again = await requestPrivateStud(mareOwner.token, stud.id, { damId: second.id, expectedStudFee: FEE });
    expect(again.status).toBe(201);
    const rejected = await actOnRequest(studOwner.token, again.body.data.requestId, 'reject');
    expect(rejected.status).toBe(200);
    const record = await prisma.breedingRecord.findUnique({ where: { id: again.body.data.requestId } });
    expect(record.status).toBe('DECLINED');
    expect((await prisma.horse.findUnique({ where: { id: second.id } })).inFoalSinceDate).toBeNull();
    expect(await moneyOf(mareOwner.user.id)).toBe(5000 - FEE);
    expect(await moneyOf(studOwner.user.id)).toBe(100 + FEE);
  });

  it('q106: a Private request is refused when the mare owner cannot afford the fee, and no request is stored', async () => {
    const poor = await player('poorMareOwner', FEE - 1);
    const stud = await studAt('private');
    const mare = await horse({ ownerId: poor.user.id, sex: 'Mare' });

    const res = await requestPrivateStud(poor.token, stud.id, { damId: mare.id, expectedStudFee: FEE });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'insufficientFunds' });
    expect(await prisma.breedingRecord.count({ where: { damId: mare.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: studOwner.user.id } })).toBe(0);
    expect(await moneyOf(poor.user.id)).toBe(FEE - 1);
  });

  it('a player who owns the stallion is pointed back to his page, never to a Breeding Hall', async () => {
    const stud = await studAt('public', mareOwner);
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const booked = await bookStud(mareOwner.token, stud.id, { damId: mare.id, expectedStudFee: FEE });
    expect(booked.status).toBe(400);
    expect(booked.body.message).toMatch(/your own stallion/i);
    expect(booked.body.message).not.toMatch(/breeding hall/i);
  });

  it('q105: the request list can be read for one stallion or one mare', async () => {
    const studA = await studAt('private');
    const studB = await studAt('private');
    const mareA = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    const mareB = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });
    const toA = await requestPrivateStud(mareOwner.token, studA.id, { damId: mareA.id, expectedStudFee: FEE });
    const toB = await requestPrivateStud(mareOwner.token, studB.id, { damId: mareB.id, expectedStudFee: FEE });
    expect(toA.status).toBe(201);
    expect(toB.status).toBe(201);

    const forA = await listStudRequests(studOwner.token, { role: 'incoming', sireId: String(studA.id) });
    expect(forA.status).toBe(200);
    expect(forA.body.data.requests.map(r => r.id)).toEqual([toA.body.data.requestId]);

    const forMareB = await listStudRequests(mareOwner.token, { role: 'outgoing', damId: String(mareB.id) });
    expect(forMareB.status).toBe(200);
    expect(forMareB.body.data.requests.map(r => r.id)).toEqual([toB.body.data.requestId]);

    const bad = await listStudRequests(studOwner.token, { role: 'incoming', sireId: 'abc' });
    expect(bad.status).toBe(400);
  });

  it("q90/q107: visiting another player's stallion shows public facts, the stud plaque and revealed traits only", async () => {
    const sire = await horse({ ownerId: studOwner.user.id, sex: 'Stallion' });
    const stud = await horse({
      ownerId: studOwner.user.id,
      sex: 'Stallion',
      sireId: sire.id,
      epigeneticModifiers: { positive: ['calm'], negative: ['spooky'], hidden: [hiddenTrait] },
      colorGenotype: { E_Extension: 'E/e' },
    });
    const listed = await listAtStud(studOwner.token, stud.id, { studFee: FEE, mode: 'private' });
    expect(listed.status).toBe(200);

    const res = await sendJson('get', `/api/v1/horses/${stud.id}/visit`, mareOwner.token);

    expect(res.status).toBe(200);
    const view = res.body.data;
    expect(view).toMatchObject({
      id: stud.id,
      name: stud.name,
      sex: 'Stallion',
      isOwn: false,
      owner: { username: studOwner.user.username },
      stud: { mode: 'private', fee: FEE },
      revealedTraits: { positive: ['calm'], negative: ['spooky'] },
      sire: { id: sire.id, name: sire.name },
      dam: null,
    });
    expect(typeof view.stats.speed).toBe('number');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(hiddenTrait);
    expect(raw).not.toContain('E/e');
    expect(view).not.toHaveProperty('userId');
    expect(view).not.toHaveProperty('epigeneticModifiers');
    expect(view).not.toHaveProperty('colorGenotype');
  });

  it('visiting a horse that is not at stud shows no plaque; a missing horse answers 404', async () => {
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await sendJson('get', `/api/v1/horses/${mare.id}/visit`, studOwner.token);
    expect(res.status).toBe(200);
    expect(res.body.data.stud).toBeNull();

    const own = await sendJson('get', `/api/v1/horses/${mare.id}/visit`, mareOwner.token);
    expect(own.body.data.isOwn).toBe(true);

    const missing = await sendJson('get', '/api/v1/horses/2147483000/visit', mareOwner.token);
    expect(missing.status).toBe(404);
  });

  it('m13fh: the foal colour prediction is gone', async () => {
    const stallion = await horse({ ownerId: mareOwner.user.id, sex: 'Stallion' });
    const mare = await horse({ ownerId: mareOwner.user.id, sex: 'Mare' });

    const res = await sendJson('post', '/api/v1/horses/breeding/color-prediction', mareOwner.token, {
      sireId: stallion.id,
      damId: mare.id,
    });

    expect([404, 410]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/probabilit/i);
  });
});
