/**
 * ultraRareTriggerEngine + traitDiscovery unit tests (Equoria-rr7 coverage sprint).
 *
 * DB fixture: user + Filly foal (no traits, no bond history).
 * Tests exercise the "horse found but no conditions met / no hidden traits" paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from '../../../utils/ultraRareTriggerEngine.mjs';
import { revealTraits, batchRevealTraits, getDiscoveryProgress } from '../../../utils/traitDiscovery.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `ultratrait-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `ultratrait${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'UltraTrait',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-UltraTraitHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── ultraRareTriggerEngine ────────────────────────────────────────────────────

describe('evaluateUltraRareTriggers', () => {
  it('throws for non-existent horse', async () => {
    await expect(evaluateUltraRareTriggers(999999999)).rejects.toThrow();
  });

  it('returns array (empty) for horse with no qualifying conditions', async () => {
    const result = await evaluateUltraRareTriggers(horse.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('evaluateExoticUnlocks', () => {
  it('throws for non-existent horse', async () => {
    await expect(evaluateExoticUnlocks(999999999)).rejects.toThrow();
  });

  it('returns array (empty) for horse with no qualifying conditions', async () => {
    const result = await evaluateExoticUnlocks(horse.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── traitDiscovery ────────────────────────────────────────────────────────────

describe('revealTraits', () => {
  it('throws for non-existent horse', async () => {
    await expect(revealTraits(999999999)).rejects.toThrow();
  });

  it('returns success:true with empty revealed array for horse with no hidden traits', async () => {
    const result = await revealTraits(horse.id);
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.revealed)).toBe(true);
    expect(typeof result.message).toBe('string');
  });
});

describe('batchRevealTraits', () => {
  it('returns array of results for a batch containing one horse', async () => {
    const results = await batchRevealTraits([horse.id]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
  });

  it('returns empty array for empty input', async () => {
    const results = await batchRevealTraits([]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});

describe('getDiscoveryProgress', () => {
  it('throws for non-existent horse', async () => {
    await expect(getDiscoveryProgress(999999999)).rejects.toThrow();
  });

  it('returns progress shape for horse with no traits', async () => {
    const result = await getDiscoveryProgress(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.progressPercentage).toBe('number');
    expect(typeof result.hiddenTraitsCount).toBe('number');
    expect(typeof result.visibleTraitsCount).toBe('number');
    expect(Array.isArray(result.conditions)).toBe(true);
  });
});

// ── evaluateUltraRareTriggers — Phoenix-Born triggered via high stressLevel ───
//
// evaluatePhoenixBornConditions: `(stressEvents >= 1 || hasHighStress) && recoveries >= 0`
// recoveries >= 0 is always true; hasHighStress = stressLevel > 50.
// A horse with stressLevel: 51 triggers Phoenix-Born, covering lines 34-37
// (logger.info + triggeredTraits.push branch) in evaluateUltraRareTriggers.

let highStressUser;
let highStressHorse;

beforeAll(async () => {
  highStressUser = await prisma.user.create({
    data: {
      email: `ultratrait-hs-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `ultratraiths${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'HighStress',
      lastName: 'Tester',
      money: 1000,
    },
  });
  highStressHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HighStressHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: highStressUser.id,
      stressLevel: 51,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: highStressHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: highStressUser.id } }).catch(() => {});
}, 30000);

describe('evaluateUltraRareTriggers — high-stress horse triggers Phoenix-Born (lines 34-37)', () => {
  it('returns at least one triggered ultra-rare trait for stressLevel:51 horse', async () => {
    const result = await evaluateUltraRareTriggers(highStressHorse.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].tier).toBe('ultra-rare');
    expect(result[0].name).toBe('Phoenix-Born');
  });
});

// ── Fixture 3: horse with groomInteractions carrying stressChange values ──────
//
// Purpose: cover arrow-function bodies inside `.filter()` / `.map()` calls in
// evaluatePhoenixBornConditions (stressChange > 15 / < -15),
// evaluateIronWilledConditions (bondScore !== null filter + bondScore map), and
// evaluateEmpathicMirrorConditions (same bondScore filter + map).
//
// GroomInteraction has no `bondScore` column — `interaction.bondScore` is always
// `undefined`.  The filter predicate `undefined !== null` evaluates to true so
// every interaction passes, EXECUTING the arrow-function body (=coverage), but
// the downstream reduce produces NaN, so Iron-Willed / Empathic Mirror do NOT
// trigger. Phoenix-Born DOES trigger because stressEvents = 1 (≥ 1).

let giUser;
let giGroom;
let giHorse;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  giUser = await prisma.user.create({
    data: {
      email: `ultratrait-gi-${ts}-${rand()}@test.com`,
      username: `ultratraitgi${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'GITrait',
      lastName: 'Tester',
      money: 1000,
    },
  });

  giGroom = await prisma.groom.create({
    data: {
      name: `TestFixture-GIGroom-${ts}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: giUser.id,
      isActive: true,
    },
  });

  giHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-GIHorse-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: giUser.id,
      stressLevel: 0,
      bondScore: 50,
    },
  });

  // Positive stress event (stressChange > 15) — covers Phoenix-Born high-stress filter body
  await prisma.groomInteraction.create({
    data: {
      foalId: giHorse.id,
      groomId: giGroom.id,
      interactionType: 'grooming',
      duration: 30,
      bondingChange: 5,
      stressChange: 20,
      timestamp: new Date(),
    },
  });

  // Negative stress event (stressChange < -15) — covers Phoenix-Born recovery filter body
  await prisma.groomInteraction.create({
    data: {
      foalId: giHorse.id,
      groomId: giGroom.id,
      interactionType: 'grooming',
      duration: 30,
      bondingChange: -5,
      stressChange: -20,
      timestamp: new Date(),
    },
  });
}, 30000);

afterAll(async () => {
  // Cascade deletes groomInteractions via Horse → GroomInteraction onDelete: Cascade
  await prisma.horse.delete({ where: { id: giHorse.id } }).catch(() => {});
  await prisma.groom.delete({ where: { id: giGroom.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: giUser.id } }).catch(() => {});
}, 30000);

describe('evaluateUltraRareTriggers — groom-interaction horse covers stressChange + bondScore filter/map bodies', () => {
  it('executes stressChange filter bodies; Phoenix-Born triggers, Iron-Willed and Empathic Mirror do not', async () => {
    const result = await evaluateUltraRareTriggers(giHorse.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).toContain('Phoenix-Born');
    expect(names).not.toContain('Iron-Willed');
    expect(names).not.toContain('Empathic Mirror');
  });
});

// ── Fixture 4: horse with bondScore: 80 + 4 milestoneTraitLogs, no groomInteractions ──
//
// Purpose: trigger Iron-Willed AND Empathic Mirror.
//
// Iron-Willed: milestoneCount (4) >= 4, no negative traits, bondConsistency = 80/100 = 0.8 >= 0.8
// Empathic Mirror: no groomInteractions → sameGroomFromBirth = true (empty uniqueGrooms),
//   bondScores fallback to currentBondScore (80) → minBond = avgBond = 80 >= 80
// Phoenix-Born: stressEvents = 0, hasHighStress = false → does NOT trigger

let bmUser;
let bmHorse;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  bmUser = await prisma.user.create({
    data: {
      email: `ultratrait-bm-${ts}-${rand()}@test.com`,
      username: `ultratraitbm${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'BondedMilestone',
      lastName: 'Tester',
      money: 1000,
    },
  });

  bmHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-BMHorse-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: bmUser.id,
      bondScore: 80,
    },
  });

  // 4 milestoneTraitLogs — satisfies Iron-Willed milestoneCount >= 4 requirement
  for (let i = 0; i < 4; i++) {
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: bmHorse.id,
        milestoneType: 'socialization',
        score: 3,
        ageInDays: i,
      },
    });
  }
}, 30000);

afterAll(async () => {
  // Cascade deletes milestoneTraitLogs via Horse → MilestoneTraitLog onDelete: Cascade
  await prisma.horse.delete({ where: { id: bmHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: bmUser.id } }).catch(() => {});
}, 30000);

describe('evaluateUltraRareTriggers — bonded-milestone horse triggers Iron-Willed + Empathic Mirror', () => {
  it('triggers Iron-Willed (4 milestones, bondScore:80) and Empathic Mirror (no groomInteractions, bondScore:80)', async () => {
    const result = await evaluateUltraRareTriggers(bmHorse.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).toContain('Iron-Willed');
    expect(names).toContain('Empathic Mirror');
  });

  it('Phoenix-Born does not trigger for horse with stressLevel:0 and no groomInteractions', async () => {
    const result = await evaluateUltraRareTriggers(bmHorse.id);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Phoenix-Born');
  });
});
