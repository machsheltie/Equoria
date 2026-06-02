/**
 * traitDiscovery — DB-fixture branch-coverage tests (Equoria-rr7)
 *
 * Covers the lines that the pure-function traitDiscovery.test.mjs cannot reach
 * because they require real DB records:
 *
 *   revealTraits — eligible check + parse-traits (174-188)
 *                  no-hidden-traits early-return (190-205)
 *                  no-conditions-met early-return (218-252)
 *                  no-suitable-traits early-return (256-274)
 *                  full success: positive trait (276-308, 390-436, 445-477)
 *                  full success: negative trait (460-463 updateHorseTraits negative branch)
 *                  checkEnrichment path (212-215)
 *                  adult age-filter branch (218-232)
 *   batchRevealTraits — success path (517)
 *   getDiscoveryProgress — success path (561-587)
 *
 * All fixtures use TestFixture- prefix for safe cleanup. Tests that mutate
 * epigeneticModifiers reset them via prisma.horse.update before calling revealTraits
 * to ensure idempotency across repeated test runs.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { revealTraits, batchRevealTraits, getDiscoveryProgress } from '../../../utils/traitDiscovery.mjs';
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
let horseNoHidden; // foal, age=1, no hidden → early return "No hidden traits"
let horseNoCond; // foal, age=1, hidden=['calm'], bond=10 stress=80 → "No conditions met"
let horseNoSuitable; // foal, age=1, hidden=['trait_xyz_unknown'], stress=5 → "No suitable traits"
let horseSuccessPos; // adult, age=5, bond=90, stress=50, hidden=['bonded'] → positive reveal
let horseSuccessNeg; // foal, age=1, stress=3, hidden=['nervous'] → negative reveal
let horseEnrichment; // foal, age=2, hidden=['calm'], bond=0 stress=100 → enrichment path exercised
let horseProgress; // adult, age=4, mixed traits → getDiscoveryProgress success
let horseThreeTraits; // adult, age=5, bond=97 stress=5, 5 hidden common traits → 3 revealed (break at 3)
let horseLegendaryTrait; // adult, age=5, bond=97, hidden=['legendaryBloodline'] → line 416+494
let horseRareTrait; // adult, age=5, bond=90, hidden=['trainabilityBoost'] → line 419+497
let horseMediumOnly; // adult, age=5, bond=75, stress=50, hidden=['calm'] → line 422 (MATURE_BOND only)

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

  [
    horseNoHidden,
    horseNoCond,
    horseNoSuitable,
    horseSuccessPos,
    horseSuccessNeg,
    horseEnrichment,
    horseProgress,
    horseThreeTraits,
    horseLegendaryTrait,
    horseRareTrait,
    horseMediumOnly,
  ] = await Promise.all([
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-NoHidden-${ts}`,
        sex: 'Stallion',
        age: 1,
        bondScore: 50,
        stressLevel: 50,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-NoCond-${ts}`,
        sex: 'Mare',
        age: 1,
        bondScore: 10, // below HIGH_BOND(80), MATURE_BOND(70)
        stressLevel: 80, // above LOW_STRESS(20)
        epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-NoSuitable-${ts}`,
        sex: 'Filly',
        age: 1,
        bondScore: 0,
        stressLevel: 5, // LOW_STRESS + MINIMAL_STRESS met
        epigeneticModifiers: { positive: [], negative: [], hidden: ['trait_xyz_unknown_7k3'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-SuccessPos-${ts}`,
        sex: 'Stallion',
        age: 5, // adult ≥ 3
        bondScore: 90, // HIGH_BOND(≥80) met; adult filter: bonding category passes
        stressLevel: 50,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['bonded'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-SuccessNeg-${ts}`,
        sex: 'Colt',
        age: 1, // foal
        bondScore: 0,
        stressLevel: 3, // MINIMAL_STRESS(≤5) + LOW_STRESS(≤20) met
        epigeneticModifiers: { positive: [], negative: [], hidden: ['nervous'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-Enrichment-${ts}`,
        sex: 'Mare',
        age: 2, // foal
        bondScore: 0,
        stressLevel: 100, // no conditions met → enrichment path only
        epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-Progress-${ts}`,
        sex: 'Mare',
        age: 4, // adult
        bondScore: 60,
        stressLevel: 30,
        epigeneticModifiers: { positive: ['resilient'], negative: ['nervous'], hidden: ['calm'] },
      },
    }),
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-ThreeTraits-${ts}`,
        sex: 'Stallion',
        age: 5, // adult
        bondScore: 97, // EXCELLENT_BOND(≥95) + HIGH_BOND(≥80) met
        stressLevel: 5, // MINIMAL_STRESS(≤5) + LOW_STRESS(≤20) + PERFECT_CARE met
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['bonded', 'calm', 'resilient', 'bold', 'intelligent'],
        },
      },
    }),
    // line 416+494: EXCELLENT_BOND(legendary) + legendaryBloodline(legendary rarity)
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-LegendaryTrait-${ts}`,
        sex: 'Mare',
        age: 5,
        bondScore: 97, // EXCELLENT_BOND(≥95) met — priority='legendary'
        stressLevel: 50,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['legendaryBloodline'] },
      },
    }),
    // line 419+497: HIGH_BOND(high) + trainabilityBoost(rare rarity)
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-RareTrait-${ts}`,
        sex: 'Stallion',
        age: 5,
        bondScore: 85, // HIGH_BOND(≥80) met — priority='high'; EXCELLENT_BOND needs 95, not met
        stressLevel: 50,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['trainabilityBoost'] },
      },
    }),
    // line 422: MATURE_BOND(medium) only — bond=75 (≥70 for MATURE_BOND, <80 for HIGH_BOND)
    prisma.horse.create({
      data: {
        ...base,
        ...fixtureColor(),
        name: `TestFixture-TD-MediumOnly-${ts}`,
        sex: 'Mare',
        age: 5,
        bondScore: 75, // MATURE_BOND(age≥3 AND bond≥70) YES; HIGH_BOND(bond≥80) NO
        stressLevel: 50, // LOW_STRESS(≤20) NO
        epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] },
      },
    }),
  ]);

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

// ── revealTraits — no hidden traits early return (lines 190-205) ──────────────

describe('revealTraits() — no hidden traits path', () => {
  it('returns success with empty revealed when horse has no hidden traits (lines 190-205)', async () => {
    const result = await revealTraits(horseNoHidden.id);
    expect(result.success).toBe(true);
    expect(result.revealed).toEqual([]);
    expect(result.totalHiddenBefore).toBe(0);
    expect(result.totalHiddenAfter).toBe(0);
    expect(result.message).toMatch(/no hidden traits/i);
    expect(result.horseId).toBe(horseNoHidden.id);
    expect(typeof result.horseName).toBe('string');
  }, 10000);

  it('accepts horse ID as string and parses it correctly (line 146)', async () => {
    const result = await revealTraits(String(horseNoHidden.id));
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(horseNoHidden.id);
  }, 10000);
});

// ── revealTraits — hidden traits present, no conditions met (lines 218-252) ───

describe('revealTraits() — no conditions met path', () => {
  it('returns success with empty revealed when no discovery conditions are satisfied (lines 235-252)', async () => {
    // Reset state for idempotency
    await prisma.horse.update({
      where: { id: horseNoCond.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] } },
    });

    const result = await revealTraits(horseNoCond.id);
    expect(result.success).toBe(true);
    expect(result.revealed).toEqual([]);
    expect(result.totalHiddenBefore).toBe(1);
    expect(result.totalHiddenAfter).toBe(1);
    expect(result.message).toMatch(/no discovery conditions/i);
  }, 15000);
});

// ── revealTraits — conditions met but no suitable traits (lines 256-274) ─────

describe('revealTraits() — conditions met, no suitable traits path', () => {
  it('returns success when conditions fire but hidden traits have no definition (lines 256-274)', async () => {
    // Reset state
    await prisma.horse.update({
      where: { id: horseNoSuitable.id },
      data: {
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['trait_xyz_unknown_7k3'],
        },
      },
    });

    const result = await revealTraits(horseNoSuitable.id);
    expect(result.success).toBe(true);
    expect(result.revealed).toEqual([]);
    // conditionsMet should be non-empty (LOW_STRESS and MINIMAL_STRESS met)
    expect(result.conditionsMet.length).toBeGreaterThan(0);
    expect(result.totalHiddenBefore).toBe(1);
    expect(result.totalHiddenAfter).toBe(1);
    expect(result.message).toMatch(/no suitable traits/i);
  }, 15000);
});

// ── revealTraits — full success: positive trait revealed (lines 276-308, 390-436, 445-477) ──

describe('revealTraits() — full success path: positive trait', () => {
  it('reveals a positive common trait via HIGH_BOND condition on adult horse', async () => {
    // Reset: ensure 'bonded' is in hidden
    await prisma.horse.update({
      where: { id: horseSuccessPos.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['bonded'] } },
    });

    const result = await revealTraits(horseSuccessPos.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('bonded');
    expect(result.traitsRevealed.length).toBe(1);
    expect(result.totalHiddenBefore).toBe(1);
    expect(result.totalHiddenAfter).toBe(0);
    expect(result.message).toMatch(/discovered 1 new trait/i);

    // Verify DB was updated: 'bonded' moved from hidden to positive
    const updated = await prisma.horse.findUnique({ where: { id: horseSuccessPos.id } });
    const mods = updated.epigeneticModifiers;
    expect(mods.positive).toContain('bonded');
    expect(mods.hidden).not.toContain('bonded');
  }, 15000);

  it('revealed trait has definition and discoveryReason fields', async () => {
    await prisma.horse.update({
      where: { id: horseSuccessPos.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['bonded'] } },
    });

    const result = await revealTraits(horseSuccessPos.id);
    const revealed = result.revealed[0];
    expect(revealed).toHaveProperty('trait');
    expect(revealed).toHaveProperty('definition');
    expect(revealed).toHaveProperty('discoveryReason');
    expect(typeof revealed.discoveryReason).toBe('string');
  }, 15000);
});

// ── revealTraits — full success: negative trait (updateHorseTraits negative branch line 462) ──

describe('revealTraits() — full success path: negative trait', () => {
  it('moves negative trait from hidden to negative array in DB (line 462)', async () => {
    await prisma.horse.update({
      where: { id: horseSuccessNeg.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['nervous'] } },
    });

    const result = await revealTraits(horseSuccessNeg.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('nervous');
    expect(result.totalHiddenAfter).toBe(0);

    // Verify DB: 'nervous' moved to negative (not positive)
    const updated = await prisma.horse.findUnique({ where: { id: horseSuccessNeg.id } });
    const mods = updated.epigeneticModifiers;
    expect(mods.negative).toContain('nervous');
    expect(mods.positive).not.toContain('nervous');
    expect(mods.hidden).not.toContain('nervous');
  }, 15000);
});

// ── revealTraits — checkEnrichment option path (lines 212-215) ───────────────

describe('revealTraits() — checkEnrichment=true path', () => {
  it('exercises enrichment check when options.checkEnrichment=true (lines 212-215)', async () => {
    await prisma.horse.update({
      where: { id: horseEnrichment.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] } },
    });

    // With bond=0 and stress=100, no conditions met — but enrichment path executes
    const result = await revealTraits(horseEnrichment.id, { checkEnrichment: true });
    expect(result.success).toBe(true);
    expect(result.revealed).toEqual([]);
    expect(result.message).toMatch(/no discovery conditions/i);
  }, 15000);
});

// ── revealTraits — adult age-filter branch (lines 218-232) ───────────────────

describe('revealTraits() — adult age filter (isAdult=true branch)', () => {
  it('applies adult filter: keeps bonding/stress/milestones conditions for adult horse', async () => {
    await prisma.horse.update({
      where: { id: horseSuccessPos.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] } },
    });

    // horse.age=5 (adult), bond=90 → HIGH_BOND (bonding category) passes adult filter
    const result = await revealTraits(horseSuccessPos.id);
    expect(result.success).toBe(true);
    // HIGH_BOND met → calm (common) revealed via fallback
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('calm');
  }, 15000);
});

// ── revealTraits — 3-trait cap / break at length >= 3 (lines 400-402) ────────

describe('revealTraits() — 3-trait revelation cap (line 400-402 break)', () => {
  it('reveals at most 3 traits even when many conditions and hidden traits are available', async () => {
    await prisma.horse.update({
      where: { id: horseThreeTraits.id },
      data: {
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['bonded', 'calm', 'resilient', 'bold', 'intelligent'],
        },
      },
    });

    // bond=97 stress=5: EXCELLENT_BOND(legendary)+HIGH_BOND(high)+MINIMAL_STRESS(high)+
    //                   LOW_STRESS(medium)+PERFECT_CARE(legendary)+MATURE_BOND(medium) all met
    const result = await revealTraits(horseThreeTraits.id);
    expect(result.success).toBe(true);
    // Loop breaks at 3 — never reveals more than 3
    expect(result.revealed.length).toBe(3);
    expect(result.totalHiddenAfter).toBe(2); // 5 hidden - 3 revealed = 2 remaining
  }, 15000);

  it('already-selected-trait filter fires when single trait and multiple conditions (line 405-407)', async () => {
    // One hidden trait, multiple conditions → second condition's filter sees trait already selected
    await prisma.horse.update({
      where: { id: horseSuccessPos.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['bonded'] } },
    });

    // bond=90: HIGH_BOND met. With 1 hidden common trait, second condition finds it already selected
    const result = await revealTraits(horseSuccessPos.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    // Only one trait revealed despite potentially multiple conditions trying to select
    expect(result.revealed[0].trait).toBe('bonded');
  }, 15000);
});

// ── batchRevealTraits — success path (line 517) ──────────────────────────────

describe('batchRevealTraits() — success path', () => {
  it('returns success=true for an existing horse with no hidden traits (line 517)', async () => {
    const results = await batchRevealTraits([horseNoHidden.id]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].horseId).toBe(horseNoHidden.id);
    expect(Array.isArray(results[0].revealed)).toBe(true);
  }, 10000);

  it('handles mixed success/failure batch correctly', async () => {
    const results = await batchRevealTraits([horseNoHidden.id, -99]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  }, 15000);
});

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
    expect(typeof result.currentStats.stressLevel).toBe('number');
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
    expect(result.traits).toHaveLength(result.discoveredTraits);
  }, 10000);
});

// ── selectTraitsToReveal rarity branches (lines 416, 419, 422) ───────────────
// ── getDiscoveryReason rarity branches (lines 494, 497) ──────────────────────

describe('revealTraits() — rarity-matching branches in selectTraitsToReveal', () => {
  it('reveals legendary trait via legendary-priority condition (lines 416, 494)', async () => {
    // EXCELLENT_BOND (legendary priority) + legendaryBloodline (legendary rarity)
    // → condition.priority === 'legendary' && traitDef.rarity === 'legendary' → line 416
    // → same check in getDiscoveryReason → line 494
    await prisma.horse.update({
      where: { id: horseLegendaryTrait.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['legendaryBloodline'] } },
    });

    const result = await revealTraits(horseLegendaryTrait.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('legendaryBloodline');
    expect(typeof result.revealed[0].discoveryReason).toBe('string');
  }, 15000);

  it('reveals rare trait via high-priority condition (lines 419, 497)', async () => {
    // HIGH_BOND (high priority) + trainabilityBoost (rare rarity)
    // → condition.priority === 'high' && ['rare','legendary'].includes('rare') → line 419
    // → same check in getDiscoveryReason → line 497
    // (weatherImmunity was removed from the game — Equoria-3hl8c, 2026-05-26.
    //  trainabilityBoost is the surviving rare-rarity trait in TRAIT_DEFINITIONS.)
    await prisma.horse.update({
      where: { id: horseRareTrait.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['trainabilityBoost'] } },
    });

    const result = await revealTraits(horseRareTrait.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('trainabilityBoost');
  }, 15000);

  it('reveals common trait via medium-priority condition only (line 422)', async () => {
    // MATURE_BOND (medium priority, age≥3 AND bond≥70) with bond=75 so HIGH_BOND not met
    // → condition.priority === 'medium' && ['common','rare'].includes('common') → line 422
    await prisma.horse.update({
      where: { id: horseMediumOnly.id },
      data: { epigeneticModifiers: { positive: [], negative: [], hidden: ['calm'] } },
    });

    const result = await revealTraits(horseMediumOnly.id);
    expect(result.success).toBe(true);
    expect(result.revealed.length).toBe(1);
    expect(result.revealed[0].trait).toBe('calm');
  }, 15000);
});
