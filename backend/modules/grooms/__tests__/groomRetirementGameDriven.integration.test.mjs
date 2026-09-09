/**
 * Task 19 / Equoria-m9lz1 — the game retires grooms, at a hidden age, in one
 * transaction, and tells the player.
 *
 * The owner's ruling (2026-09-08): "Grooms retire automatically at a randomly
 * selected age by the game. They can retire any time between age 50-65 and that
 * is not known until the week they retire. […] The game should notify a player
 * [when] their groom is retiring so they can select a new one."
 *
 * The player-facing closure of `POST /grooms/:id/retirement/process` is locked
 * by the sibling `groomRetirementEndpointClosed.integration.test.mjs`. THIS file
 * covers the four things the game side must guarantee:
 *
 *   1. THE AGE IS DRAWN ONCE, IN RANGE, AND VARIES. `ensureRetirementSchedule`
 *      draws from [50, 65] inclusive, persists it, and returns the SAME value on
 *      every later call. Across many grooms the ages are in range and are not
 *      all identical — the pre-m9lz1 rule was a single hard-coded 104 for
 *      everybody.
 *
 *   2. THE AGE IS NOT DISCOVERABLE.
 *
 *      WHAT THIS TEST ACTUALLY DRIVES — eight endpoints, each asserted to answer
 *      200 (so a 4xx cannot make the audit vacuous) and then walked for a
 *      `retirementAge` / `retirementSchedule` key at any depth:
 *        GET /api/v1/grooms/user/:userId               (roster list, whole groom rows)
 *        GET /api/v1/grooms/:id/profile
 *        GET /api/v1/grooms/:id/assignment-logs
 *        GET /api/v1/grooms/assignments/:foalId
 *        GET /api/v1/groom-assignments/?includeInactive=true
 *        GET /api/v1/grooms/retirement/statistics
 *        GET /api/v1/groom-marketplace/
 *        GET /api/v1/groom-handlers/horse/:horseId
 *      The sibling groomRetirementEndpointClosed suite drives a ninth,
 *      GET /:id/retirement/eligibility, and additionally asserts the absence of
 *      the two derived fields — `weeksUntilRetirement` and `noticeRequired` —
 *      that used to hand a client the age by subtraction.
 *
 *      WHAT IS REASONED ABOUT, NOT DRIVEN. Other code reads groom rows —
 *      gdprAccountService's export, conformationShowController, the enhanced
 *      groom controller, horseOverviewController — and this file does not
 *      exercise them. The guarantee for those is STRUCTURAL rather than
 *      observed: the age is a 1:1 relation on a separate table, and Prisma
 *      returns a relation only when a caller explicitly `include`s or `select`s
 *      it. Every one of those reads is a bare `findMany` / `findUnique` or a
 *      scalar `select`, so none of them can emit it. That argument holds for
 *      groom reads written in future too, which a per-endpoint assertion could
 *      not — but it is an argument, not evidence, and it stops being true the
 *      moment someone adds `include: { retirementSchedule: true }` to a
 *      player-facing read. A route-table sentinel walking every mounted groom
 *      read would be the observed version; it is not written.
 *
 *   3. RETIREMENT PRESERVES HISTORY AND IS ATOMIC. A groom that reaches its age
 *      is retired by the weekly game pass: active assignments are ENDED
 *      (`isActive: false` + `endDate`), inactive assignment rows are untouched,
 *      `groom_interactions.assignmentId` still points at its assignment, and the
 *      open `GroomAssignmentLog` is closed. Pre-fix, `processRetirement` ran
 *      `groomAssignment.deleteMany({ where: { groomId } })` — every row for the
 *      groom — outside any transaction.
 *
 *   4. THE NOTIFICATION IS PART OF THE RETIREMENT. Exactly one `groom_retired`
 *      Notification reaches the groom's own user and nobody else, its payload
 *      names the groom and how many horses were left uncovered, and it carries no
 *      retirement age. That it is written INSIDE the retirement transaction is
 *      proven by the source sentinel plus the double-retire case rather than by an
 *      injected mid-flight failure — see the long comment above the sentinel for
 *      what was tried, why it was dropped, and exactly what is therefore argued
 *      rather than observed.
 *
 * Real database. No mocks of any Equoria-owned path. Fixtures are uniquely named
 * and cleaned up by id in FK order.
 *
 * @module modules/grooms/__tests__/groomRetirementGameDriven.integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  CAREER_CONSTANTS,
  GROOM_RETIRED_NOTIFICATION_TYPE,
  checkRetirementEligibility,
  processRetirement,
  processWeeklyCareerProgression,
} from '../services/groomRetirementService.mjs';
import {
  drawRetirementAge,
  ensureRetirementSchedule,
  readRetirementAge,
} from '../services/groomRetirementScheduleService.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-m9lz1-game';

const tag = () => randomBytes(6).toString('hex');

async function makeUser(label) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Task19',
      lastName: label,
      money: 5000,
      settings: {},
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, label) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2024-06-15'),
      age: 1,
      userId: ownerId,
      healthStatus: 'Excellent',
    },
  });
}

async function makeGroom(ownerId, label, extra = {}) {
  return prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      skillLevel: 'intermediate',
      level: 3,
      careerWeeks: 5,
      userId: ownerId,
      ...extra,
    },
  });
}

/**
 * Pure detector over the retirement service's SOURCE TEXT: the whole retirement
 * must be one transaction, and nothing may delete assignment rows. Pure so the
 * sibling case can prove it FIRES on planted violations rather than only staying
 * green (CONTRIBUTING.md: "a doctrine/sentinel test must prove that its detector
 * fires on a planted violation as well as passes on compliant code").
 *
 * Returns human-readable findings; an empty array means compliant.
 */
function auditRetirementTransactionBoundary(rawSource) {
  const findings = [];

  // Scan CODE, not prose. The service's own header explains the pre-m9lz1
  // defect by quoting `groomAssignment.deleteMany({ where: { groomId } })`, and
  // an unstripped scan flags that documentation as the violation it warns about
  // — a false positive that would have forced the fix's own explanation out of
  // the file. Block comments are removed non-greedily; line comments to EOL.
  const source = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  const txOccurrences = source.match(/prisma\.\$transaction\(/g) ?? [];
  const hasAssignmentDelete = /groomAssignment\.delete(Many)?\(/.test(source);

  if (hasAssignmentDelete) {
    findings.push('found a groomAssignment delete — retirement must END rows, never remove them');
  }

  if (txOccurrences.length !== 1) {
    findings.push(`expected exactly one prisma.$transaction( in the retirement service, found ${txOccurrences.length}`);
    // Without a single boundary the "inside the transaction" checks are
    // meaningless, so report what is known and stop.
    return findings;
  }

  // The transaction body: from the single `prisma.$transaction(` to the `});`
  // that closes the callback at its own indentation.
  //
  // FAIL CLOSED when that literal is absent. The first version fell back to
  // `source.slice(txStart)` — the rest of the FILE — so a reformat that changed
  // the closing indentation would have silently widened the body to include every
  // later function, and the four "is it inside the transaction" checks below would
  // then pass on code that had moved OUT of it. A detector that breaks toward
  // green is worse than no detector, so an unlocatable body is a finding.
  const txStart = source.indexOf('prisma.$transaction(');
  const txEnd = source.indexOf('\n  });', txStart);
  if (txEnd === -1) {
    findings.push(
      'could not locate the end of the retirement transaction body (expected a "\\n  });" ' +
        'closing the callback) — the boundary checks below cannot be trusted, so this is a ' +
        'failure rather than a pass. If the file was reformatted, update this extraction.',
    );
    return findings;
  }
  const txBody = source.slice(txStart, txEnd);

  const required = [
    ['tx.groom.updateMany(', 'the guarded groom flip'],
    ['tx.groomAssignment.updateMany(', 'ending the active assignments'],
    ['tx.groomAssignmentLog.updateMany(', 'closing the open assignment logs'],
    ['createNotificationTx(', 'the notification (createNotificationTx on the same tx)'],
  ];
  for (const [needle, label] of required) {
    if (!txBody.includes(needle)) {
      findings.push(`${label} is not inside the retirement transaction (missing ${needle})`);
    }
  }

  // The notification must take the transaction client, not the global one.
  if (txBody.includes('createNotificationTx(') && !/createNotificationTx\(\s*\n?\s*tx,/.test(txBody)) {
    findings.push('createNotificationTx is not being passed the transaction client as its first argument');
  }

  return findings;
}

/**
 * Walk a decoded JSON body and collect every key name at every depth. Asserting
 * on key NAMES rather than on the age's numeric value is deliberate: a bare
 * integer in 50..65 could coincide with `careerWeeks`, `level` or a price, so a
 * value scan would be both flaky and weak. A leaked age has to arrive under a
 * name, and Prisma only ever emits it as `retirementAge` (scalar) or nested
 * under `retirementSchedule` (relation).
 */
function collectKeys(node, out = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectKeys(item, out);
    }
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      out.add(key);
      collectKeys(value, out);
    }
  }
  return out;
}

describe('Equoria-m9lz1 — the hidden retirement age', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let groom;

  beforeEach(async () => {
    owner = await makeUser('ageowner');
    groom = await makeGroom(owner.id, 'agegroom');

    const ids = { groomId: groom.id, userId: owner.id };
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: ids.groomId } }),
      'retirement schedule',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: ids.groomId } }), 'groom');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: ids.userId } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('drawRetirementAge only ever produces integers in [50, 65]', () => {
    // 400 pure draws: no fixtures, no database, so the range assertion is cheap
    // enough to be exhaustive rather than indicative.
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const age = drawRetirementAge();
      expect(Number.isInteger(age)).toBe(true);
      expect(age).toBeGreaterThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MIN);
      expect(age).toBeLessThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MAX);
      seen.add(age);
    }
    // Not a single constant, and not a band narrower than the ruling allows.
    // P(fewer than 8 distinct values across 400 uniform draws over 16) is
    // vanishing; a hard-coded or modulo-collapsed implementation fails here.
    expect(seen.size).toBeGreaterThanOrEqual(8);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(50);
    expect(Math.max(...seen)).toBeLessThanOrEqual(65);
  });

  it('persists the age once and returns the SAME value on every later call', async () => {
    const first = await ensureRetirementSchedule(prisma, groom.id);
    const second = await ensureRetirementSchedule(prisma, groom.id);
    const third = await readRetirementAge(prisma, groom.id);

    expect(first).toBe(second);
    expect(third).toBe(first);

    // Exactly one row, inside the band the database also enforces.
    const rows = await prisma.groomRetirementSchedule.findMany({
      where: { groomId: groom.id },
      select: { groomId: true, retirementAge: true },
    });
    expect(rows).toEqual([{ groomId: groom.id, retirementAge: first }]);
    expect(first).toBeGreaterThanOrEqual(50);
    expect(first).toBeLessThanOrEqual(65);
  }, 30000);

  it('two concurrent first-time callers produce ONE schedule, not two ages', async () => {
    const [a, b] = await Promise.all([
      ensureRetirementSchedule(prisma, groom.id),
      ensureRetirementSchedule(prisma, groom.id),
    ]);

    // Whichever won, both callers see the stored value.
    const stored = await readRetirementAge(prisma, groom.id);
    expect(a).toBe(stored);
    expect(b).toBe(stored);
    expect(await prisma.groomRetirementSchedule.count({ where: { groomId: groom.id } })).toBe(1);
  }, 30000);

  it('returns not_scheduled — never a guessed age — for a groom with no schedule', async () => {
    expect(await readRetirementAge(prisma, groom.id)).toBeNull();
    const eligibility = await checkRetirementEligibility(groom.id);
    expect(eligibility).toEqual({ eligible: false, reason: 'not_scheduled', mandatory: false });
  }, 30000);
});

describe('Equoria-m9lz1 — retirement ages across many grooms are in range and vary', () => {
  const cleanup = createCleanupTracker();

  afterEach(() => cleanup.run(), 60000);

  it('30 generated grooms all fall in 50..65 inclusive and are not all identical', async () => {
    const owner = await makeUser('distowner');
    const groomIds = [];
    for (let i = 0; i < 30; i++) {
      const g = await makeGroom(owner.id, `dist${i}`);
      groomIds.push(g.id);
    }

    const ids = { groomIds, userId: owner.id };
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: ids.groomIds } } }),
      'retirement schedules',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.groomIds } } }), 'grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: ids.userId } }), 'user');

    const ages = [];
    for (const id of groomIds) {
      ages.push(await ensureRetirementSchedule(prisma, id));
    }

    expect(ages).toHaveLength(30);
    for (const age of ages) {
      expect(Number.isInteger(age)).toBe(true);
      expect(age).toBeGreaterThanOrEqual(50);
      expect(age).toBeLessThanOrEqual(65);
    }
    // The pre-m9lz1 rule was one constant (104) for every groom. This is the
    // assertion that fails if the "random" age is anything but per-groom.
    expect(new Set(ages).size).toBeGreaterThan(1);
  }, 120000);
});

describe('Equoria-m9lz1 — no player-visible groom response discloses the retirement age', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let horse;
  let groom;
  let retirementAge;

  beforeEach(async () => {
    owner = await makeUser('hideowner');
    horse = await makeHorse(owner.id, 'hidehorse');
    groom = await makeGroom(owner.id, 'hidegroom');
    retirementAge = await ensureRetirementSchedule(prisma, groom.id);

    const assignment = await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: owner.id, isActive: true },
    });
    const log = await prisma.groomAssignmentLog.create({
      data: { groomId: groom.id, horseId: horse.id },
    });

    const ids = {
      assignmentId: assignment.id,
      logId: log.id,
      groomId: groom.id,
      horseId: horse.id,
      userId: owner.id,
    };
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: ids.assignmentId } }), 'groom assignment');
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { id: ids.logId } }), 'groom assignment log');
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: ids.groomId } }),
      'retirement schedule',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: ids.groomId } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: ids.horseId } }), 'fixture horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: ids.userId } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('the schedule row exists, so a leak would be visible if one occurred', async () => {
    expect(retirementAge).toBeGreaterThanOrEqual(50);
    expect(retirementAge).toBeLessThanOrEqual(65);
    expect(await readRetirementAge(prisma, groom.id)).toBe(retirementAge);
  }, 30000);

  it('every audited groom read endpoint answers without a retirementAge/retirementSchedule key', async () => {
    const paths = [
      `/api/v1/grooms/user/${owner.id}`,
      `/api/v1/grooms/${groom.id}/profile`,
      `/api/v1/grooms/${groom.id}/assignment-logs`,
      `/api/v1/grooms/assignments/${horse.id}`,
      '/api/v1/groom-assignments/?includeInactive=true',
      '/api/v1/grooms/retirement/statistics',
      '/api/v1/groom-marketplace/',
      `/api/v1/groom-handlers/horse/${horse.id}`,
    ];

    const audited = [];
    for (const path of paths) {
      const res = await request(app).get(path).set('Authorization', `Bearer ${owner.token}`).set('Origin', ORIGIN);

      // A route that 4xx/5xx'd for an unrelated reason would make this audit
      // vacuous, so every path must actually answer 200.
      expect({ path, status: res.status }).toEqual({ path, status: 200 });

      const keys = collectKeys(res.body);
      expect({ path, leaked: keys.has('retirementAge') }).toEqual({ path, leaked: false });
      expect({ path, leaked: keys.has('retirementSchedule') }).toEqual({ path, leaked: false });
      // Belt and braces on the serialized text, which also catches a key that
      // arrived under different casing or inside a string blob.
      expect({ path, text: /retirementAge|retirementSchedule/i.test(JSON.stringify(res.body)) }).toEqual({
        path,
        text: false,
      });

      audited.push(path);
    }

    // Guard against the loop silently auditing nothing.
    expect(audited).toEqual(paths);
  }, 120000);
});

describe('Equoria-m9lz1 — the game path retires, preserves history, and notifies', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let bystander;
  let horse;
  let groom;
  let youngGroom;
  let retirementAge;
  let activeAssignmentId;
  let historicalAssignmentId;
  let interactionId;
  let logId;

  beforeEach(async () => {
    owner = await makeUser('gameowner');
    bystander = await makeUser('bystander');
    horse = await makeHorse(owner.id, 'gamehorse');
    groom = await makeGroom(owner.id, 'gamegroom', { level: 3 });
    // A second groom of the same user, far below any retirement age, to prove
    // the pass retires the one that reached its age and only that one.
    youngGroom = await makeGroom(owner.id, 'younggroom', { careerWeeks: 1, level: 2 });

    retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    // One tick short: the weekly pass increments careerWeeks first, so this
    // groom reaches exactly its retirement age during the pass — "the week they
    // retire".
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - 1 },
    });

    const historical = await prisma.groomAssignment.create({
      data: {
        groomId: groom.id,
        foalId: horse.id,
        userId: owner.id,
        isActive: false,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-02-01'),
      },
    });
    historicalAssignmentId = historical.id;

    const interaction = await prisma.groomInteraction.create({
      data: {
        groomId: groom.id,
        foalId: horse.id,
        assignmentId: historical.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 4,
        stressChange: -2,
        quality: 'excellent',
      },
    });
    interactionId = interaction.id;

    const active = await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: owner.id, isActive: true },
    });
    activeAssignmentId = active.id;

    const log = await prisma.groomAssignmentLog.create({
      data: { groomId: groom.id, horseId: horse.id },
    });
    logId = log.id;

    const ids = {
      interactionId,
      assignmentIds: [activeAssignmentId, historicalAssignmentId],
      logId,
      groomIds: [groom.id, youngGroom.id],
      horseId: horse.id,
      userIds: [owner.id, bystander.id],
    };
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: ids.userIds } } }), 'notifications');
    cleanup.add(
      () => prisma.groomLegacyLog.deleteMany({ where: { retiredGroomId: { in: ids.groomIds } } }),
      'legacy logs',
    );
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { id: ids.interactionId } }), 'groom interaction');
    cleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { id: { in: ids.assignmentIds } } }),
      'groom assignments',
    );
    cleanup.add(() => prisma.groomAssignmentLog.deleteMany({ where: { id: ids.logId } }), 'groom assignment log');
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: ids.groomIds } } }),
      'retirement schedules',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.groomIds } } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: ids.horseId } }), 'fixture horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }), 'fixture users');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);

  it('retires the groom that reached its age, ends assignments without deleting any, and notifies the owner', async () => {
    const result = await processWeeklyCareerProgression(owner.id);

    // The pass touched both grooms and retired exactly the one that aged out.
    expect(result.errors).toEqual([]);
    expect(result.processed).toBe(2);
    expect(result.retired).toBe(1);
    expect(result.retirements).toEqual([
      expect.objectContaining({ groomId: groom.id, reason: 'age', careerWeeks: retirementAge }),
    ]);

    const retiredRow = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { retired: true, isActive: true, retirementReason: true, careerWeeks: true },
    });
    expect(retiredRow).toEqual({
      retired: true,
      isActive: false,
      retirementReason: 'age',
      careerWeeks: retirementAge,
    });

    // The young groom simply aged a year and kept working.
    const youngRow = await prisma.groom.findUnique({
      where: { id: youngGroom.id },
      select: { retired: true, careerWeeks: true },
    });
    expect(youngRow).toEqual({ retired: false, careerWeeks: 2 });

    // BOTH assignment rows still exist. Pre-fix, `deleteMany({ groomId })` left
    // zero. The active one is ended with a real endDate; the historical one is
    // byte-identical to how it was created.
    const rows = await prisma.groomAssignment.findMany({
      where: { groomId: groom.id },
      orderBy: { id: 'asc' },
      select: { id: true, isActive: true, endDate: true },
    });
    expect(rows).toHaveLength(2);

    const historical = rows.find(r => r.id === historicalAssignmentId);
    expect(historical.isActive).toBe(false);
    expect(historical.endDate).toEqual(new Date('2025-02-01'));

    const active = rows.find(r => r.id === activeAssignmentId);
    expect(active.isActive).toBe(false);
    expect(active.endDate).toBeInstanceOf(Date);

    // Care history is still linked to the assignment that produced it. The
    // assignmentId FK is ON DELETE SET NULL, so the pre-fix delete nulled this.
    const interaction = await prisma.groomInteraction.findUnique({
      where: { id: interactionId },
      select: { assignmentId: true, bondingChange: true },
    });
    expect(interaction).toEqual({ assignmentId: historicalAssignmentId, bondingChange: 4 });

    // The open assignment log is closed rather than left permanently open.
    const log = await prisma.groomAssignmentLog.findUnique({
      where: { id: logId },
      select: { unassignedAt: true },
    });
    expect(log.unassignedAt).toBeInstanceOf(Date);

    // Exactly one notification, to the groom's own user and nobody else.
    const notifications = await prisma.notification.findMany({
      where: { userId: owner.id, type: GROOM_RETIRED_NOTIFICATION_TYPE },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].isRead).toBe(false);
    expect(notifications[0].payload).toMatchObject({
      groomId: groom.id,
      groomName: groom.name,
      reason: 'age',
      horsesLeftUnattended: 1,
    });
    // The announcement must not carry the number it announces the arrival of.
    expect(collectKeys(notifications[0].payload).has('retirementAge')).toBe(false);
    expect(JSON.stringify(notifications[0].payload)).not.toMatch(/retirementAge/i);

    expect(await prisma.notification.count({ where: { userId: bystander.id } })).toBe(0);
  }, 120000);

  // Equoria-m9lz1 — HOW THE TRANSACTION BOUNDARY IS PROVEN, AND WHAT WAS TRIED.
  //
  // The first attempt here was a real mid-flight failure: a second real
  // `prisma.$transaction` took a row lock on the groom's active GroomAssignment
  // (the retirement's SECOND write) and held it, so the retirement's FIRST write
  // — the groom flip — would succeed inside its transaction and the second would
  // block until Prisma aborted it. That is exactly the "failed midway" shape, and
  // asserting the groom flip was gone afterwards would have proven all-or-nothing
  // by observation. It does not work in this harness: holding an interactive
  // transaction open starves the test Prisma pool of the connection the
  // retirement transaction needs, and the run ended with "Prisma test client 1
  // disconnect failed: disconnect timed out after 10000ms" plus a Jest
  // environment-teardown AggregateError that discarded the whole suite's results
  // (`Tests: 0 total`), and leaked fixtures. Rather than weaken the claim or
  // leave a flaky suite behind, the boundary is proven two other ways and the
  // gap is recorded here:
  //
  //   (a) the SOURCE SENTINEL below, which fails on the pre-m9lz1 implementation
  //       (no `$transaction` at all, plus a `groomAssignment.deleteMany`); and
  //   (b) the real-database double-retire case that follows, which drives the
  //       guarded conditional flip and asserts the LOSER wrote nothing — no
  //       second notification, no re-stamped endDate.
  //
  // What is NOT proven by observation: that a failure between writes 2 and 4
  // rolls write 1 back. That is a property of `prisma.$transaction` itself plus
  // the sentinel's guarantee that all four writes sit inside it — an argument,
  // not an observation. A harness that can hold a lock without starving the pool
  // (a dedicated second connection, or the delay-only race barrier the
  // marketplace suites use) would let it be observed.
  it('performs the whole retirement inside ONE transaction (source sentinel)', async () => {
    const servicePath = fileURLToPath(new URL('../services/groomRetirementService.mjs', import.meta.url));
    const source = await readFile(servicePath, 'utf8');

    expect(auditRetirementTransactionBoundary(source)).toEqual([]);
  }, 30000);

  it('the source sentinel fires on planted violations (it is not vacuous)', () => {
    // A pre-m9lz1-shaped implementation: no transaction, and the history delete.
    const preFixShape = [
      'export async function processRetirement(groomId) {',
      '  const g = await prisma.groom.update({ where: { id: groomId }, data: { retired: true } });',
      '  await prisma.groomAssignment.deleteMany({ where: { groomId } });',
      '  return g;',
      '}',
    ].join('\n');
    const preFixFindings = auditRetirementTransactionBoundary(preFixShape);
    expect(preFixFindings).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/exactly one prisma/i),
        expect.stringMatching(/groomAssignment delete/i),
      ]),
    );

    // A subtler regression: the transaction is there, but the notification was
    // moved outside it — the player could lose a groom silently.
    const notificationOutsideTx = [
      'export async function processRetirement(groomId) {',
      '  const committed = await prisma.$transaction(async tx => {',
      '    await tx.groom.updateMany({ where: { id: groomId }, data: { retired: true } });',
      '    await tx.groomAssignment.updateMany({ where: { groomId }, data: { isActive: false } });',
      '    await tx.groomAssignmentLog.updateMany({ where: { groomId }, data: {} });',
      '    return {};',
      '  });',
      '  await createNotification(userId, GROOM_RETIRED_NOTIFICATION_TYPE, {});',
      '  return committed;',
      '}',
    ].join('\n');
    expect(auditRetirementTransactionBoundary(notificationOutsideTx)).toEqual(
      expect.arrayContaining([expect.stringMatching(/createNotificationTx/i)]),
    );

    // A reformat that moves the callback's closing brace off two-space
    // indentation. The detector must FAIL here, not silently widen the body to
    // the rest of the file and then pass — the fail-open bug this branch fixes.
    const unlocatableBody = [
      'export async function processRetirement(groomId) {',
      '  const committed = await prisma.$transaction(async tx => {',
      '      await tx.groom.updateMany({ where: { id: groomId }, data: { retired: true } });',
      '      await tx.groomAssignment.updateMany({ where: { groomId }, data: {} });',
      '      await tx.groomAssignmentLog.updateMany({ where: { groomId }, data: {} });',
      '      await createNotificationTx(tx, userId, T, {});',
      '      return {};',
      '    });',
      '  return committed;',
      '}',
    ].join('\n');
    expect(auditRetirementTransactionBoundary(unlocatableBody)).toEqual(
      expect.arrayContaining([expect.stringMatching(/could not locate the end/i)]),
    );
  });

  it('refuses to retire the same groom twice, and the loser writes nothing', async () => {
    await prisma.groom.update({ where: { id: groom.id }, data: { careerWeeks: retirementAge } });

    const first = await processRetirement(groom.id);
    expect(first.groom.retired).toBe(true);
    const notificationsAfterFirst = await prisma.notification.count({
      where: { userId: owner.id, type: GROOM_RETIRED_NOTIFICATION_TYPE },
    });
    expect(notificationsAfterFirst).toBe(1);

    const endDateAfterFirst = (
      await prisma.groomAssignment.findUnique({
        where: { id: activeAssignmentId },
        select: { endDate: true },
      })
    ).endDate;

    // `voluntary: true` bypasses the eligibility check, so this reaches the
    // guarded flip — the only thing that can still stop it. It must.
    await expect(processRetirement(groom.id, 'age', true)).rejects.toThrow(/already retired/i);

    // No second notification, and no re-stamped endDate.
    expect(
      await prisma.notification.count({
        where: { userId: owner.id, type: GROOM_RETIRED_NOTIFICATION_TYPE },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.groomAssignment.findUnique({
          where: { id: activeAssignmentId },
          select: { endDate: true },
        })
      ).endDate,
    ).toEqual(endDateAfterFirst);
  }, 120000);

  it('draws a schedule for a groom that has none, so grooms predating m9lz1 are covered', async () => {
    // youngGroom was never given a schedule in beforeEach.
    expect(await readRetirementAge(prisma, youngGroom.id)).toBeNull();

    const result = await processWeeklyCareerProgression(owner.id);
    expect(result.errors).toEqual([]);
    expect(result.scheduled).toBeGreaterThanOrEqual(1);

    const drawn = await readRetirementAge(prisma, youngGroom.id);
    expect(drawn).toBeGreaterThanOrEqual(50);
    expect(drawn).toBeLessThanOrEqual(65);

    // It aged, and it did not retire — its age is nowhere near the draw.
    const row = await prisma.groom.findUnique({
      where: { id: youngGroom.id },
      select: { retired: true, careerWeeks: true },
    });
    expect(row).toEqual({ retired: false, careerWeeks: 2 });
  }, 120000);
});
