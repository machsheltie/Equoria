/**
 * Game-written News entries (Equoria-wbt8l, owner rulings 2026-10-23).
 *
 * The nightly job (services/jobs/dailyNewsPostingJob.mjs, 00:02 Eastern) posts
 * what the game has to announce at the start of each game day:
 *   clubNews — club elections opening (a run-off round included) and run-off
 *              results;
 *   newItem  — store items whose `addedOn` game date has come (an item added
 *              after launch carries `addedOn: 'YYYY-MM-DD'` in its catalog).
 * The seasonal game types (seasonalCompetitionOpen / seasonalCompetitionClose
 * / seasonalCraft) have no source yet: the future Head Admin scheduler hands
 * its entries to postGameNewsEntries, one call per type.
 *
 * Regular shows never post News (owner ruling 2026-10-23: they open and close
 * by the hundreds every day); nothing here reads shows.
 *
 * Idempotent: every entry carries a sourceKey ("<postType>:<what>:<id>") and
 * the column is UNIQUE, so a re-run (or a second replica) skips what is
 * already posted. Each pass looks back two game days, so one missed night is
 * caught up without re-announcing old history.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { allTackItems, feedCatalogItems } from '../../economy/index.mjs';
import { gameDateKey, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { isGamePostType } from '../newsPostTypes.mjs';

const lookbackGameDays = 2;
const msPerDay = 86_400_000;

// Game dates are read on the Eastern clock (gameDateKey), then named on UTC so
// the calendar date never shifts.
const calendarDayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "Sunday 26 October": the last Eastern game day before an end instant. */
function lastGameDayLabel(endsAt) {
  const lastDay = gameDateKey(endsAt.getTime() - 1);
  return calendarDayFormatter.format(new Date(`${lastDay}T00:00:00Z`));
}

/** "Ann", "Ann and Bo", "Ann, Bo and Cy". */
function joinNames(names) {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Post game-written entries of ONE type. Every game entry goes through here.
 *
 * @param {string} postType - one of gamePostTypes
 * @param {Array<{ sourceKey: string, title: string, body: string,
 *                 linkPath?: string|null, endsAt?: Date|null }>} entries
 *   sourceKey must start with "<postType>:" and name what is announced.
 * @param {Date} [now] - publishAt for the batch (the start of the game day)
 * @returns {Promise<number>} how many were newly posted
 */
export async function postGameNewsEntries(postType, entries, now = new Date()) {
  if (!isGamePostType(postType)) {
    throw new Error(`[news] not a game-written post type: ${postType}`);
  }
  for (const entry of entries) {
    if (
      !isNonEmptyString(entry?.sourceKey) ||
      !entry.sourceKey.startsWith(`${postType}:`) ||
      !isNonEmptyString(entry.title) ||
      !isNonEmptyString(entry.body)
    ) {
      throw new Error(`[news] malformed ${postType} entry: ${JSON.stringify(entry)}`);
    }
  }
  if (entries.length === 0) {
    return 0;
  }
  const { count } = await prisma.newsItem.createMany({
    data: entries.map(entry => ({
      postType,
      sourceKey: entry.sourceKey,
      title: entry.title,
      body: entry.body,
      linkPath: entry.linkPath ?? null,
      endsAt: entry.endsAt ?? null,
      publishAt: now,
    })),
    skipDuplicates: true,
  });
  return count;
}

/**
 * Club News for the game day of `now`: elections opening that day (or in the
 * lookback, still open) and every election decided in the lookback (run-off
 * rounds and outright wins; owner ruling q25).
 * @param {Date} now
 */
export async function collectClubNews(now) {
  const today = gameDayIndex(now);
  const lookbackStart = startOfGameDayIndex(today - lookbackGameDays);
  const todayEnd = startOfGameDayIndex(today + 1);

  const opening = await prisma.clubElection.findMany({
    where: { startsAt: { gte: lookbackStart, lt: todayEnd }, endsAt: { gt: now } },
    select: {
      id: true,
      position: true,
      endsAt: true,
      runoffOfId: true,
      club: { select: { name: true } },
      candidates: { select: { user: { select: { username: true } } }, orderBy: { id: 'asc' } },
    },
    orderBy: { id: 'asc' },
  });
  // Every decided result is announced (owner ruling q25, 2026-10-23): a run-off
  // round's winner and an election won outright. A tied election itself closes
  // with outcome 'runoff' and is announced through its run-off round.
  const decided = await prisma.clubElection.findMany({
    where: {
      status: 'closed',
      outcome: 'won',
      winnerCandidateId: { not: null },
      endsAt: { gte: lookbackStart, lte: now },
    },
    select: {
      id: true,
      position: true,
      runoffOfId: true,
      club: { select: { name: true } },
      winnerCandidate: { select: { user: { select: { username: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  const entries = opening.map(election =>
    election.runoffOfId === null
      ? {
          sourceKey: `clubNews:electionOpened:${election.id}`,
          title: `Polls open at ${election.club.name}`,
          body: `Members vote for ${election.position} until ${lastGameDayLabel(election.endsAt)}.`,
          linkPath: '/clubs',
          endsAt: election.endsAt,
        }
      : {
          sourceKey: `clubNews:electionOpened:${election.id}`,
          title: `Run-off at ${election.club.name}`,
          body: `The vote for ${election.position} was tied, so ${joinNames(
            election.candidates.map(c => c.user.username),
          )} go to a one-day run-off.`,
          linkPath: '/clubs',
          endsAt: election.endsAt,
        },
  );
  for (const election of decided) {
    const winner = election.winnerCandidate?.user?.username;
    if (winner) {
      const isRunoff = election.runoffOfId !== null;
      entries.push({
        sourceKey: `clubNews:${isRunoff ? 'runoffResult' : 'electionResult'}:${election.id}`,
        title: `${isRunoff ? 'Run-off' : 'Election'} decided at ${election.club.name}`,
        body: `${winner} wins the vote for ${election.position}.`,
        linkPath: '/clubs',
      });
    }
  }
  return entries;
}

/** The stores whose catalogs announce new items. */
function defaultStoreCatalogs() {
  return [
    {
      shop: 'tack',
      shopName: 'the Tack Shop',
      linkPath: '/tack-shop',
      items: allTackItems().filter(item => !item.isLegacyAlias),
    },
    { shop: 'feed', shopName: 'the Feed Shop', linkPath: '/feed-shop', items: feedCatalogItems() },
  ];
}

/**
 * New Items for the game day of `now`: catalog items whose `addedOn` game date
 * falls in the lookback (today included).
 * @param {Date} now
 * @param {Array<{ shop: string, shopName: string, linkPath: string,
 *                 items: Array<{ id: string, name: string, description?: string,
 *                                addedOn?: string }> }>} [catalogs]
 */
export function collectNewItems(now, catalogs = defaultStoreCatalogs()) {
  const today = gameDayIndex(now);
  const entries = [];
  for (const { shop, shopName, linkPath, items } of catalogs) {
    for (const item of items) {
      if (typeof item.addedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.addedOn)) {
        continue;
      }
      const addedIndex = Date.parse(`${item.addedOn}T00:00:00Z`) / msPerDay;
      if (addedIndex > today || addedIndex < today - lookbackGameDays) {
        continue;
      }
      entries.push({
        sourceKey: `newItem:${shop}:${item.id}`,
        title: `New at ${shopName}: ${item.name}`,
        body: isNonEmptyString(item.description) ? item.description : `Now in ${shopName}.`,
        linkPath,
      });
    }
  }
  return entries;
}

/**
 * The nightly pass: post every game-written entry due at the start of the
 * game day of `now`.
 * @param {Date} [now]
 * @param {{ storeCatalogs?: Parameters<typeof collectNewItems>[1] }} [options]
 * @returns {Promise<{ clubNews: number, newItems: number }>}
 */
export async function postDailyNewsEntries(now = new Date(), { storeCatalogs } = {}) {
  const clubNews = await postGameNewsEntries('clubNews', await collectClubNews(now), now);
  const newItems = await postGameNewsEntries(
    'newItem',
    collectNewItems(now, storeCatalogs ?? defaultStoreCatalogs()),
    now,
  );
  return { clubNews, newItems };
}
