/**
 * flagPredispositionInheritance.integration.test.mjs (Equoria-yzqhj.4)
 *
 * Real-DB integration proof of the parent → foal epigenetic FLAG inheritance
 * PREDISPOSITION model (Equoria-yzqhj.4).
 *
 * MODEL UNDER TEST:
 *   Foals are NOT born with inherited flags. Behavioral flags still come ONLY
 *   from the 0-3yr care evaluation (evaluateHorseFlags). Predisposition means a
 *   flag present in EITHER parent (union) biases the foal's care-evaluation:
 *   the SAME borderline care pattern is more likely to trigger that one flag.
 *   The bias is a single conservative constant FLAG_PREDISPOSITION_BIAS = 0.85
 *   (a 15% relaxation of that flag's numeric care thresholds). It only ever
 *   lowers a bar — never auto-grants a flag with no care.
 *
 * SENTINEL DESIGN (deterministic, no mocks of internal code, real DB):
 *   Two foals get an IDENTICAL borderline 7-window care pattern that lands the
 *   `affectionate` flag JUST BELOW its normal trigger threshold
 *   (daysWithInteraction = 6, threshold normally requires >= 7; bondScore = 50;
 *   qualityInteractions = 6 >= 5).
 *     - predisposedFoal: both parents carry 'affectionate'. With the 15% bias,
 *       relaxMin(7) = 5.95, so 6 >= 5.95 → the flag DEVELOPS.
 *     - controlFoal: parents carry NO flags. Threshold stays 7, so 6 >= 7 is
 *       false → the flag does NOT develop.
 *   Same care, opposite outcome — proves the bias fires AND that a
 *   no-parent-flags foal is unaffected (regression).
 *
 * The care inputs are fully controlled (fixed groom-interaction rows on fixed
 * calendar days), so the inequality is robust, not flaky.
 *
 * NOTE: this worktree may not execute the real-DB suite (workspace
 * node_modules / DB availability is the lead's serial integration gate).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { evaluateHorseFlags } from '../../../utils/flagEvaluationEngine.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const randHex = () => Math.random().toString(16).slice(2, 10);

// Helper: build a borderline `affectionate` care pattern — 6 distinct calendar
// days of good-quality, positive-bond grooming inside the last 7 days. This is
// just-below the normal daysWithInteraction >= 7 threshold.
async function seedBorderlineAffectionateCare(foalId, groomId) {
  const rows = [];
  // Days 1..6 ago (6 DISTINCT calendar days, all within the 7-day analysis
  // window). Deliberately NOT 7, to sit just under the normal threshold.
  for (let daysAgo = 1; daysAgo <= 6; daysAgo += 1) {
    const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    rows.push({
      foalId,
      groomId,
      interactionType: 'daily_grooming',
      duration: 30,
      bondingChange: 3, // positive (counts toward positiveInteractions)
      stressChange: 0,
      quality: 'good', // counts toward qualityInteractions (good/excellent)
      taskType: 'grooming',
      qualityScore: 0.8,
      createdAt: when,
      timestamp: when,
    });
  }
  await prisma.groomInteraction.createMany({ data: rows });
}

describe('parent → foal flag predisposition (Equoria-yzqhj.4) — real DB', () => {
  let user;
  let groom;
  let predisposedSire;
  let predisposedDam;
  let controlSire;
  let controlDam;
  let predisposedFoal;
  let controlFoal;
  const parentIds = [];
  const foalIds = [];
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `TestFixture-flagpre-${randHex()}`,
        email: `testfixture-flagpre-${randHex()}@example.com`,
        password: 'x',
        firstName: 'TestFixture',
        lastName: 'FlagPredisposition',
      },
    });

    groom = await prisma.groom.create({
      data: {
        name: `TestFixture-flagpre-groom-${randHex()}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'expert',
        userId: user.id,
      },
    });

    // Parents are adults (age irrelevant to predisposition — only their
    // epigeneticFlags are read). Predisposed parents BOTH carry 'affectionate';
    // control parents carry NO flags.
    const adultDob = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    predisposedSire = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-psire-${randHex()}`,
        sex: 'Stallion',
        dateOfBirth: adultDob,
        userId: user.id,
        epigeneticFlags: ['affectionate'],
      },
      parentIds,
    );
    predisposedDam = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-pdam-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: adultDob,
        userId: user.id,
        epigeneticFlags: ['affectionate'],
      },
      parentIds,
    );
    controlSire = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-csire-${randHex()}`,
        sex: 'Stallion',
        dateOfBirth: adultDob,
        userId: user.id,
        epigeneticFlags: [],
      },
      parentIds,
    );
    controlDam = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-cdam-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: adultDob,
        userId: user.id,
        epigeneticFlags: [],
      },
      parentIds,
    );

    // Foals: born ~7 real days ago → ~1 game-year (inside the 0-3yr window).
    // bondScore = 50 meets the affectionate bond threshold; the day-count is
    // what we hold borderline. Identical for both foals.
    const foalDob = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    predisposedFoal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-pfoal-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: foalDob,
        userId: user.id,
        bondScore: 50,
        stressLevel: 5,
        epigeneticFlags: [],
        sireId: predisposedSire.id,
        damId: predisposedDam.id,
      },
      foalIds,
    );
    controlFoal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-cfoal-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: foalDob,
        userId: user.id,
        bondScore: 50,
        stressLevel: 5,
        epigeneticFlags: [],
        sireId: controlSire.id,
        damId: controlDam.id,
      },
      foalIds,
    );

    // IDENTICAL borderline care pattern for both foals.
    await seedBorderlineAffectionateCare(predisposedFoal.id, groom.id);
    await seedBorderlineAffectionateCare(controlFoal.id, groom.id);
  }, 60000);

  afterAll(async () => {
    // Scoped, fail-loud cleanup (Equoria-1ohys), children-before-parents to
    // respect the foal->parent self FK and Horse.userId onDelete:Restrict.
    // foalIds includes the orphan foal created in the second `it`.
    cleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { foalId: { in: foalIds } } }),
      'groomInteraction',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: foalIds } } }), 'foals');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: parentIds } } }), 'parents');
    if (groom) {
      cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
    }
    if (user) {
      cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    }
    await cleanup.run();
  }, 60000);

  it('predisposed foal develops the inherited flag from borderline care; control foal does not', async () => {
    const predResult = await evaluateHorseFlags(predisposedFoal.id);
    const ctrlResult = await evaluateHorseFlags(controlFoal.id);

    expect(predResult.success).toBe(true);
    expect(ctrlResult.success).toBe(true);

    // SENTINEL-POSITIVE: the bias actually fires for the predisposed foal.
    expect(predResult.newFlags).toContain('affectionate');

    // REGRESSION: identical care, but no parent flags → no bias → no flag.
    expect(ctrlResult.newFlags).not.toContain('affectionate');

    // The defined difference is exactly the affectionate flag.
    const predExtra = predResult.newFlags.filter(f => !ctrlResult.newFlags.includes(f));
    expect(predExtra).toContain('affectionate');

    // Engine surfaces the predisposition flag on the affectionate evaluation
    // for the predisposed foal and NOT for the control.
    const predAff = predResult.flagEvaluations.find(e => e.flagName === 'affectionate');
    const ctrlAff = ctrlResult.flagEvaluations.find(e => e.flagName === 'affectionate');
    expect(predAff.predisposed).toBe(true);
    expect(predAff.triggered).toBe(true);
    expect(ctrlAff.predisposed).toBe(false);
    expect(ctrlAff.triggered).toBe(false);
  }, 60000);

  it('a foal with NO parents is unaffected (no predisposition, behaves as before)', async () => {
    // Regression guard: a parentless foal gets an empty predisposed set, so the
    // SAME borderline care pattern must NOT trigger the flag (proves
    // predisposition is the only thing that changed for the predisposed foal).
    const orphanFoal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagpre-orphan-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        userId: user.id,
        bondScore: 50,
        stressLevel: 5,
        epigeneticFlags: [],
        // sireId / damId intentionally omitted → null parents.
      },
      foalIds,
    );
    // orphanFoal is recorded in foalIds (createTestHorse pushes it), so the
    // suite afterAll fail-loud sweep deletes its groomInteractions + the horse.
    // No swallowed per-test finally-delete (Equoria-1ohys): a throwing finally
    // would mask the assertions below, and the suite sweep already covers it.
    await seedBorderlineAffectionateCare(orphanFoal.id, groom.id);
    const result = await evaluateHorseFlags(orphanFoal.id);
    expect(result.success).toBe(true);
    expect(result.newFlags).not.toContain('affectionate');
    const aff = result.flagEvaluations.find(e => e.flagName === 'affectionate');
    expect(aff.predisposed).toBe(false);
    expect(aff.triggered).toBe(false);
  }, 60000);
});
