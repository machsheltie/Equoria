/**
 * Leaderboard Mock Data Fixtures
 *
 * Provides realistic leaderboard data generation functions for use in
 * MSW handlers and component tests. Generates entries for all nine
 * leaderboard boards with deterministic seeded data.
 *
 * Story 5-5: Leaderboards - Task 7
 *
 * Exported functions:
 * - getLeaderboardEntries(category, discipline?) - paginated entry list
 * - getUserRankSummary(userId) - user ranking summary across all categories
 * - generateLeaderboardEntry(rank, category, discipline?) - single entry
 *
 * Constants:
 * - VALID_CATEGORIES - all accepted leaderboard category values
 * - CURRENT_USER_RANK - rank assigned to the "current user" in every category
 * - CURRENT_USER_ID - user ID of the current/logged-in user in fixtures
 */

import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';
import type { LeaderboardCategory } from '@/components/leaderboard/LeaderboardCategorySelector';
import type { CategoryRanking, BestRanking } from '@/components/leaderboard/UserRankDashboard';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All valid leaderboard categories accepted by the API. */
export const VALID_CATEGORIES: LeaderboardCategory[] = [
  'player-xp',
  'player-earnings',
  'player-wins',
  'player-win-rate',
  'horse-points',
  'horse-earnings',
  'horse-wins',
  'horse-win-rate',
  'discipline',
];

/** The boards whose rows are players, not horses. */
export const playerCategories: ReadonlySet<LeaderboardCategory> = new Set([
  'player-xp',
  'player-earnings',
  'player-wins',
  'player-win-rate',
]);

/** The rank at which the "current user" always appears in generated data. */
export const CURRENT_USER_RANK = 42;

/** The user ID used for the current/logged-in user in fixture data. */
export const CURRENT_USER_ID = 'user-123';

/** The user name used for the current/logged-in user in fixture data. */
export const CURRENT_USER_NAME = 'John Doe';

// ---------------------------------------------------------------------------
// Entry generation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the primary stat value for a given rank and category.
 * Higher-ranked entries (lower rank number) receive better stat values.
 *
 * @param rank - The position on the leaderboard (1 = best)
 * @param category - The leaderboard category
 * @returns The numeric primary stat value
 */
export function calculatePrimaryStatForCategory(
  rank: number,
  category: LeaderboardCategory
): number {
  switch (category) {
    case 'player-xp':
      return Math.max(1, 5000 - (rank - 1) * 50);
    case 'horse-points':
      return Math.max(1, 3000 - (rank - 1) * 30);
    case 'player-earnings':
      // Total prize money earned by the player's stable, decreasing
      return Math.max(0, 1000000 - (rank - 1) * 20000);
    case 'horse-earnings':
      return Math.max(0, 500000 - (rank - 1) * 5000);
    case 'player-win-rate':
    case 'horse-win-rate':
      // Top entry wins 100%, decreasing by 1% per rank, minimum 0
      return Math.max(0, 100 - (rank - 1));
    case 'player-wins':
    case 'horse-wins':
      return Math.max(1, 200 - (rank - 1) * 2);
    case 'discipline':
      // Wins in the discipline, decreasing by 1 per rank, minimum 1
      return Math.max(1, 100 - (rank - 1));
    default:
      return rank;
  }
}

/**
 * Calculate a deterministic rank change value for a given rank.
 * Top performers have wider variance, lower performers smaller shifts.
 *
 * Uses a simple deterministic formula (no Math.random) so fixture data
 * remains consistent across test runs.
 *
 * @param rank - The position on the leaderboard
 * @returns A rank change integer (positive = moved up, negative = moved down)
 */
export function calculateRankChange(rank: number): number {
  // Deterministic "pseudo-random" based on rank
  const seed = ((rank * 7 + 13) % 11) - 5; // range roughly -5 to +5
  if (rank <= 10) {
    return seed; // Top 10: wider swings
  }
  if (rank <= 50) {
    return seed > 3 ? 3 : seed < -3 ? -3 : seed; // Top 50: clamp to +/-3
  }
  return seed > 2 ? 2 : seed < -2 ? -2 : seed; // Others: clamp to +/-2
}

/**
 * Generate secondary stats appropriate for a given rank and category.
 *
 * @param rank - Position on the leaderboard
 * @param category - The leaderboard category
 * @returns Secondary stats object
 */
export function generateSecondaryStats(
  rank: number,
  category: LeaderboardCategory
): LeaderboardEntryData['secondaryStats'] {
  const baseCompetitions = Math.max(1, 50 - rank);
  const baseWins = Math.max(0, Math.floor(baseCompetitions * (0.5 - rank * 0.004)));
  const winRate = baseCompetitions > 0 ? Math.round((baseWins / baseCompetitions) * 100) : 0;

  switch (category) {
    case 'player-win-rate':
    case 'horse-win-rate':
      return {
        wins: baseWins,
        totalCompetitions: baseCompetitions,
        winRate,
      };
    case 'player-wins':
    case 'horse-wins':
      return {
        wins: Math.max(1, 200 - (rank - 1) * 2),
        totalCompetitions: 400,
      };
    case 'discipline':
      return {
        wins: Math.max(1, 100 - (rank - 1)),
        totalCompetitions: baseCompetitions,
      };
    default:
      return {};
  }
}

/**
 * Generate a single leaderboard entry for a given rank and category.
 *
 * The entry at rank CURRENT_USER_RANK (42) is always flagged as
 * isCurrentUser and uses the fixture user's identity.
 *
 * @param rank - Position on the leaderboard (1-based)
 * @param category - The leaderboard category
 * @param discipline - Optional discipline name (used for naming only)
 * @returns A fully populated LeaderboardEntryData object
 */
export function generateLeaderboardEntry(
  rank: number,
  category: LeaderboardCategory,
  discipline?: string
): LeaderboardEntryData {
  const isCurrentUser = rank === CURRENT_USER_RANK;

  const isPlayerBoard = playerCategories.has(category);
  const horseName = isPlayerBoard
    ? undefined
    : isCurrentUser
      ? 'My Champion'
      : discipline
        ? `${discipline} Star ${rank}`
        : `Horse ${rank}`;

  return {
    rank,
    horseId: isPlayerBoard ? undefined : 100 + rank,
    horseName,
    ownerId: isCurrentUser ? CURRENT_USER_ID : `user-${rank}`,
    ownerName: isCurrentUser ? CURRENT_USER_NAME : `Owner ${rank}`,
    primaryStat: calculatePrimaryStatForCategory(rank, category),
    secondaryStats: generateSecondaryStats(rank, category),
    isCurrentUser,
    rankChange: calculateRankChange(rank),
  };
}

// ---------------------------------------------------------------------------
// Entry list generation
// ---------------------------------------------------------------------------

/**
 * Get the total number of entries for a given category.
 *
 * @param category - The leaderboard category
 * @returns The total count of entries in this category's leaderboard
 */
function getEntryCount(category: LeaderboardCategory): number {
  return playerCategories.has(category) ? 50 : 100;
}

/**
 * Generate all leaderboard entries for a given category.
 *
 * @param category - The leaderboard category
 * @param discipline - Required when category is 'discipline'
 * @returns Array of LeaderboardEntryData sorted by rank ascending
 */
export function getLeaderboardEntries(
  category: LeaderboardCategory,
  discipline?: string
): LeaderboardEntryData[] {
  const count = getEntryCount(category);
  const entries: LeaderboardEntryData[] = [];

  for (let rank = 1; rank <= count; rank++) {
    entries.push(generateLeaderboardEntry(rank, category, discipline));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// User rank summary
// ---------------------------------------------------------------------------

/**
 * User rank summary data keyed by userId.
 *
 * Currently only the fixture "current user" (user-123) has a summary.
 * Any other userId returns undefined (simulating "user not found").
 */
const userRankSummaries: Record<
  string,
  { userId: string; userName: string; rankings: CategoryRanking[]; bestRankings: BestRanking[] }
> = {
  [CURRENT_USER_ID]: {
    userId: CURRENT_USER_ID,
    userName: CURRENT_USER_NAME,
    rankings: [
      {
        category: 'level',
        categoryLabel: 'Horse Level',
        rank: 42,
        totalEntries: 1254,
        primaryStat: 15,
        statLabel: 'Level',
      },
      {
        category: 'prize-money',
        categoryLabel: 'Prize Money',
        rank: 8,
        totalEntries: 980,
        primaryStat: 125340,
        statLabel: 'Total Earnings',
      },
      {
        category: 'win-rate',
        categoryLabel: 'Win Rate',
        rank: 45,
        totalEntries: 2100,
        primaryStat: 56,
        statLabel: 'Win Rate %',
      },
      {
        category: 'discipline',
        categoryLabel: 'Discipline',
        rank: 23,
        totalEntries: 800,
        primaryStat: 78,
        statLabel: 'Score',
      },
      {
        category: 'owner',
        categoryLabel: 'Owner',
        rank: 15,
        totalEntries: 500,
        primaryStat: 350000,
        statLabel: 'Total Earnings',
      },
      {
        category: 'recent-winners',
        categoryLabel: 'Recent Winners',
        rank: 5,
        totalEntries: 20,
        primaryStat: 92,
        statLabel: 'Score',
      },
    ],
    bestRankings: [
      {
        category: 'recent-winners',
        categoryLabel: 'Recent Winners',
        rank: 5,
        achievement: 'Top 10',
      },
      {
        category: 'prize-money',
        categoryLabel: 'Prize Money',
        rank: 8,
        achievement: 'Top 10',
      },
      {
        category: 'owner',
        categoryLabel: 'Owner',
        rank: 15,
        achievement: 'Top 100',
      },
      {
        category: 'discipline',
        categoryLabel: 'Discipline',
        rank: 23,
        achievement: 'Top 100',
      },
      {
        category: 'level',
        categoryLabel: 'Horse Level',
        rank: 42,
        achievement: 'Top 100',
      },
      {
        category: 'win-rate',
        categoryLabel: 'Win Rate',
        rank: 45,
        achievement: 'Top 100',
      },
    ],
  },
};

/**
 * Retrieve the rank summary for a given user.
 *
 * @param userId - The user ID to look up
 * @returns The user's rank summary, or undefined if the user is not found
 */
export function getUserRankSummary(
  userId: string
):
  | { userId: string; userName: string; rankings: CategoryRanking[]; bestRankings: BestRanking[] }
  | undefined {
  return userRankSummaries[userId];
}
