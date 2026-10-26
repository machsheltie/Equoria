/**
 * traitDiscovery — DB-fixture branch-coverage tests (Equoria-rr7)
 *
 * Covers getDiscoveryProgress's success path, which needs a real DB record.
 *
 * Equoria-0w96q. OLD CONTRACT: this suite also drove revealTraits (eligibility,
 * the no-hidden / no-conditions / no-suitable early returns, positive and
 * negative reveals, the checkEnrichment path, the adult age filter, the
 * three-trait cap and the rarity branches) and batchRevealTraits. NEW RULING:
 * that writer had no production caller after the player trait-reveal routes
 * were removed (Equoria-gu8jk; owner ruling 2026-10-20) and was deleted with
 * its tests; hidden traits stay inert until revealed (owner ruling
 * 2026-10-19).
 *
 * All fixtures use TestFixture- prefix for safe cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getDiscoveryProgress } from '../../../utils/traitDiscovery.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A silent no-op catch arm on the
// afterAll deletes leaks fixture rows into the canonical DB (CLAUDE.md §2) and
// keeps the suite green while a leak trips downstream sentinels. The tracker
// runs every registered scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const cleanup = createCleanupTracker();
let sharedUser;
let horseProgress; // adult, age=4, mixed traits → getDiscoveryProgress success

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  sharedUser = await prisma.user.create({
    data: {
      email: `td-ext-${ts}-${rand()}@test.com`,
      username: `tdext${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'TDExt',
      lastName: 'Tester',
      money: 1000,
    },
  });

  const base = { userId: sharedUser.id, dateOfBirth: new Date() };

  horseProgress = await prisma.horse.create({
    data: {
      ...base,
      ...fixtureColor(),
      name: `TestFixture-TD-Progress-${ts}`,
      sex: 'Mare',
      age: 4, // adult
      bondScore: 60,
      epigeneticModifiers: { positive: ['resilient'], negative: ['nervous'], hidden: ['calm'] },
    },
  });

  // Equoria-g9sa: explicit SCOPED horse cleanup FIRST. These fixtures are
  // created via raw prisma.horse.create() but now spread ...fixtureColor(),
  // so they carry a valid phenotype and do NOT trip horseColorNullSentinel
  // even transiently (the structural fix for the Equoria-lfj5 regression
  // class). The previous user-cascade delete with a silent .catch() left 15+
  // orphan rows; cleanup is now scoped by THIS suite's own userId (unique per
  // run) — explicit, not cascade-only — and won't delete a sibling suite's
  // in-flight TestFixture-TD-* rows (which share the name prefix). FK order:
  // horses before user (Horse.userId onDelete: Restrict).
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: sharedUser.id } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: sharedUser.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── getDiscoveryProgress — success path (lines 561-587) ──────────────────────

describe('getDiscoveryProgress() — success path', () => {
  it('returns progress object with all required fields for existing horse (lines 561-587)', async () => {
    const result = await getDiscoveryProgress(horseProgress.id);
    expect(result.horseId).toBe(horseProgress.id);
    expect(typeof result.horseName).toBe('string');
    expect(typeof result.discoveredTraits).toBe('number');
    expect(result.totalPossibleTraits).toBeGreaterThan(0);
    expect(typeof result.progressPercentage).toBe('number');
    expect(result.progressPercentage).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.traits)).toBe(true);
    expect(typeof result.hiddenTraitsCount).toBe('number');
    expect(typeof result.visibleTraitsCount).toBe('number');
    expect(result.currentStats).toBeDefined();
    expect(typeof result.currentStats.bondScore).toBe('number');
    expect(typeof result.currentStats.developmentDay).toBe('number');
    expect(Array.isArray(result.conditions)).toBe(true);
  }, 15000);

  it('accepts horse ID as string and returns valid progress (line 543)', async () => {
    const result = await getDiscoveryProgress(String(horseProgress.id));
    expect(result.horseId).toBe(horseProgress.id);
  }, 10000);

  it('progress reflects visible + hidden trait counts correctly', async () => {
    // horseProgress has: positive=['resilient'], negative=['nervous'], hidden=['calm']
    const result = await getDiscoveryProgress(horseProgress.id);
    expect(result.hiddenTraitsCount).toBeGreaterThanOrEqual(0);
    expect(result.visibleTraitsCount).toBeGreaterThanOrEqual(0);
    expect(result.discoveredTraits).toBe(result.hiddenTraitsCount + result.visibleTraitsCount);
    // Equoria-6dace (owner ruling 2026-10-16): `traits` names the visible
    // traits only; the hidden ones are hiddenTraitsCount.
    expect(result.traits).toHaveLength(result.visibleTraitsCount);
    expect(result.traits).not.toContain('calm');
  }, 10000);
});
