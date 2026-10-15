/**
 * Conformation show settlement is server-authoritative — Equoria-mwjst (Codex
 * scan 2026-10-02, Finding 2, settlement half).
 *
 * The defect: `POST /api/v1/competition/conformation/execute` let an ordinary
 * player who hosted a conformation show settle it the moment they liked. The
 * only checks were "caller is the host" and "show is still open" — nothing
 * compared the show's schedule to the clock — so a show due in seven days paid
 * out ribbons, title points, titles and breeding-value boosts immediately. The
 * old HTTP suite celebrated exactly that ("executes the show end-to-end" on a
 * show scheduled seven days out).
 *
 * Owner ruling 2026-10-05: conformation shows are settled by the nightly show
 * job only — "just like the regular shows, they run exactly 7 days from
 * creation" (closeDate = creation + 7 days). No player or host trigger.
 *
 * The invariant this file locks: a conformation show's results and rewards are
 * written exactly once, by the nightly executor, and only when — at the instant
 * of the atomic claim — it is still open and its closeDate has passed. The
 * claim, the entry read, every reward, the results, the completion write and
 * the entry-fee escrow settlement commit or roll back together. Conformation
 * shows are scored as conformation shows (titles, no prize money, no horse XP),
 * never by the ridden executor.
 *
 * Why these assertions detect the old defect: under the old code the host's
 * POST /execute returned 200 and wrote results, title points and boosts for a
 * show seven days from due; the nightly executor would also have scored a due
 * conformation show as a ridden show (horse XP, no titles) and never settled
 * its entry-fee escrow through the conformation path.
 *
 * Fixtures move only TIME: horses are entered through the real HTTP route
 * while the show is open, then the test database's openDate/closeDate are moved
 * back seven days to stand in for the week passing.
 *
 * Real app, real JWT, real CSRF, real database. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import {
  executeConformationShow,
  REWARD_TABLE,
  calculateConformationShowScore,
  SCORE_NEUTRAL_CONFORMATION_CLASS,
} from '../services/conformationShowService.mjs';

const FIXTURE_PREFIX = 'TestFixture-mwjst-confsettle';
const ORIGIN = 'http://localhost:3000';
const DAY_MS = 24 * 60 * 60 * 1000;
const ENTRY_FEE = 75;
const byNumber = (a, b) => a - b;
const PODIUM_POINTS = [REWARD_TABLE[1].titlePoints, REWARD_TABLE[2].titlePoints].sort(byNumber);

const tag = randomBytes(4).toString('hex');
let csrf;
let seq = 0;
const groomIds = [];
const assignmentIds = [];

async function makeEntrant() {
  seq += 1;
  const label = `e${seq}`;
  const { user, token } = await createTestUser({
    username: `${FIXTURE_PREFIX}-${label}-${tag}`,
    email: `${FIXTURE_PREFIX}-${label}-${tag}@example.com`,
    money: 1000,
  });
  const now = new Date();
  const horse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-${label}-horse-${tag}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
    horseXp: 0,
    titlePoints: 0,
    breedingValueBoost: 0,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-groom-${tag}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
    },
  });
  groomIds.push(groom.id);
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * DAY_MS),
    },
  });
  assignmentIds.push(assignment.id);
  return { user, token, horse, groom, assignment };
}

/** A player-hosted conformation show created the way the game creates shows. */
async function makeShow(host) {
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * DAY_MS);
  return createTestShow({
    name: `${FIXTURE_PREFIX}-show`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee: ENTRY_FEE,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    hostUserId: host.id,
    createdByUserId: host.id,
  });
}

async function enter(entrant, show) {
  const res = await request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${entrant.token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: entrant.horse.id, groomId: entrant.groom.id, showId: show.id, className: 'Mares' });
  expect(res.status).toBe(201);
}

/** Stand in for the week passing: the show opened 7 days + 1 hour ago and closed an hour ago. */
async function letWeekPass(show) {
  const closeDate = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.show.update({
    where: { id: show.id },
    data: { openDate: new Date(closeDate.getTime() - 7 * DAY_MS), closeDate, runDate: closeDate },
  });
}

/** Make every UPDATE of one show row fail inside Postgres. Returns the remover. */
async function failShowUpdatesFor(showId) {
  const suffix = `${tag}_${showId}`;
  const fn = `mwjst_fail_show_${suffix}`;
  const trg = `mwjst_fail_show_trg_${suffix}`;
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${fn}() RETURNS trigger AS $$
    BEGIN
      IF OLD.id = ${Number(showId)} THEN
        RAISE EXCEPTION 'injected test failure (${FIXTURE_PREFIX})';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trg} BEFORE UPDATE ON shows FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  return async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trg} ON shows`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
  };
}

/** A due show hosted by one player with two entered horses (fees paid into escrow). */
async function dueShowWithTwoEntries() {
  const host = await createTestUser({
    username: `${FIXTURE_PREFIX}-host${++seq}-${tag}`,
    email: `${FIXTURE_PREFIX}-host${seq}-${tag}@example.com`,
  });
  const show = await makeShow(host.user);
  const entrants = [await makeEntrant(), await makeEntrant()];
  for (const entrant of entrants) {
    await enter(entrant, show);
  }
  await letWeekPass(show);
  return { host, show, entrants };
}

async function rewardState(show, entrants) {
  const [showRow, results, horses, hostRow] = await Promise.all([
    prisma.show.findUnique({ where: { id: show.id } }),
    prisma.competitionResult.findMany({ where: { showId: show.id } }),
    prisma.horse.findMany({
      where: { id: { in: entrants.map(e => e.horse.id) } },
      select: { id: true, titlePoints: true, currentTitle: true, breedingValueBoost: true, horseXp: true },
    }),
    show.createdByUserId
      ? prisma.user.findUnique({ where: { id: show.createdByUserId }, select: { money: true } })
      : null,
  ]);
  return {
    status: showRow.status,
    feeEscrow: Number(showRow.feeEscrow),
    results,
    titlePoints: horses.map(h => h.titlePoints).sort(byNumber),
    boosts: horses.map(h => h.breedingValueBoost),
    titles: horses.map(h => h.currentTitle),
    horseXp: horses.map(h => h.horseXp),
    hostMoney: hostRow ? Number(hostRow.money) : null,
  };
}

function expectNothingAwarded(state) {
  expect(state.status).toBe('open');
  expect(state.results).toEqual([]);
  expect(state.titlePoints).toEqual([0, 0]);
  expect(state.boosts).toEqual([0, 0]);
  expect(state.titles).toEqual([null, null]);
}

beforeAll(async () => {
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await cleanupTestData();
});

describe('conformation settlement is server-authoritative (Equoria-mwjst Finding 2)', () => {
  it('the host has no settle route: POST /conformation/execute is 404 and nothing is awarded', async () => {
    const host = await createTestUser({
      username: `${FIXTURE_PREFIX}-route-host-${tag}`,
      email: `${FIXTURE_PREFIX}-route-host-${tag}@example.com`,
    });
    const show = await makeShow(host.user);
    const entrants = [await makeEntrant(), await makeEntrant()];
    for (const entrant of entrants) {
      await enter(entrant, show);
    }

    const res = await request(app)
      .post('/api/v1/competition/conformation/execute')
      .set('Authorization', `Bearer ${host.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: show.id });

    expect(res.status).toBe(404);
    const state = await rewardState(show, entrants);
    expectNothingAwarded(state);
    expect(state.feeEscrow).toBe(2 * ENTRY_FEE);
  });

  it('the nightly executor leaves a conformation show alone until its closing date passes', async () => {
    const host = await createTestUser({
      username: `${FIXTURE_PREFIX}-early-host-${tag}`,
      email: `${FIXTURE_PREFIX}-early-host-${tag}@example.com`,
    });
    const show = await makeShow(host.user);
    const entrants = [await makeEntrant(), await makeEntrant()];
    for (const entrant of entrants) {
      await enter(entrant, show);
    }
    const before = await rewardState(show, entrants);

    await executeClosedShows({ body: { showIds: [show.id] } });

    const after = await rewardState(show, entrants);
    expectNothingAwarded(after);
    expect(after.feeEscrow).toBe(2 * ENTRY_FEE);
    expect(after.hostMoney).toBe(before.hostMoney);
  });

  it('the settlement service itself refuses a show that is not due, whoever calls it', async () => {
    const host = await createTestUser({
      username: `${FIXTURE_PREFIX}-svc-host-${tag}`,
      email: `${FIXTURE_PREFIX}-svc-host-${tag}@example.com`,
    });
    const show = await makeShow(host.user);
    const entrants = [await makeEntrant(), await makeEntrant()];
    for (const entrant of entrants) {
      await enter(entrant, show);
    }

    await expect(executeConformationShow(show.id)).rejects.toThrow(/not due/i);

    const state = await rewardState(show, entrants);
    expectNothingAwarded(state);
    expect(state.feeEscrow).toBe(2 * ENTRY_FEE);
  });

  it('a due show is settled by the nightly executor with conformation rewards and its fee escrow paid to the creator', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    const before = await rewardState(show, entrants);
    expect(before.feeEscrow).toBe(2 * ENTRY_FEE);

    await executeClosedShows({ body: { showIds: [show.id] } });

    const after = await rewardState(show, entrants);
    expect(after.status).toBe('completed');
    expect(after.results).toHaveLength(2);
    expect(after.results.every(r => r.discipline === 'conformation' && r.prizeWon === null)).toBe(true);
    expect(after.titlePoints).toEqual(PODIUM_POINTS);
    expect(after.boosts.every(b => b > 0)).toBe(true);
    // Conformation shows award titles, never ridden-show horse XP.
    expect(after.horseXp).toEqual(before.horseXp);
    // The entry fees left escrow for the creator, exactly once.
    expect(after.feeEscrow).toBe(0);
    expect(after.hostMoney).toBe(before.hostMoney + 2 * ENTRY_FEE);
  });

  it('two concurrent executor runs settle a due show exactly once', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    const before = await rewardState(show, entrants);

    await Promise.all([
      executeClosedShows({ body: { showIds: [show.id] } }),
      executeClosedShows({ body: { showIds: [show.id] } }),
    ]);

    const after = await rewardState(show, entrants);
    expect(after.status).toBe('completed');
    expect(after.results).toHaveLength(2);
    expect(after.titlePoints).toEqual(PODIUM_POINTS);
    expect(after.feeEscrow).toBe(0);
    expect(after.hostMoney).toBe(before.hostMoney + 2 * ENTRY_FEE);
  });

  it('a settlement that fails part-way leaves the show open with no rewards and the escrow unsettled', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    // A legacy entry from before entries recorded their groom, whose horse has
    // no active groom either: the settlement refuses to score it with no real
    // handler (Equoria-axad9.1), after it has claimed.
    // (Neither groomId nor groomSnapshot; raw SQL for the Json NULL, as
    // showController.clearStagedOrdering explains for Prisma.DbNull under Jest.)
    await prisma.$executeRaw`UPDATE "show_entries" SET "groomId" = NULL, "groomSnapshot" = NULL
      WHERE "showId" = ${show.id} AND "horseId" = ${entrants[1].horse.id}`;
    await prisma.groomAssignment.update({
      where: { id: entrants[1].assignment.id },
      data: { isActive: false },
    });
    const before = await rewardState(show, entrants);

    // The failure reaches the caller: the nightly job records an error, not
    // success, while the show waits unsettled for the next run.
    await expect(executeClosedShows({ body: { showIds: [show.id] } })).rejects.toThrow(
      new RegExp(`settlement failed for show\\(s\\) ${show.id}\\b`),
    );

    const after = await rewardState(show, entrants);
    expectNothingAwarded(after);
    expect(after.feeEscrow).toBe(2 * ENTRY_FEE);
    expect(after.hostMoney).toBe(before.hostMoney);
  });

  // Owner ruling 2026-10-12: "If the horse was entered with a groom ... they
  // have that groom still attached to them when it runs. The groom has already
  // been paid for to use for those entries."
  it('a groom whose assignment ended after entry still presents the horse at settlement', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    await prisma.groomAssignment.update({
      where: { id: entrants[1].assignment.id },
      data: { isActive: false },
    });
    const before = await rewardState(show, entrants);

    await executeClosedShows({ body: { showIds: [show.id] } });

    const after = await rewardState(show, entrants);
    expect(after.status).toBe('completed');
    expect(after.results).toHaveLength(2);
    expect(after.titlePoints).toEqual(PODIUM_POINTS);
    expect(after.feeEscrow).toBe(0);
    expect(after.hostMoney).toBe(before.hostMoney + 2 * ENTRY_FEE);
  });

  // Codex review 2026-10-12: a released groom can be hired by another player
  // whose account erasure (gdprAccountService) deletes the groom row. The entry
  // must still be scored with the groom it was entered with — never with
  // whichever groom the horse has now, and never left unscorable.
  it('a groom deleted after entry still presents the horse as entered, not a stand-in', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    const [first] = entrants;
    const asEntered = await prisma.groom.findUnique({ where: { id: first.groom.id } });

    // Meanwhile the horse gets a different groom, so a fallback would be visible.
    const standIn = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-standin-groom-${tag}`,
        speciality: 'show_handling',
        personality: 'strict',
        skillLevel: 'master',
        showHandlingSkill: 'master',
        user: { connect: { id: first.user.id } },
      },
    });
    groomIds.push(standIn.id);
    const standInAssignment = await prisma.groomAssignment.create({
      data: {
        groom: { connect: { id: standIn.id } },
        foal: { connect: { id: first.horse.id } },
        user: { connect: { id: first.user.id } },
        isActive: true,
      },
    });
    assignmentIds.push(standInAssignment.id);

    // The entered groom moves to another player's staff, whose erasure deletes it.
    const other = await createTestUser({
      username: `${FIXTURE_PREFIX}-erased-${tag}`,
      email: `${FIXTURE_PREFIX}-erased-${tag}@example.com`,
    });
    await prisma.groom.update({ where: { id: asEntered.id }, data: { userId: other.user.id } });
    await prisma.groom.delete({ where: { id: asEntered.id } });

    const horseRow = await prisma.horse.findUnique({ where: { id: first.horse.id } });
    const scoreWith = groom =>
      calculateConformationShowScore(horseRow, groom, SCORE_NEUTRAL_CONFORMATION_CLASS).finalScore;
    // Precondition: the two grooms would score this horse differently.
    expect(scoreWith(standIn)).not.toBe(scoreWith(asEntered));
    const before = await rewardState(show, entrants);

    await executeClosedShows({ body: { showIds: [show.id] } });

    const after = await rewardState(show, entrants);
    expect(after.status).toBe('completed');
    expect(after.results).toHaveLength(2);
    expect(after.feeEscrow).toBe(0);
    expect(after.hostMoney).toBe(before.hostMoney + 2 * ENTRY_FEE);
    const firstResult = after.results.find(r => r.horseId === first.horse.id);
    expect(Number(firstResult.score)).toBe(scoreWith(asEntered));
  });

  it('a ridden show that fails does not stop a due conformation show from settling', async () => {
    const { show, entrants } = await dueShowWithTwoEntries();
    const ridden = await createTestShow({
      name: `${FIXTURE_PREFIX}-ridden`,
      discipline: 'Dressage',
      status: 'open',
      entryFee: 0,
      prize: 0,
      levelMin: 1,
      levelMax: 10,
      openDate: new Date(Date.now() - 8 * DAY_MS),
      closeDate: new Date(Date.now() - 60 * 60 * 1000),
      runDate: new Date(Date.now() - 60 * 60 * 1000),
    });
    const removeTrigger = await failShowUpdatesFor(ridden.id);
    const before = await rewardState(show, entrants);
    try {
      // The ridden failure still reaches the nightly job as a failure ... (a
      // Prisma error from outside Jest's realm, so matched by message, not
      // by toThrow's Error-instance check).
      await expect(executeClosedShows({ body: { showIds: [ridden.id, show.id] } })).rejects.toMatchObject({
        message: expect.stringMatching(/injected test failure/),
      });
    } finally {
      await removeTrigger();
    }

    // ... but the due conformation show was settled all the same.
    const after = await rewardState(show, entrants);
    expect(after.status).toBe('completed');
    expect(after.results).toHaveLength(2);
    expect(after.feeEscrow).toBe(0);
    expect(after.hostMoney).toBe(before.hostMoney + 2 * ENTRY_FEE);
    const riddenAfter = await prisma.show.findUnique({ where: { id: ridden.id } });
    expect(riddenAfter.status).toBe('open');
  });
});

// ===========================================================================
// Every paid conformation entry can be settled (Codex review 2026-10-06).
//
// Settlement refuses an entry without an active groom, and that refusal leaves
// the whole show open with every entrant's fee held. So the only door into a
// conformation show is the conformation entry, which requires the groom.
// (Undated legacy shows are scheduled by the mwjst backfill migration.)
// ===========================================================================
describe('only settleable entries are accepted into a conformation show', () => {
  async function entryState(show, entrant) {
    const [showRow, entries, user] = await Promise.all([
      prisma.show.findUnique({ where: { id: show.id }, select: { feeEscrow: true } }),
      prisma.showEntry.findMany({ where: { showId: show.id } }),
      prisma.user.findUnique({ where: { id: entrant.user.id }, select: { money: true } }),
    ]);
    return { feeEscrow: Number(showRow.feeEscrow), entries, money: Number(user.money) };
  }

  async function freshShow(label) {
    const host = await createTestUser({
      username: `${FIXTURE_PREFIX}-${label}-host-${tag}`,
      email: `${FIXTURE_PREFIX}-${label}-host-${tag}@example.com`,
    });
    return makeShow(host.user);
  }

  function post(path, entrant) {
    return request(app)
      .post(path)
      .set('Authorization', `Bearer ${entrant.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);
  }

  it('POST /competition/enter refuses a conformation show and takes no fee', async () => {
    const show = await freshShow('generic');
    const entrant = await makeEntrant();

    const res = await post('/api/v1/competition/enter', entrant).send({
      horseId: entrant.horse.id,
      showId: show.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/conformation/i);
    const state = await entryState(show, entrant);
    expect(state.entries).toEqual([]);
    expect(state.feeEscrow).toBe(0);
    expect(state.money).toBe(1000);
  });

  it('POST /shows/:id/enter refuses a conformation show and takes no fee', async () => {
    const show = await freshShow('shows');
    const entrant = await makeEntrant();

    const res = await post(`/api/v1/shows/${show.id}/enter`, entrant).send({
      horseId: entrant.horse.id,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/conformation/i);
    const state = await entryState(show, entrant);
    expect(state.entries).toEqual([]);
    expect(state.feeEscrow).toBe(0);
    expect(state.money).toBe(1000);
  });
});
