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
  // Test 1: getLeaderboardEntries returns level leaderboard with correct primary stats
  it('should return level leaderboard entries with decreasing level values', () => {
    const entries = getLeaderboardEntries('level');

    expect(entries.length).toBe(100);
    // Rank 1 should have the highest level (20)
    expect(entries[0].rank).toBe(1);
    expect(entries[0].primaryStat).toBe(20);
    // Each entry should have rank === index + 1
    entries.forEach((entry, idx) => {
      expect(entry.rank).toBe(idx + 1);
    });
    // Primary stat should be non-increasing
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].primaryStat).toBeLessThanOrEqual(entries[i - 1].primaryStat);
    }
  });

  // Test 2: getLeaderboardEntries returns prize-money leaderboard
  it('should return prize-money leaderboard entries with decreasing prize values', () => {
    const entries = getLeaderboardEntries('prize-money');

    expect(entries.length).toBe(100);
    // Rank 1 should have $500,000
    expect(entries[0].primaryStat).toBe(500000);
    // Rank 2 should have $495,000
    expect(entries[1].primaryStat).toBe(495000);
    // All values should be >= 0
    entries.forEach((entry) => {
      expect(entry.primaryStat).toBeGreaterThanOrEqual(0);
    });
  });

  // Test 3: getLeaderboardEntries returns win-rate leaderboard
  it('should return win-rate leaderboard entries with decreasing win rates', () => {
    const entries = getLeaderboardEntries('win-rate');

    expect(entries.length).toBe(100);
    // Rank 1 should have 100% win rate
    expect(entries[0].primaryStat).toBe(100);
    // All values should be between 0 and 100
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
    expect(getLeaderboardEntries('level').length).toBe(100);
    expect(getLeaderboardEntries('prize-money').length).toBe(100);
    expect(getLeaderboardEntries('win-rate').length).toBe(100);
    expect(getLeaderboardEntries('discipline', 'Dressage').length).toBe(100);
    expect(getLeaderboardEntries('owner').length).toBe(50);
    expect(getLeaderboardEntries('recent-winners').length).toBe(20);
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
    const categoriesToCheck: Array<{ category: typeof VALID_CATEGORIES[number]; discipline?: string }> = [
      { category: 'level' },
      { category: 'prize-money' },
      { category: 'win-rate' },
      { category: 'discipline', discipline: 'Dressage' },
      { category: 'owner' },
    ];

    categoriesToCheck.forEach(({ category, discipline }) => {
      const entries = getLeaderboardEntries(category, discipline);
      const userEntry = entries.find((e) => e.isCurrentUser);

      expect(userEntry).toBeDefined();
      expect(userEntry!.rank).toBe(CURRENT_USER_RANK);
      expect(userEntry!.ownerId).toBe(CURRENT_USER_ID);
      expect(userEntry!.ownerName).toBe(CURRENT_USER_NAME);
    });

    // recent-winners only has 20 entries, so current user at rank 42 is absent
    const recentEntries = getLeaderboardEntries('recent-winners');
    const recentUser = recentEntries.find((e) => e.isCurrentUser);
    expect(recentUser).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MSW Handler Integration Tests (7 tests)
// ---------------------------------------------------------------------------

describe('Leaderboard MSW Handlers', () => {
  const base = 'http://localhost:3001';

  // Test 9: GET /api/leaderboards/level returns leaderboard data
  it('should return leaderboard data for a valid category', async () => {
    const response = await fetch(`${base}/api/leaderboards/level?period=all-time&page=1&limit=50`);

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('category', 'level');
    expect(json.data).toHaveProperty('period', 'all-time');
    expect(json.data).toHaveProperty('entries');
    expect(json.data).toHaveProperty('totalEntries');
    expect(json.data).toHaveProperty('currentPage', 1);
    expect(json.data).toHaveProperty('totalPages');
    expect(json.data).toHaveProperty('lastUpdated');
    expect(json.data.entries.length).toBeLessThanOrEqual(50);
  });

  // Test 10: Pagination returns different entries for page 2
  it('should return different entries when requesting page 2', async () => {
    const page1Res = await fetch(`${base}/api/leaderboards/level?period=all-time&page=1&limit=10`);
    const page1 = await page1Res.json();

    const page2Res = await fetch(`${base}/api/leaderboards/level?period=all-time&page=2&limit=10`);
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
    const response = await fetch(`${base}/api/leaderboards/level?period=all-time&page=1&limit=5`);
    const json = await response.json();

    expect(json.data.entries.length).toBe(5);
  });

  // Test 12: Returns 404 for invalid category
  it('should return 404 for an invalid leaderboard category', async () => {
    const response = await fetch(`${base}/api/leaderboards/invalid-category?period=all-time`);

    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.status).toBe('error');
  });

  // Test 13: Returns 400 for discipline category without discipline param
  it('should return 400 when discipline category is requested without discipline param', async () => {
    const response = await fetch(`${base}/api/leaderboards/discipline?period=all-time`);

    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.status).toBe('error');
  });

  // Test 14: GET /api/leaderboards/user-summary/:userId returns data
  it('should return user rank summary for a valid user ID', async () => {
    const response = await fetch(`${base}/api/leaderboards/user-summary/${CURRENT_USER_ID}`);

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
    const response = await fetch(`${base}/api/leaderboards/user-summary/nonexistent-user`);

    expect(response.status).toBe(404);

    const json = await response.json();
    expect(json.status).toBe('error');
  });
});
