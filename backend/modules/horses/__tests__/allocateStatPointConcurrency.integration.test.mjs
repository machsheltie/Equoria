/**
 * allocateStatPointConcurrency.integration.test.mjs
 *
 * Sentinel-positive real-DB coverage for Equoria-wsj2i.
 *
 * DEFECT (pre-fix): horseXpModelService.allocateStatPoint was a read-check-write
 * TOCTOU — findUnique(availableStatPoints) -> JS check `<= 0` -> UNCONDITIONAL
 * `horse.update({ [stat]: {increment:1}, availableStatPoints: {decrement:1} })`.
 * N parallel allocations against ONE earned point all read `1`, all pass the JS
 * check, and all decrement -> minted free stat increments AND availableStatPoints
 * driven NEGATIVE. Horse stats feed competition scoring, which feeds prize money,
 * so this is a farmable economic exploit — exactly the "protected stats" class
 * SECURITY.md says cannot be directly manipulated.
 *
 * FIX: replace the read-check-write with the codebase's canonical atomic
 * conditional claim —
 *   updateMany({ where: { id, availableStatPoints: { gte: 1 } },
 *                data:  { [stat]: {increment:1}, availableStatPoints: {decrement:1} } })
 * Postgres evaluates the `>= 1` predicate and the decrement in a single atomic
 * UPDATE, so exactly one of N racing claims can win the last point;
 * availableStatPoints can never go below 0.
 *
 * INVARIANTS asserted:
 *   - Horse.availableStatPoints >= 0 at all times.
 *   - Total stat increments applied == total points actually spent.
 *
 * CONCURRENCY NOTE: the AC specifies "two concurrent". Per the Equoria-n4m5j
 * lesson (a 2-way race can serialize by luck and false-pass on buggy code), this
 * sentinel fans out to CONCURRENCY=5 for a deterministic RED. The reasoning that
 * makes even N=2 reliable here (every call issues its findUnique BEFORE any
 * update commits, so all reads observe `1`) also makes N=5 rock-solid. The
 * invariant asserted (exactly one success, points == 0, stat == base + 1) is
 * identical for N=2.
 *
 * Real DB only, no mocks, no bypass headers. Fixtures are TestFixture- named;
 * cleanup is id-scoped and fail-loud (rethrows so a leak reds the suite rather
 * than silently polluting the canonical DB — CLAUDE.md §2/§3).
 */

import { randomBytes } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { allocateStatPoint } from '../services/horseXpModelService.mjs';

const BASE_SPEED = 50;
const CONCURRENCY = 5;

let ownerId;
const createdHorseIds = [];

async function makeHorse(availableStatPoints) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-wsj2i-horse-${randomBytes(8).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      age: 5,
      userId: ownerId,
      speed: BASE_SPEED,
      availableStatPoints,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  const uniq = randomBytes(8).toString('hex');
  const owner = await prisma.user.create({
    data: {
      email: `testfixture-wsj2i-${uniq}@test.com`,
      username: `TestFixturewsj2i${uniq}`,
      password: 'irrelevant-hash',
      firstName: 'Wsj2i',
      lastName: 'Tester',
      money: 1000,
    },
  });
  ownerId = owner.id;
}, 120000);

afterAll(async () => {
  // FK order: Horse.userId is onDelete:Restrict — delete horses BEFORE the user.
  // id-scoped, fail-loud (no swallow) per CLAUDE.md §2/§3.
  if (createdHorseIds.length > 0) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  if (ownerId) {
    await prisma.user.deleteMany({ where: { id: ownerId } });
  }
}, 120000);

describe('INTEGRATION: allocateStatPoint atomic claim under concurrency (Equoria-wsj2i)', () => {
  it('SENTINEL: concurrent allocations at ONE available point -> exactly one success, points never negative, stat incremented once', async () => {
    const horse = await makeHorse(1);

    const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => allocateStatPoint(horse.id, 'speed')));

    const successes = results.filter(r => r.success);

    // Exactly ONE claim may win the single available point. On the buggy
    // read-check-write code every racer reads `1`, passes the JS check, and
    // decrements -> multiple successes (this expectation FAILS pre-fix).
    expect(successes.length).toBe(1);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { speed: true, availableStatPoints: true },
    });

    // Invariant 1: availableStatPoints never goes negative (pre-fix: -(N-1)).
    expect(after.availableStatPoints).toBe(0);
    // Invariant 2: exactly ONE stat increment applied for ONE earned point
    // (pre-fix: BASE_SPEED + N).
    expect(after.speed).toBe(BASE_SPEED + 1);
  }, 120000);

  it('happy path preserved: a single allocation at one point succeeds and decrements to zero', async () => {
    const horse = await makeHorse(1);

    const result = await allocateStatPoint(horse.id, 'speed');

    expect(result.success).toBe(true);
    expect(result.statName).toBe('speed');
    expect(result.newStatValue).toBe(BASE_SPEED + 1);
    expect(result.remainingStatPoints).toBe(0);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { speed: true, availableStatPoints: true },
    });
    expect(after.speed).toBe(BASE_SPEED + 1);
    expect(after.availableStatPoints).toBe(0);
  }, 120000);

  it('reject preserved: allocation with zero points -> success:false, no increment, points stay 0', async () => {
    const horse = await makeHorse(0);

    const result = await allocateStatPoint(horse.id, 'speed');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no stat points/i);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { speed: true, availableStatPoints: true },
    });
    // Never over-decrements below zero on the reject path either.
    expect(after.speed).toBe(BASE_SPEED);
    expect(after.availableStatPoints).toBe(0);
  }, 120000);
});
