/**
 * The leaderboards (Equoria-y3nia, owner rulings q10, q11, q40, q42).
 *
 * Nine boards, each in two periods:
 *   players     playerXp, playerEarnings, playerWins, playerWinPercentage
 *   horses      horsePoints, horseEarnings, horseWins, horseWinPercentage
 *   discipline  horses ranked by wins in ONE discipline (q40: wins only)
 *
 * `overall` is counted live from the tables the game already keeps (indexed);
 * `monthly` reads player_monthly_totals / horse_monthly_totals, which the
 * settlement and XP transactions add to (utils/monthlyTotals.mjs) for the
 * current Eastern game month. Win percentage needs at least
 * winPercentageMinShows shows entered in the period. Ties break on the subject
 * id, ascending. Everything a board shows is computed in SQL.
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { gameMonthKey } from '../../../utils/gameTime.mjs';
import { disciplineWinsCategory } from '../../../utils/monthlyTotals.mjs';
import { winPercentageMinShows } from './leaderboardCompetitionQueries.mjs';

export const boardPeriods = ['overall', 'monthly'];

const noRecord = Prisma.sql`0 AS "wins", 0 AS "shows"`;

// A win is a first place; a placeholder row (no placement) is not a show entered.
const playerRecords = Prisma.sql`
  SELECT h."userId" AS "subjectId",
         (COUNT(*) FILTER (WHERE r."placement" = 1))::int AS "wins",
         COUNT(*)::int AS "shows"
  FROM "competition_results" r
  JOIN "horses" h ON h."id" = r."horseId"
  WHERE r."placement" IS NOT NULL AND h."userId" IS NOT NULL
  GROUP BY h."userId"`;

const horseRecords = discipline => Prisma.sql`
  SELECT r."horseId" AS "subjectId",
         (COUNT(*) FILTER (WHERE r."placement" = 1))::int AS "wins",
         COUNT(*)::int AS "shows"
  FROM "competition_results" r
  WHERE r."placement" IS NOT NULL${
    discipline === undefined ? Prisma.empty : Prisma.sql` AND r."discipline" = ${discipline}`
  }
  GROUP BY r."horseId"`;

const monthlyRecords = (kind, month) =>
  kind === 'player'
    ? Prisma.sql`
  SELECT s."playerId" AS "subjectId", COALESCE(w."value", 0)::int AS "wins", s."value"::int AS "shows"
  FROM "player_monthly_totals" s
  LEFT JOIN "player_monthly_totals" w
    ON w."month" = s."month" AND w."category" = 'wins' AND w."playerId" = s."playerId"
  WHERE s."month" = ${month} AND s."category" = 'shows'`
    : Prisma.sql`
  SELECT s."horseId" AS "subjectId", COALESCE(w."value", 0)::int AS "wins", s."value"::int AS "shows"
  FROM "horse_monthly_totals" s
  LEFT JOIN "horse_monthly_totals" w
    ON w."month" = s."month" AND w."category" = 'wins' AND w."horseId" = s."horseId"
  WHERE s."month" = ${month} AND s."category" = 'shows'`;

const winsOf = records => Prisma.sql`
  SELECT "subjectId", "wins" AS "value", "wins", "shows" FROM (${records}) AS "record"
  WHERE "wins" >= 1`;

const winPercentageOf = records => Prisma.sql`
  SELECT "subjectId", "wins"::float8 / "shows" AS "value", "wins", "shows"
  FROM (${records}) AS "record"
  WHERE "shows" >= ${winPercentageMinShows}`;

const playerCounter = (month, category) => Prisma.sql`
  SELECT "playerId" AS "subjectId", "value"::float8 AS "value", ${noRecord}
  FROM "player_monthly_totals"
  WHERE "month" = ${month} AND "category" = ${category} AND "value" > 0`;

const horseCounter = (month, category) => Prisma.sql`
  SELECT "horseId" AS "subjectId", "value"::float8 AS "value", ${noRecord}
  FROM "horse_monthly_totals"
  WHERE "month" = ${month} AND "category" = ${category} AND "value" > 0`;

/**
 * Each board: its subject kind, which figure ranks it, and `records(period,
 * context)`, SQL with the columns subjectId, value, wins, shows.
 */
const boards = {
  playerXp: {
    kind: 'player',
    stat: 'value',
    records: (period, { month }) =>
      period === 'monthly'
        ? playerCounter(month, 'xp')
        : Prisma.sql`SELECT "id" AS "subjectId", "xp"::float8 AS "value", ${noRecord} FROM "User" WHERE "xp" > 0`,
  },
  playerEarnings: {
    kind: 'player',
    stat: 'value',
    records: (period, { month }) =>
      period === 'monthly'
        ? playerCounter(month, 'earnings')
        : Prisma.sql`
  SELECT "userId" AS "subjectId", SUM("totalEarnings")::float8 AS "value", ${noRecord}
  FROM "horses" WHERE "userId" IS NOT NULL
  GROUP BY "userId" HAVING SUM("totalEarnings") > 0`,
  },
  playerWins: {
    kind: 'player',
    stat: 'wins',
    records: (period, { month }) =>
      winsOf(period === 'monthly' ? monthlyRecords('player', month) : playerRecords),
  },
  playerWinPercentage: {
    kind: 'player',
    stat: 'winPercentage',
    records: (period, { month }) =>
      winPercentageOf(period === 'monthly' ? monthlyRecords('player', month) : playerRecords),
  },
  horsePoints: {
    kind: 'horse',
    stat: 'value',
    records: (period, { month }) =>
      period === 'monthly'
        ? horseCounter(month, 'points')
        : Prisma.sql`SELECT "id" AS "subjectId", "horseXp"::float8 AS "value", ${noRecord} FROM "horses" WHERE "horseXp" > 0`,
  },
  horseEarnings: {
    kind: 'horse',
    stat: 'value',
    records: (period, { month }) =>
      period === 'monthly'
        ? horseCounter(month, 'earnings')
        : Prisma.sql`SELECT "id" AS "subjectId", "totalEarnings"::float8 AS "value", ${noRecord} FROM "horses" WHERE "totalEarnings" > 0`,
  },
  horseWins: {
    kind: 'horse',
    stat: 'wins',
    records: (period, { month }) =>
      winsOf(period === 'monthly' ? monthlyRecords('horse', month) : horseRecords()),
  },
  horseWinPercentage: {
    kind: 'horse',
    stat: 'winPercentage',
    records: (period, { month }) =>
      winPercentageOf(period === 'monthly' ? monthlyRecords('horse', month) : horseRecords()),
  },
  discipline: {
    kind: 'horse',
    stat: 'wins',
    records: (period, { month, discipline }) =>
      period === 'monthly'
        ? horseCounter(month, disciplineWinsCategory(discipline))
        : winsOf(horseRecords(discipline)),
  },
};

export const boardNames = Object.keys(boards);

/**
 * The player boards, the categories of "Your rankings" (Equoria-3kfne, owner
 * rulings q10, q11).
 */
export const playerBoardNames = Object.keys(boards).filter(name => boards[name].kind === 'player');

/** Authored labels for the player boards: the card title and the stat's own label. */
export const playerBoardLabels = {
  playerXp: { categoryLabel: 'Player XP', statLabel: 'XP' },
  playerEarnings: { categoryLabel: 'Player Earnings', statLabel: 'Earnings' },
  playerWins: { categoryLabel: 'Player Wins', statLabel: 'Wins' },
  playerWinPercentage: { categoryLabel: 'Player Win %', statLabel: 'Win %' },
};

/**
 * One player board over the whole game with every entry's place, exactly as
 * the board page orders it (value, then subject id). Columns: subjectId,
 * value, wins, shows, rank, total. A player who is not on the board has no row.
 */
function rankedPlayerBoardSql(boardName) {
  return Prisma.sql`
    SELECT "subjectId", "value", "wins", "shows",
           (ROW_NUMBER() OVER (ORDER BY "value" DESC, "subjectId" ASC))::int AS "rank",
           (COUNT(*) OVER ())::int AS "total"
    FROM (${boards[boardName].records('overall', {})}) AS "board"`;
}

/**
 * One player's place on one board, or null when they are not on it.
 *
 * @returns {Promise<{ rank: number, total: number, primaryStat: number } | null>}
 */
export async function loadPlayerStanding(boardName, userId) {
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT * FROM (${rankedPlayerBoardSql(boardName)}) AS "ranked" WHERE "subjectId" = ${userId}`);
  const row = rows[0];
  if (!row) {
    return null;
  }
  const value = Number(row.value);
  return {
    rank: row.rank,
    total: row.total,
    primaryStat: boards[boardName].stat === 'winPercentage' ? toPercent(value) : value,
  };
}

export const isBoardName = name => Object.hasOwn(boards, name);

/** Win percentage to one decimal place, for display only (ranking uses the exact ratio). */
const toPercent = ratio => Math.round(ratio * 1000) / 10;

/** Names for a page of subjects: player usernames, or horse names with their owners. */
async function readSubjects(kind, ids) {
  const people = new Map();
  if (ids.length === 0) {
    return people;
  }
  if (kind === 'player') {
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
    for (const user of users) {
      people.set(user.id, { ownerId: user.id, ownerName: user.username });
    }
    return people;
  }
  const found = await prisma.horse.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, userId: true, user: { select: { username: true } } },
  });
  for (const horse of found) {
    people.set(horse.id, {
      horseName: horse.name,
      ownerId: horse.userId,
      ownerName: horse.user?.username ?? null,
    });
  }
  return people;
}

/** The secondary figures an entry shows beside its primary stat. */
function secondaryStatsOf(board, period, row, percent) {
  if (board.stat === 'winPercentage') {
    return { wins: row.wins, totalCompetitions: row.shows, winRate: percent };
  }
  if (board.stat === 'wins') {
    return period === 'overall' || board.kind === 'horse'
      ? { wins: row.wins, totalCompetitions: row.shows }
      : { wins: row.wins };
  }
  return {};
}

/**
 * One page of a board, with its total, as page entries.
 *
 * @param {string} boardName - one of boardNames.
 * @param {'overall'|'monthly'} period
 * @param {{ take: number, skip: number }} window
 * @param {{ discipline?: string, now?: Date }} [options] - discipline for the
 *   discipline board; now picks the game month of the monthly boards.
 * @returns {Promise<{ entries: object[], total: number }>}
 */
export async function loadBoard(boardName, period, { take, skip }, options = {}) {
  const board = boards[boardName];
  const month = gameMonthKey(options.now ?? new Date());
  const records = board.records(period, { month, discipline: options.discipline });

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT * FROM (${records}) AS "board"
      ORDER BY "value" DESC, "subjectId" ASC
      LIMIT ${take} OFFSET ${skip}`),
    prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int AS "total" FROM (${records}) AS "board"`),
  ]);

  const people = await readSubjects(
    board.kind,
    rows.map(row => row.subjectId),
  );
  const entries = rows.map((row, index) => {
    const subject = people.get(row.subjectId);
    const value = Number(row.value);
    const percent = board.stat === 'winPercentage' ? toPercent(value) : null;
    const entry = {
      rank: skip + index + 1,
      ownerId: subject?.ownerId ?? null,
      ownerName: subject?.ownerName ?? null,
      primaryStat: percent ?? value,
      secondaryStats: secondaryStatsOf(board, period, row, percent),
    };
    if (board.kind === 'horse') {
      entry.horseId = row.subjectId;
      entry.horseName = subject?.horseName ?? null;
    }
    return entry;
  });
  return { entries, total: Number(totals[0]?.total ?? 0) };
}
