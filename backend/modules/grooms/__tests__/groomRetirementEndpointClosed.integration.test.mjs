/**
 * Task 19 / Equoria-m9lz1 — players may not retire grooms, and retiring one
 * must never destroy assignment history.
 *
 * The owner's ruling (2026-09-08): "Players don't retire grooms. Grooms retire
 * automatically at a randomly selected age by the game. They can retire any
 * time between age 50-65 and that is not known until the week they retire."
 *
 * THE DEFECT THIS LOCKS OUT
 *   `POST /api/v1/grooms/:id/retirement/process` sat on the authenticated
 *   router behind `param('id')` + `body('reason')` + `body('force')` validators
 *   and `requireOwnership('groom')`, then called
 *   `processRetirement(groomId, reason, force)`. Two things were wrong at once:
 *
 *     1. Ownership answers "is this my groom", never "may this groom's career be
 *        ended" — the same confusion the 2026-09-05 audit closed for free horse
 *        creation (Finding 2) and Equoria-9tque closed for horse deletion. And
 *        `force: true` skipped the eligibility check outright, so ANY groom
 *        could be retired at any age with one request.
 *     2. The service it called then ran
 *        `prisma.groomAssignment.deleteMany({ where: { groomId } })` under a
 *        comment claiming it removed "active assignments". The `where` matched
 *        EVERY row, so one player request permanently destroyed that groom's
 *        whole assignment history — and because
 *        `groom_interactions.assignmentId` is `ON DELETE SET NULL`, every past
 *        interaction was detached from the assignment that produced it. It was
 *        the only remaining path in the codebase that destroyed assignment
 *        history, and the only one a player could trigger.
 *
 * THE INVARIANT THIS FILE LOCKS — scoped precisely to what it exercises:
 *   `POST /api/v1/grooms/:id/retirement/process` retires no groom and destroys
 *   no assignment row for any caller, and the game's own retirement path still
 *   works. This file does NOT prove the broader claim that no player-facing HTTP
 *   entry point anywhere flips `Groom.retired`; it drives one route. At the time
 *   of this change the caller trace found no other: `grep -rn "retired" ` over
 *   `backend/modules/grooms/{routes,controllers}` finds only reads, the two hire
 *   paths' `retired: false` filters, and this closed route. A route-table
 *   sentinel walking the mounted Express stack for groom-scoped retirement
 *   handlers would be the broader guarantee; it is not written.
 *
 * WHAT THE GUARD IS
 *   403 for every authenticated caller. The refusal sits BEHIND the authRouter's
 *   `authenticateToken` (so an anonymous call is still 401) and BEFORE the
 *   validators and `requireOwnership`, so it is payload- and id-independent: a
 *   groom you own, a groom another player owns, an id that does not exist and a
 *   non-numeric id all produce byte-identical responses. The route therefore
 *   cannot be used as an existence or ownership oracle, and `force` cannot steer
 *   it.
 *
 * WHY THESE ASSERTIONS DETECT THE OLD DEFECT
 *   Every rejection case asserts PERSISTED state, not just a status code: the
 *   groom is still un-retired and still active, its ACTIVE assignment is still
 *   active with a null `endDate`, its INACTIVE historical assignment row is
 *   still present, its `GroomInteraction` still points at that historical
 *   assignment, and its open `GroomAssignmentLog` is still open. Under the
 *   pre-fix route the owner's request returned 200 with
 *   `{ success: true, message: 'Groom retirement processed successfully' }`, the
 *   groom was retired, and BOTH assignment rows were gone with the interaction's
 *   `assignmentId` nulled. Those exact assertions fail loudly on the old code.
 *
 * RETAINED LEGITIMATE BEHAVIOUR PROVEN HERE
 *   - the game's own retirement (`processRetirement`, the function the closed
 *     route used to call) still retires a groom, so the refusal is scoped to the
 *     player surface and is not collateral damage;
 *   - the neighbouring read `GET /:id/retirement/eligibility` still serves the
 *     owner, and its body carries no retirement age and no countdown.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures are uniquely named and
 * cleaned up by id in FK order.
 *
 * @module modules/grooms/__tests__/groomRetirementEndpointClosed.integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processRetirement } from '../services/groomRetirementService.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-m9lz1-closed';

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
      money: 1000,
      settings: {},
    },
  });
  return {
    id: user.id,
    email: user.email,
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

// Equoria-ypb7d.1: see the note on `startAge` in makeGroom below.
const FIXTURE_START_AGE = 20;

async function makeGroom(ownerId, label, extra = {}) {
  return prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      skillLevel: 'intermediate',
      level: 3,
      careerWeeks: 12,
      // Equoria-ypb7d.1: a groom's age is `startAge + careerWeeks`, so a fixture
      // that parks a groom on a target age must set both. Fixed at 20 (inside the
      // 18..24 band the `grooms_start_age_range` CHECK enforces) so the arithmetic
      // in the game-path case below is exact rather than depending on a draw.
      startAge: FIXTURE_START_AGE,
      userId: ownerId,
      ...extra,
    },
  });
}

function retireRequest(token, groomId, body = {}) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post(`/api/v1/grooms/${groomId}/retirement/process`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body),
  );
}

/**
 * A bare 403 is ambiguous — `csrfProtection` also answers 403 when the
 * token/cookie pair fails to bind, which would let this suite pass green while
 * the retirement route was still wide open. Assert the ROUTE's own refusal
 * message so only the Equoria-m9lz1 guard satisfies it. The negative case
 * ("a CSRF-rejected request produces a DIFFERENT 403") proves this matcher can
 * actually fail.
 *
 * COPY EDITORS: the phrase "cannot be retired" in the route's player-facing
 * message (groomRetirementRoutes.mjs `router.post('/:id/retirement/process')`)
 * is LOAD-BEARING for this regression. It is the only thing that distinguishes
 * the route's refusal from `csrfProtection`'s 403 on the same router, so a
 * reword that drops it turns these assertions vacuous while they stay green.
 * Reword freely, but update this matcher in the same commit — and keep the
 * message free of existence/ownership wording ("not found", "forbidden"), which
 * the assertions below also enforce.
 */
function expectRetirementClosed(res) {
  expect(res.status).toBe(403);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/cannot be retired/i);
  // No existence/ownership detail may leak.
  expect(res.body.message).not.toMatch(/not found/i);
  expect(res.body.message).not.toMatch(/forbidden/i);
  // And no hint of the hidden retirement age or a countdown to it.
  expect(res.body.message).not.toMatch(/\b(5[0-9]|6[0-5])\b/);
  expect(JSON.stringify(res.body)).not.toMatch(/retirementAge/i);
}

describe('Equoria-m9lz1 — POST /api/v1/grooms/:id/retirement/process is closed to players', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let stranger;
  let horse;
  let groom;
  let strangerGroom;
  let activeAssignmentId;
  let historicalAssignmentId;
  let interactionId;
  let assignmentLogId;

  beforeEach(async () => {
    owner = await makeUser('owner');
    stranger = await makeUser('stranger');
    horse = await makeHorse(owner.id, 'horse');
    groom = await makeGroom(owner.id, 'groom');
    strangerGroom = await makeGroom(stranger.id, 'strangergroom');

    // A CLOSED assignment: this is the row the pre-fix `deleteMany({ groomId })`
    // destroyed even though it was already inactive, and it is the row no
    // retirement of any kind may ever remove.
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

    // A care record pointing at that closed assignment. Its `assignmentId` FK is
    // ON DELETE SET NULL, so the pre-fix delete silently detached it.
    const interaction = await prisma.groomInteraction.create({
      data: {
        groomId: groom.id,
        foalId: horse.id,
        assignmentId: historical.id,
        interactionType: 'daily_care',
        duration: 30,
        bondingChange: 3,
        stressChange: -1,
        quality: 'good',
      },
    });
    interactionId = interaction.id;

    // The currently ACTIVE assignment. Only the partial unique index
    // `groom_assignments_active_foalId_groomId_key WHERE "isActive"` constrains
    // it, and one active row per (groom, horse) is what we create.
    const active = await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: owner.id, isActive: true },
    });
    activeAssignmentId = active.id;

    const log = await prisma.groomAssignmentLog.create({
      data: { groomId: groom.id, horseId: horse.id },
    });
    assignmentLogId = log.id;

    const ids = {
      interactionId,
      assignmentIds: [activeAssignmentId, historicalAssignmentId],
      assignmentLogId,
      groomIds: [groom.id, strangerGroom.id],
      horseId: horse.id,
      userIds: [owner.id, stranger.id],
    };
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: ids.userIds } } }), 'notifications');
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { id: ids.interactionId } }), 'groom interaction');
    cleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { id: { in: ids.assignmentIds } } }),
      'groom assignments',
    );
    cleanup.add(
      () => prisma.groomAssignmentLog.deleteMany({ where: { id: ids.assignmentLogId } }),
      'groom assignment log',
    );
    cleanup.add(
      () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: ids.groomIds } } }),
      'retirement schedules',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.groomIds } } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: ids.horseId } }), 'fixture horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }), 'fixture users');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  /** Every persisted fact the pre-fix route destroyed, asserted in one place. */
  async function expectNothingRetiredOrDestroyed() {
    const persisted = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { retired: true, retirementReason: true, retirementTimestamp: true, isActive: true },
    });
    expect(persisted).toEqual({
      retired: false,
      retirementReason: null,
      retirementTimestamp: null,
      isActive: true,
    });

    // BOTH assignment rows survive, in exactly the states they were created in.
    const active = await prisma.groomAssignment.findUnique({
      where: { id: activeAssignmentId },
      select: { isActive: true, endDate: true },
    });
    expect(active).toEqual({ isActive: true, endDate: null });

    const historical = await prisma.groomAssignment.findUnique({
      where: { id: historicalAssignmentId },
      select: { id: true, isActive: true },
    });
    expect(historical).toEqual({ id: historicalAssignmentId, isActive: false });

    // The care record is still linked to the assignment that produced it.
    const interaction = await prisma.groomInteraction.findUnique({
      where: { id: interactionId },
      select: { assignmentId: true },
    });
    expect(interaction).toEqual({ assignmentId: historicalAssignmentId });

    const log = await prisma.groomAssignmentLog.findUnique({
      where: { id: assignmentLogId },
      select: { unassignedAt: true },
    });
    expect(log).toEqual({ unassignedAt: null });

    // And the player was told nothing, because nothing happened.
    expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(0);
  }

  it("refuses the owner's own retirement request and changes no persisted state", async () => {
    const res = await retireRequest(owner.token, groom.id, { reason: 'voluntary' });

    expectRetirementClosed(res);
    await expectNothingRetiredOrDestroyed();
  }, 60000);

  it('refuses the force:true variant that used to skip the eligibility check entirely', async () => {
    const res = await retireRequest(owner.token, groom.id, { force: true, reason: 'voluntary' });

    expectRetirementClosed(res);
    await expectNothingRetiredOrDestroyed();
  }, 60000);

  it("answers identically for an owned groom, a stranger's groom, a missing id and a bad id (no oracle)", async () => {
    const missingId = 2147483000 + Math.floor(Math.random() * 600);
    expect(await prisma.groom.findUnique({ where: { id: missingId } })).toBeNull();

    const targets = [
      ['owned', String(groom.id)],
      ['cross-owner', String(strangerGroom.id)],
      ['nonexistent', String(missingId)],
      ['non-numeric', 'not-an-id'],
    ];

    const bodies = [];
    for (const [label, target] of targets) {
      const res = await retireRequest(owner.token, target, { force: true });
      expect({ label, status: res.status }).toEqual({ label, status: 403 });
      expectRetirementClosed(res);
      bodies.push(JSON.stringify(res.body));
    }

    // Byte-identical responses: the route reveals nothing about whether the id
    // exists, is well-formed, or belongs to the caller. Under the pre-fix route
    // these were 200 / 403 / 400 / 400 respectively.
    expect(new Set(bodies).size).toBe(1);

    // Neither groom was retired.
    const untouched = await prisma.groom.findMany({
      where: { id: { in: [groom.id, strangerGroom.id] } },
      select: { retired: true },
    });
    expect(untouched).toEqual([{ retired: false }, { retired: false }]);
  }, 90000);

  it('still answers 401 (not 403) when no token is supplied', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/grooms/${groom.id}/retirement/process`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ force: true });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    await expectNothingRetiredOrDestroyed();
  }, 30000);

  it('a CSRF-rejected request produces a DIFFERENT 403 than the route guard (assertion is not vacuous)', async () => {
    const res = await request(app)
      .post(`/api/v1/grooms/${groom.id}/retirement/process`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', 'not-a-real-csrf-token')
      .send({ force: true });

    expect(res.status).toBe(403);
    expect(res.body.message ?? '').not.toMatch(/cannot be retired/i);
    expect(() => expectRetirementClosed(res)).toThrow();
    await expectNothingRetiredOrDestroyed();
  }, 30000);

  it('leaves GET /:id/retirement/eligibility working, and it discloses no age or countdown', async () => {
    const res = await request(app)
      .get(`/api/v1/grooms/${groom.id}/retirement/eligibility`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('eligible');

    // The three fields that WERE the disclosure. `weeksUntilRetirement` and
    // `noticeRequired` are `retirementAge - careerWeeks` in disguise: a client
    // knows careerWeeks, so either one hands it the hidden age by subtraction.
    expect(res.body.data).not.toHaveProperty('weeksUntilRetirement');
    expect(res.body.data).not.toHaveProperty('noticeRequired');
    expect(res.body.data).not.toHaveProperty('retirementAge');
    expect(JSON.stringify(res.body)).not.toMatch(/retirementAge|retirementSchedule/i);
  }, 30000);

  it("the GAME's retirement path still retires the same groom (the refusal is scoped)", async () => {
    // The route is closed; the function it used to call is not. This is the
    // retained legitimate workflow: the game reaches the groom's hidden
    // retirement age and retires them.
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    await prisma.groom.update({
      where: { id: groom.id },
      // Equoria-ypb7d.1: exactly ON its hidden age, and age is
      // `startAge + careerWeeks` — not `careerWeeks` alone, which was the defect
      // Equoria-maeba raised.
      data: { careerWeeks: retirementAge - FIXTURE_START_AGE },
    });

    const result = await processRetirement(groom.id);

    expect(result.groom.retired).toBe(true);
    expect(result.retirementReason).toBe('age');

    const persisted = await prisma.groom.findUnique({
      where: { id: groom.id },
      select: { retired: true, isActive: true, retirementReason: true },
    });
    expect(persisted).toEqual({ retired: true, isActive: false, retirementReason: 'age' });

    // …and it ended the active assignment WITHOUT destroying either row.
    const rows = await prisma.groomAssignment.findMany({
      where: { groomId: groom.id },
      orderBy: { id: 'asc' },
      select: { id: true, isActive: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.isActive === false)).toBe(true);

    const interaction = await prisma.groomInteraction.findUnique({
      where: { id: interactionId },
      select: { assignmentId: true },
    });
    expect(interaction).toEqual({ assignmentId: historicalAssignmentId });
  }, 90000);
});
