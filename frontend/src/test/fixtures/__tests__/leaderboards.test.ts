/**
 * Leaderboard Fixture and MSW Handler Tests
 *
 * Tests for:
 * - Fixture data generation functions (8 tests)
 * - MSW handler integration for leaderboard endpoints (7 tests)
 *
 * Story 5-5: Leaderboards - Task 7
 * Target: 15 tests
 */

import { describe, it, expect } from 'vitest';
import {
  getLeaderboardEntries,
  getUserRankSummary,
  VALID_CATEGORIES,
  CURRENT_USER_RANK,
  CURRENT_USER_ID,
  CURRENT_USER_NAME,
} from '../leaderboards';

// ---------------------------------------------------------------------------
// Fixture Data Tests (8 tests)
// ---------------------------------------------------------------------------

describe('Leaderboard Fixtures', () => {
  // Test 1: getLeaderboardEntries returns the player XP board with correct primary stats
  it('should return player XP entries with decreasing values', () => {
    const entries = getLeaderboardEntries('player-xp');

    expect(entries.length).toBe(50);
    expect(entries[0].rank).toBe(1);
    expect(entries[0].primaryStat).toBe(5000);
    entries.forEach((entry, idx) => {
      expect(entry.rank).toBe(idx + 1);
    });
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].primaryStat).toBeLessThanOrEqual(entries[i - 1].primaryStat);
    }
    // A player board has no horse.
    expect(entries[0].horseId).toBeUndefined();
  });

  // Test 2: getLeaderboardEntries returns horse earnings
  it('should return horse-earnings entries with decreasing prize values', () => {
    const entries = getLeaderboardEntries('horse-earnings');

    expect(entries.length).toBe(100);
    expect(entries[0].primaryStat).toBe(500000);
    expect(entries[1].primaryStat).toBe(495000);
    entries.forEach((entry) => {
      expect(entry.primaryStat).toBeGreaterThanOrEqual(0);
    });
  });

  // Test 3: getLeaderboardEntries returns horse win percentage
  it('should return horse-win-rate entries with decreasing win rates', () => {
    const entries = getLeaderboardEntries('horse-win-rate');

    expect(entries.length).toBe(100);
    expect(entries[0].primaryStat).toBe(100);
    entries.forEach((entry) => {
      expect(entry.primaryStat).toBeGreaterThanOrEqual(0);
      expect(entry.primaryStat).toBeLessThanOrEqual(100);
    });
  });

  // Test 4: getLeaderboardEntries returns discipline leaderboard with discipline param
  it('should return discipline leaderboard entries including discipline in horse names', () => {
    const entries = getLeaderboardEntries('discipline', 'Dressage');

    expect(entries.length).toBe(100);
    // Non-current-user entries should include the discipline in the horse name
    const nonUserEntry = entries.find((e) => !e.isCurrentUser);
    expect(nonUserEntry).toBeDefined();
    expect(nonUserEntry!.horseName).toContain('Dressage');
  });

  // Test 5: getLeaderboardEntries returns correct counts for different categories
  it('should return the correct number of entries per category', () => {
    expect(getLeaderboardEntries('horse-points').length).toBe(100);
    expect(getLeaderboardEntries('horse-earnings').length).toBe(100);
    expect(getLeaderboardEntries('horse-win-rate').length).toBe(100);
    expect(getLeaderboardEntries('discipline', 'Dressage').length).toBe(100);
    expect(getLeaderboardEntries('player-xp').length).toBe(50);
    expect(getLeaderboardEntries('player-win-rate').length).toBe(50);
  });

  // Test 6: getUserRankSummary returns data for valid userId
  it('should return user rank summary for a valid user ID', () => {
    const summary = getUserRankSummary(CURRENT_USER_ID);

    expect(summary).toBeDefined();
    expect(summary!.userId).toBe(CURRENT_USER_ID);
    expect(summary!.userName).toBe(CURRENT_USER_NAME);
    expect(summary!.rankings.length).toBe(6);
    expect(summary!.bestRankings.length).toBeGreaterThan(0);

    // Each ranking should have all required fields
    summary!.rankings.forEach((ranking) => {
      expect(ranking).toHaveProperty('category');
      expect(ranking).toHaveProperty('categoryLabel');
      expect(ranking).toHaveProperty('rank');
      expect(ranking).toHaveProperty('totalEntries');
      expect(ranking).toHaveProperty('rankChange');
      expect(ranking).toHaveProperty('primaryStat');
      expect(ranking).toHaveProperty('statLabel');
    });
  });

  // Test 7: getUserRankSummary returns undefined for invalid userId
  it('should return undefined for a non-existent user ID', () => {
    const summary = getUserRankSummary('nonexistent-user');
    expect(summary).toBeUndefined();
  });

  // Test 8: The current user entry is always at rank 42 in generated leaderboards
  it('should place the current user at rank 42 in every category', () => {
    const categoriesToCheck: Array<{
      category: (typeof VALID_CATEGORIES)[number];
      discipline?: string;
    }> = [
      { category: 'player-xp' },
      { category: 'horse-earnings' },
      { category: 'horse-win-rate' },
      { category: 'discipline', discipline: 'Dressage' },
      { category: 'player-earnings' },
    ];

    categoriesToCheck.forEach(({ category, discipline }) => {
      const entries = getLeaderboardEntries(category, discipline);
      const userEntry = entries.find((e) => e.isCurrentUser);

      expect(userEntry).toBeDefined();
      expect(userEntry!.rank).toBe(CURRENT_USER_RANK);
      expect(userEntry!.ownerId).toBe(CURRENT_USER_ID);
      expect(userEntry!.ownerName).toBe(CURRENT_USER_NAME);
    });
  });
});

// ---------------------------------------------------------------------------
// MSW Handler Integration Tests (7 tests)
// ---------------------------------------------------------------------------

describe('Leaderboard MSW Handlers', () => {
  // MSW handlers (src/test/msw/handlers.ts) bind to http://localhost:3000.
  // Earlier value '3001' caused MSW to fail-open with "Cannot bypass a request
  // when using the 'error' strategy" because no handler matched.
  const base = 'http://localhost:3000';

  // Test 9: GET /api/v1/leaderboards/boards/playerXp returns leaderboard data
  it('should return leaderboard data for a valid category', async () => {
    const response = await fetch(
      `${base}/api/v1/leaderboards/boards/playerXp?period=overall&page=1&limit=50`
    );

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    // The backend's real envelope (Equoria-pthuj) — no category, period or
    // lastUpdated, which the old fixture invented.
    expect(Object.keys(json.data).sort()).toEqual([
      'currentPage',
      'entries',
      'totalEntries',
      'totalPages',
    ]);
    expect(json.data).toHaveProperty('currentPage', 1);
    expect(json.data.entries.length).toBeLessThanOrEqual(50);
  });

  // Test 10: Pagination returns different entries for page 2
  it('should return different entries when requesting page 2', async () => {
    const page1Res = await fetch(
      `${base}/api/v1/leaderboards/boards/playerXp?period=overall&page=1&limit=10`
    );
    const page1 = await page1Res.json();

    const page2Res = await fetch(
      `${base}/api/v1/leaderboards/boards/playerXp?period=overall&page=2&limit=10`
    );
    const page2 = await page2Res.json();

    expect(page1.data.currentPage).toBe(1);
    expect(page2.data.currentPage).toBe(2);

    // Entries on page 1 and page 2 should differ
    const page1Ranks = page1.data.entries.map((e: { rank: number }) => e.rank);
    const page2Ranks = page2.data.entries.map((e: { rank: number }) => e.rank);
    expect(page1Ranks).not.toEqual(page2Ranks);
  });

  // Test 11: Limit parameter controls entries per page
  it('should respect the limit parameter for entries per page', async () => {
    const response = await fetch(
      `${base}/api/v1/leaderboards/boards/playerXp?period=overall&page=1&limit=5`
    );
    const json = await response.json();

    expect(json.data.entries.length).toBe(5);
  });

  // Test 12: Returns 404 for invalid category
  it('should return 404 for an invalid leaderboard category', async () => {
    const response = await fetch(`${base}/api/v1/leaderboards/boards/invalidBoard?period=overall`);

    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.status).toBe('error');
  });

  // Test 13: Returns 400 for discipline category without discipline param
  it('should return 400 when discipline category is requested without discipline param', async () => {
    const response = await fetch(`${base}/api/v1/leaderboards/boards/discipline?period=overall`);

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.status).toBe('error');
  });

  // Test 14: GET /api/v1/leaderboards/user-summary/:userId returns data (Equoria-0fw18: versioned)
  it('should return user rank summary for a valid user ID', async () => {
    const response = await fetch(`${base}/api/v1/leaderboards/user-summary/${CURRENT_USER_ID}`);

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('userId', CURRENT_USER_ID);
    expect(json.data).toHaveProperty('userName');
    expect(json.data).toHaveProperty('rankings');
    expect(json.data).toHaveProperty('bestRankings');
    expect(json.data.rankings.length).toBeGreaterThan(0);
  });

  // Test 15: GET /api/leaderboards/user-summary/:userId returns 404 for unknown user
  it('should return 404 for a non-existent user in user-summary', async () => {
    const response = await fetch(`${base}/api/v1/leaderboards/user-summary/nonexistent-user`);

    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.status).toBe('error');
  });
});
