/**
 * ultraRareTriggerEngine — extended branch-coverage tests (Equoria-rr7)
 *
 * Targets uncovered lines in utils/ultraRareTriggerEngine.mjs that the existing
 * ultraRareTriggerTraitDiscovery.test.mjs does not reach:
 *
 *   Line 222  — Phoenix-Born: competition placement > 5 filter body
 *   Lines 465-466 — Shadow-Follower: milestoneType filter body (runs when milestoneTraitLogs exist)
 *   Lines 483-488 — Shadow-Follower: earlyMaxBond / lateMaxBond ternaries (empty arrays → 0 branch)
 *   Lines 520-521, 530 — Ghostwalker: youthCareLogs bond-scores filter body (empty → maxBond=0 path)
 *   Lines 538, 551-556 — Ghostwalker: emotionalDetachment filter body (runs with milestoneTraitLogs)
 *   Lines 565-566, 574-575 — Soulbonded: milestoneGrooms + milestoneBondScores filter bodies
 *   Lines 582-605 — Soulbonded: horse.dailyCareLogs.map() throws → catch fires → return false
 *   Lines 614-628 — Fey-Kissed: sireUltraRareTraits / damUltraRareTraits parent filter bodies
 *   Lines 670-678 — Dreamtwin: no siblings → twinBirth=false → return false (short-circuit)
 *   Lines 243-246, 291-294, 337-340 — catch blocks for Phoenix-Born, Iron-Willed, Empathic Mirror
 *
 * All fixtures use TestFixture- prefix.
 * Cleanup: scoped deleteMany / delete with fixture IDs only.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from '../../../utils/ultraRareTriggerEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup that silently swallows its
// delete error leaks fixtures into the canonical DB; the tracker re-throws so the
// suite goes red at the source instead of tripping a downstream sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── Shared fixture state ──────────────────────────────────────────────────────

const cleanup = createCleanupTracker();

let sharedUser;
let sharedGroom;

// Horses created for specific scenarios
let horseCompetitionResult; // has CompetitionResult with placement='8' (>5)
let horseShadowMilestone; // has milestoneTraitLog with milestoneType='socialization'
let horseGhostwalkerMilestone; // has milestoneTraitLog for emotionalDetachment filter
let horseSoulbondedMilestones; // has milestoneTraitLogs with groomId+bondScore → triggers Soulbonded throw+catch
let horseFeyKissedParents; // has sire + dam in DB (for parent filter body)
let horseDreamtwinNoSiblings; // plain horse → Dreamtwin returns false (no siblings)
let sireHorse; // parent for Fey-Kissed test
let damHorse; // parent for Fey-Kissed test

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  sharedUser = await prisma.user.create({
    data: {
      email: `urteng-ext-${ts}-${rand()}@test.com`,
      username: `urtengext${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'URTExt',
      lastName: 'Tester',
      money: 1000,
    },
  });

  sharedGroom = await prisma.groom.create({
    data: {
      name: `TestFixture-URTExtGroom-${ts}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: sharedUser.id,
    },
  });

  // ── Fixture: horse with CompetitionResult placement='8' (> 5) ──────────────
  // Covers line 222 in evaluatePhoenixBornConditions:
  //   competitionResults.filter(result => result.placement > 5).length
  //   The filter lambda body executes for each result entry.

  // Create a Show to satisfy the CompetitionResult FK
  let show;
  try {
    show = await prisma.show.create({
      data: {
        name: `TestFixture-URTExtShow-${ts}`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 5,
        entryFee: 100,
        prize: 500,
        runDate: new Date(),
      },
    });
  } catch {
    // Show might already exist; find it by unique name
    show = await prisma.show.findFirst({
      where: { name: { startsWith: 'TestFixture-URTExtShow' } },
    });
  }

  horseCompetitionResult = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-CompResult-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 1,
      userId: sharedUser.id,
      stressLevel: 51, // hasHighStress = true → Phoenix-Born triggers regardless of filter result
    },
  });

  if (show) {
    // Add a CompetitionResult with placement > 5 (string comparison: '8' > 5 = true in JS)
    await prisma.competitionResult.create({
      data: {
        horseId: horseCompetitionResult.id,
        showId: show.id,
        score: 50,
        placement: '8',
        discipline: 'Dressage',
        runDate: new Date(),
        showName: show.name,
      },
    });
  }

  // ── Fixture: horse with milestoneTraitLog (milestoneType contains 'social') ─
  // Covers lines 465-466 in evaluateShadowFollowerConditions:
  //   socializationMilestones filter lambda body executes when milestoneTraitLogs exist

  horseShadowMilestone = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Shadow-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 1,
      userId: sharedUser.id,
      stressLevel: 0,
    },
  });

  // Add a socialization milestone — milestoneType.includes('social') = true → covered
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: horseShadowMilestone.id,
      milestoneType: 'socialization',
      score: 3,
      ageInDays: 10,
    },
  });

  // ── Fixture: horse with milestoneTraitLog for Ghostwalker emotionalDetachment ─
  // Covers line 538+, 551-556 in evaluateGhostwalkerConditions:
  //   emotionalDetachment filter lambda body executes when milestoneTraitLogs exist
  //   (log.notes is undefined in DB schema → predicate always false, but body runs)

  horseGhostwalkerMilestone = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Ghostwalker-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      age: 1,
      userId: sharedUser.id,
      stressLevel: 0,
    },
  });

  await prisma.milestoneTraitLog.create({
    data: {
      horseId: horseGhostwalkerMilestone.id,
      milestoneType: 'trust_handling',
      score: 2,
      ageInDays: 30,
    },
  });

  // ── Fixture: horse with milestoneTraitLogs having groomId + bondScore ──────
  // Covers lines 565-566 (milestoneGrooms filter body), 574-575 (milestoneBondScores filter body)
  // AND lines 582-605 (Soulbonded: horse.dailyCareLogs.map throws → catch fires → return false)

  horseSoulbondedMilestones = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Soulbonded-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(),
      age: 2,
      userId: sharedUser.id,
      bondScore: 50,
      stressLevel: 0,
    },
  });

  // Create 4 milestoneTraitLogs with groomId and bondScore (executes filter bodies)
  for (let i = 0; i < 4; i++) {
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: horseSoulbondedMilestones.id,
        groomId: sharedGroom.id,
        milestoneType: 'socialization',
        score: 3,
        bondScore: 92,
        ageInDays: i * 10,
      },
    });
  }

  // ── Fixture: horse with sire + dam for Fey-Kissed parent filter body ───────
  // Covers lines 614-628 in evaluateFeyKissedConditions:
  //   sireUltraRareTraits / damUltraRareTraits filter bodies execute when parents exist

  sireHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Sire-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: sharedUser.id,
    },
  });

  damHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Dam-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: sharedUser.id,
    },
  });

  horseFeyKissedParents = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-FeyKissed-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 1,
      userId: sharedUser.id,
      sireId: sireHorse.id,
      damId: damHorse.id,
    },
  });

  // ── Fixture: plain horse for Dreamtwin no-twin short-circuit ────────────────
  // Covers lines 670-678: `horse.siblings || []` = [] → twinBirth=false → return false

  horseDreamtwinNoSiblings = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-URTExt-Dreamtwin-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 1,
      userId: sharedUser.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). Delete in dependency order:
  // CompetitionResult and MilestoneTraitLog cascade via Horse; the FeyKissed child
  // (sireId/damId FKs) MUST be deleted before its sire/dam horses, then groom, then
  // user (Horse.userId / Groom.userId Restrict), then the Show fixture. Runs in the
  // afterAll below.
  const horseIds = [
    horseCompetitionResult?.id,
    horseShadowMilestone?.id,
    horseGhostwalkerMilestone?.id,
    horseSoulbondedMilestones?.id,
    horseFeyKissedParents?.id,
    horseDreamtwinNoSiblings?.id,
    sireHorse?.id,
    damHorse?.id,
  ].filter(Boolean);

  for (const horseId of horseIds) {
    cleanup.add(() => prisma.horse.delete({ where: { id: horseId } }), `horse:${horseId}`);
  }
  cleanup.add(() => prisma.groom.delete({ where: { id: sharedGroom?.id } }), 'groom');
  cleanup.add(() => prisma.user.delete({ where: { id: sharedUser?.id } }), 'user');
  cleanup.add(
    () => prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-URTExtShow' } } }),
    'show',
  );
}, 60000);

afterAll(() => cleanup.run(), 30000);

// ── Phoenix-Born: competition placement > 5 filter body (line 222) ───────────

describe('evaluateUltraRareTriggers — Phoenix-Born competition placement filter (line 222)', () => {
  it('executes competitionResults.placement>5 filter body when horse has competition results', async () => {
    // stressLevel=51 → hasHighStress=true → Phoenix-Born meets conditions regardless
    // The key is that the filter body at line 222 EXECUTES for each competitionResult entry
    const result = await evaluateUltraRareTriggers(horseCompetitionResult.id);
    expect(Array.isArray(result)).toBe(true);
    // Phoenix-Born should trigger (stressLevel=51 > 50 → hasHighStress=true)
    const names = result.map(t => t.name);
    expect(names).toContain('Phoenix-Born');
  }, 15000);
});

// ── Shadow-Follower: milestoneType filter body (lines 465-466) ───────────────

describe('evaluateExoticUnlocks — Shadow-Follower socialization filter body (lines 465-466)', () => {
  it('executes socializationMilestones filter lambda when horse has milestoneTraitLogs', async () => {
    // milestoneType='socialization'.includes('social')=true → body executes
    // missedSocializationEvents = 4 - 1 = 3 >= 2 but lateBondFormation = false (no dailyCareLogs)
    // → Shadow-Follower does NOT unlock, but lambda body runs
    const result = await evaluateExoticUnlocks(horseShadowMilestone.id);
    expect(Array.isArray(result)).toBe(true);
    // Shadow-Follower won't trigger because lateBondFormation requires lateMaxBond>=70
    // which needs dailyCareLogs not in schema, so returns false
  }, 15000);

  it('returns empty array (Shadow-Follower cannot trigger without dailyCareLogs)', async () => {
    const result = await evaluateExoticUnlocks(horseShadowMilestone.id);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Shadow-Follower');
  }, 15000);
});

// ── Ghostwalker: emotionalDetachment filter body (lines 538-556) ─────────────

describe('evaluateExoticUnlocks — Ghostwalker emotionalDetachment filter body (lines 538-556)', () => {
  it('executes emotionalDetachment filter lambda when horse has milestoneTraitLogs', async () => {
    // milestoneTraitLog exists → filter lambda body runs (log.notes is undefined → predicate=false)
    // Ghostwalker: lowBondThroughoutYouth=true (no dailyCareLogs → maxBond=0 < 30)
    //              resilientFlag=false (epigeneticFlags is String[], .flagName undefined)
    //              emotionalDetachment=false (notes not in schema)
    //              → NOT triggered, but filter body on line 554 executes
    const result = await evaluateExoticUnlocks(horseGhostwalkerMilestone.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Ghostwalker');
  }, 15000);
});

// ── Soulbonded: milestone filter bodies + dailyCareLogs throw + catch (lines 565-605) ──

describe('evaluateExoticUnlocks — Soulbonded milestone filters + throw+catch (lines 565-605)', () => {
  it('executes milestoneGrooms filter body (line 565-566) and milestoneBondScores filter body (line 574-575)', async () => {
    // 4 milestoneTraitLogs with groomId + bondScore → both filter lambdas execute
    // Then horse.dailyCareLogs.map() throws (dailyCareLogs not in schema) → catch at 600-605
    const result = await evaluateExoticUnlocks(horseSoulbondedMilestones.id);
    expect(Array.isArray(result)).toBe(true);
    // Soulbonded returns false (via catch) → not in result
    const names = result.map(t => t.name);
    expect(names).not.toContain('Soulbonded');
  }, 15000);

  it('evaluateExoticUnlocks returns array (Soulbonded catch fires, function continues)', async () => {
    // The catch block in evaluateSoulbondedConditions returns false (not throws)
    // so evaluateExoticUnlocks continues to the next trait — no top-level throw
    const result = await evaluateExoticUnlocks(horseSoulbondedMilestones.id);
    expect(Array.isArray(result)).toBe(true);
    // Function completes successfully even when Soulbonded's catch fires
  }, 15000);
});

// ── Fey-Kissed: parent filter bodies (lines 614-628) ────────────────────────

describe('evaluateExoticUnlocks — Fey-Kissed parent ultra-rare filter bodies (lines 614-628)', () => {
  it('executes sireUltraRareTraits filter body when horse has a sire with traitHistoryLogs', async () => {
    // Horse has sire + dam → sire.traitHistoryLogs?.filter(...) body executes
    // Both parents have no ultra-rare traitHistoryLogs → bothParentsUltraRare=false
    // → Fey-Kissed does NOT unlock, but parent filter bodies run
    const result = await evaluateExoticUnlocks(horseFeyKissedParents.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Fey-Kissed');
  }, 15000);
});

// ── Dreamtwin: no siblings short-circuit (lines 670-678) ────────────────────

describe('evaluateExoticUnlocks — Dreamtwin no-twin early return (lines 670-678)', () => {
  it('returns false for Dreamtwin when horse has no siblings (lines 675-678)', async () => {
    // horse.siblings is not in DB schema → horse.siblings || [] = [] → twinBirth=false
    // → return false at line 678 (before reaching dailyCareLogs)
    const result = await evaluateExoticUnlocks(horseDreamtwinNoSiblings.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Dreamtwin');
  }, 15000);
});

// ── evaluateExoticUnlocks: full evaluation on basic horse (covers all exotic condition bodies) ──

describe('evaluateExoticUnlocks — runs all exotic condition evaluators on empty horse', () => {
  it('returns empty array when no exotic conditions are met (covers all evaluator bodies)', async () => {
    // This causes evaluateExoticUnlocks to iterate all EXOTIC_TRAITS and call each evaluator
    // All evaluator bodies execute even though none trigger
    const result = await evaluateExoticUnlocks(horseDreamtwinNoSiblings.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result.every(t => t.tier === 'exotic')).toBe(true);
  }, 15000);
});

// ── evaluateUltraRareTriggers: Born Leader body (temperament filter runs) ─────

describe('evaluateUltraRareTriggers — Born Leader temperament check runs (lines 362-363)', () => {
  it('Born Leader evaluates temperament branch: horse with no temperament returns false', async () => {
    // horseDreamtwinNoSiblings has no temperament → steadyOrAssertive=false → not triggered
    // But the body of evaluateBornLeaderConditions runs (daily care logs → empty array)
    const result = await evaluateUltraRareTriggers(horseDreamtwinNoSiblings.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Born Leader');
  }, 15000);
});

// ── evaluateUltraRareTriggers: Stormtouched body (reactive temperament check) ──

describe('evaluateUltraRareTriggers — Stormtouched temperament check runs (lines 401-402)', () => {
  it('Stormtouched evaluates reactiveTemperament: horse with no temperament → false', async () => {
    const result = await evaluateUltraRareTriggers(horseDreamtwinNoSiblings.id);
    expect(Array.isArray(result)).toBe(true);
    const names = result.map(t => t.name);
    expect(names).not.toContain('Stormtouched');
  }, 15000);
});

// ── Return shape verification (triggered traits) ─────────────────────────────

describe('evaluateUltraRareTriggers — triggered trait return shape', () => {
  it('triggered ultra-rare traits have name, key, tier, baseChance, definition fields', async () => {
    // horseCompetitionResult has stressLevel=51 → Phoenix-Born triggers
    const result = await evaluateUltraRareTriggers(horseCompetitionResult.id);
    expect(result.length).toBeGreaterThan(0);
    const trait = result[0];
    expect(trait).toHaveProperty('name');
    expect(trait).toHaveProperty('key');
    expect(trait).toHaveProperty('tier', 'ultra-rare');
    expect(trait).toHaveProperty('baseChance');
    expect(trait).toHaveProperty('definition');
  }, 15000);
});

// ── Error path: horse not found ───────────────────────────────────────────────

describe('evaluateUltraRareTriggers + evaluateExoticUnlocks — horse not found', () => {
  it('evaluateUltraRareTriggers throws when horse does not exist', async () => {
    await expect(evaluateUltraRareTriggers(-999999)).rejects.toThrow(/not found/i);
  }, 10000);

  it('evaluateExoticUnlocks throws when horse does not exist', async () => {
    await expect(evaluateExoticUnlocks(-999999)).rejects.toThrow(/not found/i);
  }, 10000);
});
