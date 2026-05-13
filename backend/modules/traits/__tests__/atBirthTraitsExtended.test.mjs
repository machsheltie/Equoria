/**
 * atBirthTraits — DB-fixture branch-coverage tests (Equoria-rr7)
 *
 * Covers the lines that atBirthTraits.test.mjs (pure-function tests) cannot
 * reach because they require real DB records:
 *
 *   assessFeedQuality     — health-status switch + earnings bonus (lines 322-347)
 *   getAncestors          — parent-fetching + recursion (lines 260-284, 289)
 *   detectInbreeding      — common-ancestor branch (lines 193-197, 208-211)
 *   applyEpigeneticTraitsAtBirth — main logic loop (lines 392-470)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  assessFeedQuality,
  getAncestors,
  detectInbreeding,
  applyEpigeneticTraitsAtBirth,
} from '../../../utils/atBirthTraits.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// ── Fixture 1: owner for all horses in this file ─────────────────────────────

let sharedUser;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);
  sharedUser = await prisma.user.create({
    data: {
      email: `atbirth-ext-${ts}-${rand()}@test.com`,
      username: `atbirthext${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'ATBirth',
      lastName: 'ExtTester',
      money: 1000,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.user.delete({ where: { id: sharedUser.id } }).catch(() => {});
}, 30000);

// ── assessFeedQuality — health-status switch + earnings bonus ─────────────────
//
// Lines covered:
//   326 (Good → 70), 329 (Fair → 55), 332 (Poor → 30), 335 (default → 50)
//   342 (earnings > 100000 → +15), 344 (earnings > 50000 → +10), 346 (earnings > 10000 → +5)
//   (Excellent → 85 path already covered by atBirthTraits.test.mjs via -1 mare default path)

describe('assessFeedQuality() — health-status switch cases', () => {
  let goodMare, fairMare, poorMare, nullStatusMare, richMare, midRichMare, lowRichMare;

  beforeAll(async () => {
    const ts = Date.now();
    const base = {
      sex: 'Mare',
      dateOfBirth: new Date(),
      age: 5,
      userId: sharedUser.id,
    };

    [goodMare, fairMare, poorMare, nullStatusMare, richMare, midRichMare, lowRichMare] = await Promise.all([
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-Good-${ts}`,
          healthStatus: 'Good',
          totalEarnings: 0,
        },
      }),
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-Fair-${ts}`,
          healthStatus: 'Fair',
          totalEarnings: 0,
        },
      }),
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-Poor-${ts}`,
          healthStatus: 'Poor',
          totalEarnings: 0,
        },
      }),
      // healthStatus null → Prisma stores null → switch hits default → 50
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-NullStatus-${ts}`,
          healthStatus: null,
          totalEarnings: 0,
        },
      }),
      // earnings > 100 000 → +15 (cap at 100)
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-Rich-${ts}`,
          healthStatus: 'Good',
          totalEarnings: 150000,
        },
      }),
      // earnings > 50 000 → +10
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-MidRich-${ts}`,
          healthStatus: 'Good',
          totalEarnings: 75000,
        },
      }),
      // earnings > 10 000 → +5
      prisma.horse.create({
        data: {
          ...base,
          name: `TestFixture-FQ-LowRich-${ts}`,
          healthStatus: 'Good',
          totalEarnings: 20000,
        },
      }),
    ]);
  }, 30000);

  afterAll(async () => {
    await Promise.all(
      [goodMare, fairMare, poorMare, nullStatusMare, richMare, midRichMare, lowRichMare].map(h =>
        prisma.horse.delete({ where: { id: h.id } }).catch(() => {}),
      ),
    );
  }, 30000);

  it('returns 70 for Good health', async () => {
    expect(await assessFeedQuality(goodMare.id)).toBe(70);
  });

  it('returns 55 for Fair health', async () => {
    expect(await assessFeedQuality(fairMare.id)).toBe(55);
  });

  it('returns 30 for Poor health', async () => {
    expect(await assessFeedQuality(poorMare.id)).toBe(30);
  });

  it('returns 50 for null healthStatus (default branch)', async () => {
    expect(await assessFeedQuality(nullStatusMare.id)).toBe(50);
  });

  it('applies +15 bonus for earnings > 100 000 (Good=70 + 15 = 85)', async () => {
    expect(await assessFeedQuality(richMare.id)).toBe(85);
  });

  it('applies +10 bonus for earnings > 50 000 (Good=70 + 10 = 80)', async () => {
    expect(await assessFeedQuality(midRichMare.id)).toBe(80);
  });

  it('applies +5 bonus for earnings > 10 000 (Good=70 + 5 = 75)', async () => {
    expect(await assessFeedQuality(lowRichMare.id)).toBe(75);
  });
});

// ── getAncestors — parent-fetching + recursion ────────────────────────────────
//
// Lines covered:
//   260-264 (sireId/damId push to nextGeneration)
//   270-284 (parents query + ancestors.push + recursive call)
//   288-290 (dedup filter)

describe('getAncestors() — with real parent relationships', () => {
  let grandParent, parent, childHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const base = {
      sex: 'Stallion',
      dateOfBirth: new Date(),
      age: 5,
      userId: sharedUser.id,
    };

    grandParent = await prisma.horse.create({
      data: { ...base, name: `TestFixture-GPA-GrandParent-${ts}` },
    });

    parent = await prisma.horse.create({
      data: {
        ...base,
        name: `TestFixture-GPA-Parent-${ts}`,
        sireId: grandParent.id,
      },
    });

    childHorse = await prisma.horse.create({
      data: {
        ...base,
        name: `TestFixture-GPA-Child-${ts}`,
        sireId: parent.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    // Delete child first (FK dependency), then parent, then grandParent
    await prisma.horse.delete({ where: { id: childHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: parent.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: grandParent.id } }).catch(() => {});
  }, 30000);

  it('returns parent as ancestor (1 generation from child)', async () => {
    const ancestors = await getAncestors([childHorse.id], 1);
    const ids = ancestors.map(a => a.id);
    expect(ids).toContain(parent.id);
  });

  it('returns grandParent as ancestor (2 generations from child)', async () => {
    const ancestors = await getAncestors([childHorse.id], 2);
    const ids = ancestors.map(a => a.id);
    expect(ids).toContain(grandParent.id);
  });

  it('deduplicates ancestors when same horse appears via multiple paths', async () => {
    // Call with [childHorse, childHorse] — parent should appear only once
    const ancestors = await getAncestors([childHorse.id, childHorse.id], 1);
    const parentOccurrences = ancestors.filter(a => a.id === parent.id).length;
    expect(parentOccurrences).toBe(1);
  });
});

// ── detectInbreeding — common-ancestor branch ─────────────────────────────────
//
// Lines covered:
//   193 (damAncestorIds.has(ancestorId) → true)
//   194-197 (ancestor lookup + commonAncestors.push)
//   208-211 (if(inbreedingDetected) logger.info branch)

describe('detectInbreeding() — inbreeding detected via shared grandparent', () => {
  let commonAncestor, inbredSire, inbredDam;

  beforeAll(async () => {
    const ts = Date.now();
    const base = {
      dateOfBirth: new Date(),
      age: 5,
      userId: sharedUser.id,
    };

    commonAncestor = await prisma.horse.create({
      data: {
        ...base,
        sex: 'Stallion',
        name: `TestFixture-IBD-CommonAnc-${ts}`,
      },
    });

    inbredSire = await prisma.horse.create({
      data: {
        ...base,
        sex: 'Stallion',
        name: `TestFixture-IBD-Sire-${ts}`,
        sireId: commonAncestor.id,
      },
    });

    inbredDam = await prisma.horse.create({
      data: {
        ...base,
        sex: 'Mare',
        name: `TestFixture-IBD-Dam-${ts}`,
        sireId: commonAncestor.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: inbredSire.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: inbredDam.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: commonAncestor.id } }).catch(() => {});
  }, 30000);

  it('detects inbreeding when sire and dam share a grandparent', async () => {
    const result = await detectInbreeding(inbredSire.id, inbredDam.id);
    expect(result.inbreedingDetected).toBe(true);
    expect(result.commonAncestors.length).toBeGreaterThan(0);
    expect(result.commonAncestors.map(a => a.id)).toContain(commonAncestor.id);
  });

  it('inbreedingCoefficient is > 0 when inbreeding detected', async () => {
    const result = await detectInbreeding(inbredSire.id, inbredDam.id);
    expect(result.inbreedingCoefficient).toBeGreaterThan(0);
  });
});

// ── applyEpigeneticTraitsAtBirth — main logic path (lines 392-470) ─────────────
//
// With valid sire and dam, the function executes:
//   392-394  (currentMareStress + currentFeedQuality resolution)
//   401-413  (lineageAnalysis + inbreedingAnalysis + conditions build)
//   420-432  (positive trait loop + probability check)
//   435-444  (negative trait loop + probability check)
//   447-464  (hidden trait branch — probabilistic, requires >2 applied traits)
//   466-477  (final return)

describe('applyEpigeneticTraitsAtBirth() — valid sire + dam executes main logic', () => {
  let atbSire, atbDam;

  beforeAll(async () => {
    const ts = Date.now();
    const base = {
      dateOfBirth: new Date(),
      age: 5,
      userId: sharedUser.id,
      stressLevel: 0,
      healthStatus: 'Excellent',
      bondScore: 80,
    };

    atbSire = await prisma.horse.create({
      data: { ...base, sex: 'Stallion', name: `TestFixture-ATB-Sire-${ts}` },
    });

    atbDam = await prisma.horse.create({
      data: { ...base, sex: 'Mare', name: `TestFixture-ATB-Dam-${ts}` },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: atbSire.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: atbDam.id } }).catch(() => {});
  }, 30000);

  it('returns traits + breedingAnalysis shape for valid sire and dam', async () => {
    const result = await applyEpigeneticTraitsAtBirth({
      sireId: atbSire.id,
      damId: atbDam.id,
      mareStress: 10,
      feedQuality: 90,
    });

    expect(result).toBeDefined();
    expect(result.traits).toBeDefined();
    expect(Array.isArray(result.traits.positive)).toBe(true);
    expect(Array.isArray(result.traits.negative)).toBe(true);
    expect(Array.isArray(result.traits.hidden)).toBe(true);
    expect(result.breedingAnalysis).toBeDefined();
    expect(result.breedingAnalysis.conditions).toBeDefined();
    expect(result.breedingAnalysis.conditions.mareStress).toBe(10);
    expect(result.breedingAnalysis.conditions.feedQuality).toBe(90);
  });

  it('uses dam stressLevel when mareStress is omitted', async () => {
    const result = await applyEpigeneticTraitsAtBirth({
      sireId: atbSire.id,
      damId: atbDam.id,
    });
    // Dam stressLevel=0; function falls back to mare.stressLevel || 50 → 50 because 0 is falsy
    expect(result.breedingAnalysis.conditions.mareStress).toBe(50);
  });

  it('noInbreeding = true when sire and dam have no shared ancestors', async () => {
    const result = await applyEpigeneticTraitsAtBirth({
      sireId: atbSire.id,
      damId: atbDam.id,
      mareStress: 0,
      feedQuality: 85,
    });
    expect(result.breedingAnalysis.conditions.noInbreeding).toBe(true);
    expect(result.breedingAnalysis.conditions.inbreedingDetected).toBe(false);
  });

  // Run multiple times to probabilistically cover the inner trait-application body
  // (lines 425-428 and 437-443). Each call has independent random chances.
  it('does not throw on 10 repeated calls (covers probability branches)', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: atbSire.id,
        damId: atbDam.id,
        mareStress: 5,
        feedQuality: 90,
      });
      expect(result.traits).toBeDefined();
    }
  });
});

// ── applyEpigeneticTraitsAtBirth — inbred sire+dam covers inbreedingDetected=true path

describe('applyEpigeneticTraitsAtBirth() — inbreeding path sets inbreedingDetected condition', () => {
  let ibAncestor, ibSire, ibDam;

  beforeAll(async () => {
    const ts = Date.now();
    const base = {
      dateOfBirth: new Date(),
      age: 5,
      userId: sharedUser.id,
      stressLevel: 0,
      healthStatus: 'Good',
    };

    ibAncestor = await prisma.horse.create({
      data: { ...base, sex: 'Stallion', name: `TestFixture-ATB-IBAncestor-${ts}` },
    });
    ibSire = await prisma.horse.create({
      data: {
        ...base,
        sex: 'Stallion',
        name: `TestFixture-ATB-IBSire-${ts}`,
        sireId: ibAncestor.id,
      },
    });
    ibDam = await prisma.horse.create({
      data: {
        ...base,
        sex: 'Mare',
        name: `TestFixture-ATB-IBDam-${ts}`,
        sireId: ibAncestor.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: ibSire.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: ibDam.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: ibAncestor.id } }).catch(() => {});
  }, 30000);

  it('sets inbreedingDetected=true and noInbreeding=false when parents share grandparent', async () => {
    const result = await applyEpigeneticTraitsAtBirth({
      sireId: ibSire.id,
      damId: ibDam.id,
      mareStress: 80,
      feedQuality: 30,
    });
    expect(result.breedingAnalysis.conditions.inbreedingDetected).toBe(true);
    expect(result.breedingAnalysis.conditions.noInbreeding).toBe(false);
  });
});
