/**
 * Equoria-wbt8l — the News entries the game writes at the start of each
 * Eastern game day (owner rulings 2026-10-23).
 *
 * - Club News: elections opening (a run-off round included) and run-off
 *   results. Looks back two game days so one missed night is caught up;
 *   older or not-yet-opening elections are not announced.
 * - New Items: catalog items whose `addedOn` game date has come. Launch
 *   inventory (no addedOn) is never announced.
 * - Idempotent: a second pass posts nothing (UNIQUE sourceKey).
 * - Regular shows never post News: opening, closing and settling one writes
 *   no NewsItem (they open and close by the hundreds every day).
 *
 * The pass runs at a fixed "now" in 2035 so only this file's fixtures fall in
 * its window. Real database, no mocks, id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { collectNewItems, postDailyNewsEntries, postGameNewsEntries } from '../services/dailyNewsEntries.mjs';
import { executeClosedShows } from '../../competition/shows/showExecutionService.mjs';

const T = randomBytes(5).toString('hex');
const PREFIX = `TestFixture-wbt8l-daily-${T}`;
// 00:02 Eastern (EDT) on Friday 15 June 2035 — the nightly pass's minute.
const NOW = new Date('2035-06-15T04:02:00.000Z');
const at = iso => new Date(iso);

const cleanup = createCleanupTracker();
const userIds = [];
const electionIds = [];
const showIds = [];
let club;
const fx = {};

async function makeUser(label) {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${label}`,
      email: `${PREFIX}-${label}@example.com`.toLowerCase(),
      password: 'irrelevant-not-a-login-test',
      firstName: 'wbt8l',
      lastName: label,
      money: 0,
      settings: {},
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeElection(data, candidateUsers = []) {
  const election = await prisma.clubElection.create({
    data: {
      clubId: club.id,
      position: 'President',
      ...data,
      candidates: {
        create: candidateUsers.map(u => ({ userId: u.id, statement: 'Vote for me' })),
      },
    },
    include: { candidates: { orderBy: { id: 'asc' } } },
  });
  electionIds.push(election.id);
  return election;
}

const keysFor = rows => rows.map(r => r.sourceKey).sort();

beforeAll(async () => {
  cleanup.add(
    () => prisma.newsItem.deleteMany({ where: { sourceKey: { contains: `-${T}` } } }),
    'fixture store entries',
  );
  cleanup.add(
    () =>
      prisma.newsItem.deleteMany({
        where: {
          sourceKey: {
            in: electionIds.flatMap(id => [
              `clubNews:electionOpened:${id}`,
              `clubNews:runoffResult:${id}`,
              `clubNews:electionResult:${id}`,
            ]),
          },
        },
      }),
    'club news',
  );
  cleanup.add(() => prisma.clubCandidate.deleteMany({ where: { electionId: { in: electionIds } } }), 'candidates');
  cleanup.add(() => prisma.clubElection.deleteMany({ where: { id: { in: electionIds } } }), 'elections');
  cleanup.add(() => prisma.club.deleteMany({ where: { id: club.id } }), 'club');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');

  const leader = await makeUser('leader');
  fx.ann = await makeUser('ann');
  fx.bo = await makeUser('bo');
  club = await prisma.club.create({
    data: {
      name: `${PREFIX} Hunter Club`,
      type: 'discipline',
      category: 'Hunter',
      description: 'news fixture',
      leaderId: leader.id,
    },
  });

  // Opens later today: announced.
  fx.today = await makeElection({
    status: 'upcoming',
    startsAt: at('2035-06-15T16:00:00Z'),
    endsAt: at('2035-06-18T16:00:00Z'),
  });
  // Opened yesterday, still open: caught up.
  fx.yesterday = await makeElection({
    status: 'open',
    startsAt: at('2035-06-14T10:00:00Z'),
    endsAt: at('2035-06-17T10:00:00Z'),
  });
  // Opened five days ago: outside the lookback, not announced.
  fx.old = await makeElection({
    status: 'open',
    startsAt: at('2035-06-10T10:00:00Z'),
    endsAt: at('2035-06-20T10:00:00Z'),
  });
  // Opens tomorrow: not yet.
  fx.tomorrow = await makeElection({
    status: 'upcoming',
    startsAt: at('2035-06-16T10:00:00Z'),
    endsAt: at('2035-06-19T10:00:00Z'),
  });
  // A tied election and its run-off round, open since yesterday evening.
  fx.tied = await makeElection(
    {
      status: 'closed',
      outcome: 'runoff',
      startsAt: at('2035-06-11T20:00:00Z'),
      endsAt: at('2035-06-14T20:00:00Z'),
    },
    [fx.ann, fx.bo],
  );
  fx.runoff = await makeElection(
    {
      status: 'open',
      startsAt: at('2035-06-14T20:05:00Z'),
      endsAt: at('2035-06-15T20:05:00Z'),
      runoffOfId: fx.tied.id,
    },
    [fx.ann, fx.bo],
  );
  // A run-off decided yesterday: Ann won.
  fx.tiedEarlier = await makeElection(
    {
      position: 'Treasurer',
      status: 'closed',
      outcome: 'runoff',
      startsAt: at('2035-06-10T09:00:00Z'),
      endsAt: at('2035-06-13T09:00:00Z'),
    },
    [fx.ann, fx.bo],
  );
  fx.decided = await makeElection(
    {
      position: 'Treasurer',
      status: 'closed',
      startsAt: at('2035-06-13T09:05:00Z'),
      endsAt: at('2035-06-14T09:05:00Z'),
      runoffOfId: fx.tiedEarlier.id,
    },
    [fx.ann, fx.bo],
  );
  await prisma.clubElection.update({
    where: { id: fx.decided.id },
    data: { outcome: 'won', winnerCandidateId: fx.decided.candidates[0].id },
  });

  // An election won outright, closed yesterday: Ann won. Owner ruling q25
  // (2026-10-23, Equoria-wbt8l.3): every decided result is announced, not only
  // run-off results.
  fx.won = await makeElection(
    {
      position: 'Secretary',
      status: 'closed',
      startsAt: at('2035-06-11T09:00:00Z'),
      endsAt: at('2035-06-14T09:00:00Z'),
    },
    [fx.ann, fx.bo],
  );
  await prisma.clubElection.update({
    where: { id: fx.won.id },
    data: { outcome: 'won', winnerCandidateId: fx.won.candidates[0].id },
  });
  // Decided long before the lookback: not announced.
  fx.wonOld = await makeElection(
    {
      position: 'Secretary',
      status: 'closed',
      startsAt: at('2035-06-01T09:00:00Z'),
      endsAt: at('2035-06-04T09:00:00Z'),
    },
    [fx.ann, fx.bo],
  );
  await prisma.clubElection.update({
    where: { id: fx.wonOld.id },
    data: { outcome: 'won', winnerCandidateId: fx.wonOld.candidates[0].id },
  });
}, 60000);

afterAll(() => cleanup.run(), 60000);

const storeCatalogs = [
  {
    shop: 'tack',
    shopName: 'the Tack Shop',
    linkPath: '/tack-shop',
    items: [
      {
        id: `hunter-saddle-${T}`,
        name: 'Hunter Saddle',
        description: 'Made for the Hunter ring.',
        addedOn: '2035-06-15',
      },
      { id: `old-bridle-${T}`, name: 'Old Bridle', description: 'Added a week ago.', addedOn: '2035-06-08' },
      { id: `next-pad-${T}`, name: 'Next Pad', description: 'Arrives tomorrow.', addedOn: '2035-06-16' },
      { id: `launch-girth-${T}`, name: 'Launch Girth', description: 'Launch inventory.' },
    ],
  },
];

describe('the nightly News pass', () => {
  it('posts club news and new items due today, and nothing twice', async () => {
    const first = await postDailyNewsEntries(NOW, { storeCatalogs });
    expect(first).toEqual({ clubNews: 5, newItems: 1 });

    const club_ = await prisma.newsItem.findMany({
      where: {
        sourceKey: {
          in: electionIds.flatMap(id => [
            `clubNews:electionOpened:${id}`,
            `clubNews:runoffResult:${id}`,
            `clubNews:electionResult:${id}`,
          ]),
        },
      },
    });
    expect(keysFor(club_)).toEqual(
      [
        `clubNews:electionOpened:${fx.today.id}`,
        `clubNews:electionOpened:${fx.yesterday.id}`,
        `clubNews:electionOpened:${fx.runoff.id}`,
        `clubNews:runoffResult:${fx.decided.id}`,
        `clubNews:electionResult:${fx.won.id}`,
      ].sort(),
    );
    for (const row of club_) {
      expect(row.postType).toBe('clubNews');
      expect(row.publishAt.toISOString()).toBe(NOW.toISOString());
      expect(row.linkPath).toBe('/clubs');
      expect(row.authorUserId).toBeNull();
    }

    const opening = club_.find(r => r.sourceKey === `clubNews:electionOpened:${fx.today.id}`);
    expect(opening.title).toBe(`Polls open at ${club.name}`);
    expect(opening.body).toBe('Members vote for President until Monday 18 June.');
    expect(opening.endsAt.toISOString()).toBe('2035-06-18T16:00:00.000Z');

    const runoff = club_.find(r => r.sourceKey === `clubNews:electionOpened:${fx.runoff.id}`);
    expect(runoff.title).toBe(`Run-off at ${club.name}`);
    expect(runoff.body).toBe(
      `The vote for President was tied, so ${fx.ann.username} and ${fx.bo.username} go to a one-day run-off.`,
    );

    const result = club_.find(r => r.sourceKey === `clubNews:runoffResult:${fx.decided.id}`);
    expect(result.title).toBe(`Run-off decided at ${club.name}`);
    expect(result.body).toBe(`${fx.ann.username} wins the vote for Treasurer.`);
    expect(result.endsAt).toBeNull();

    const won = club_.find(r => r.sourceKey === `clubNews:electionResult:${fx.won.id}`);
    expect(won.title).toBe(`Election decided at ${club.name}`);
    expect(won.body).toBe(`${fx.ann.username} wins the vote for Secretary.`);
    expect(won.endsAt).toBeNull();

    const items = await prisma.newsItem.findMany({ where: { sourceKey: { contains: `-${T}` } } });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      postType: 'newItem',
      sourceKey: `newItem:tack:hunter-saddle-${T}`,
      title: 'New at the Tack Shop: Hunter Saddle',
      body: 'Made for the Hunter ring.',
      linkPath: '/tack-shop',
    });

    const second = await postDailyNewsEntries(NOW, { storeCatalogs });
    expect(second).toEqual({ clubNews: 0, newItems: 0 });
    const again = await prisma.newsItem.count({
      where: { sourceKey: { in: club_.map(r => r.sourceKey) } },
    });
    expect(again).toBe(5);
  });

  it('never announces the launch inventory of the real catalogs', () => {
    expect(collectNewItems(NOW)).toEqual([]);
  });

  it('takes game entries of game types only, each keyed to what it announces', async () => {
    await expect(
      postGameNewsEntries('update', [{ sourceKey: 'update:x', title: 'x', body: 'y' }], NOW),
    ).rejects.toThrow(/not a game-written post type/);
    await expect(
      postGameNewsEntries('seasonalCraft', [{ sourceKey: 'clubNews:1', title: 'x', body: 'y' }], NOW),
    ).rejects.toThrow(/malformed/);
    await expect(postGameNewsEntries('seasonalCompetitionOpen', [], NOW)).resolves.toBe(0);
  });
});

describe('regular shows never post News (owner ruling 2026-10-23)', () => {
  it('opening, closing and settling a regular show writes no NewsItem', async () => {
    const before = await prisma.newsItem.count();

    // A show that opened and closes inside the nightly window: the pass
    // announces nothing for it.
    const inWindow = await prisma.show.create({
      data: {
        name: `${PREFIX} Summer Hunter Classic`,
        discipline: 'Hunter',
        levelMin: 1,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: at('2035-06-15T12:00:00Z'),
        status: 'open',
        openDate: at('2035-06-14T12:00:00Z'),
        closeDate: at('2035-06-15T12:00:00Z'),
      },
    });
    showIds.push(inWindow.id);
    // A show already past its close: the real overnight settlement closes it.
    const due = await prisma.show.create({
      data: {
        name: `${PREFIX} Closed Dressage Open`,
        discipline: 'Dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(Date.now() - 3_600_000),
        status: 'open',
        openDate: new Date(Date.now() - 8 * 86_400_000),
        closeDate: new Date(Date.now() - 3_600_000),
      },
    });
    showIds.push(due.id);

    await executeClosedShows({ body: { showIds: [due.id] } }, null);
    const settled = await prisma.show.findUnique({ where: { id: due.id } });
    expect(settled.status).toBe('completed');

    const pass = await postDailyNewsEntries(NOW, { storeCatalogs: [] });
    expect(pass.newItems).toBe(0);

    const mentioning = await prisma.newsItem.count({
      where: {
        OR: [inWindow.name, due.name].flatMap(name => [{ title: { contains: name } }, { body: { contains: name } }]),
      },
    });
    expect(mentioning).toBe(0);
    // The first test's entries already exist, so this pass adds nothing new.
    expect(pass.clubNews).toBe(0);
    expect(await prisma.newsItem.count()).toBe(before);
  });
});
