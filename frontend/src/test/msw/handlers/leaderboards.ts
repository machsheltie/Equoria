import { http, HttpResponse } from 'msw';
import {
  getLeaderboardEntries,
  getUserRankSummary,
  VALID_CATEGORIES,
} from '../../fixtures/leaderboards';
import { boardNames } from '@/lib/api/leaderboards';
import type { LeaderboardCategory } from '@/components/leaderboard/LeaderboardCategorySelector';
import type { LeaderboardEntryData } from '@/components/leaderboard/LeaderboardEntry';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * The row the backend really serves for a board (Equoria-y3nia). The generated
 * fixture rows carry fields no backend board sends (rankChange, ...); a test fed
 * those passes on a contract the backend never served. Mirrors
 * backend/modules/leaderboards/services/boardService.mjs.
 */
function toBackendEntry(entry: LeaderboardEntryData, category: LeaderboardCategory) {
  const { rank, horseId, horseName, ownerId, ownerName, primaryStat, isCurrentUser } = entry;
  const owner = { rank, ownerId, ownerName, primaryStat, isCurrentUser };
  const horse = { rank, horseId, horseName, ownerId, ownerName, primaryStat, isCurrentUser };
  const { wins, totalCompetitions: shows } = entry.secondaryStats;

  switch (category) {
    case 'player-xp':
    case 'player-earnings':
      return { ...owner, secondaryStats: {} };
    case 'horse-points':
    case 'horse-earnings':
      return { ...horse, secondaryStats: {} };
    case 'player-win-rate':
      return {
        ...owner,
        secondaryStats: { wins, totalCompetitions: shows, winRate: primaryStat },
      };
    case 'horse-win-rate':
      return {
        ...horse,
        secondaryStats: { wins, totalCompetitions: shows, winRate: primaryStat },
      };
    case 'player-wins':
      return { ...owner, secondaryStats: { wins: primaryStat, totalCompetitions: shows } };
    case 'horse-wins':
    case 'discipline':
      return { ...horse, secondaryStats: { wins: primaryStat, totalCompetitions: shows } };
  }
}

/** The page category a backend board name belongs to. */
const categoryOfBoard = new Map(
  Object.entries(boardNames).map(([category, board]) => [board, category as LeaderboardCategory])
);

/**
 * Leaderboard handlers (user-summary, by-category, horse profile).
 * Registered after the prize block, before the catalog block.
 */
export const leaderboardHandlers = [
  // Leaderboard System - User Rank Summary
  http.get(`${base}/api/v1/leaderboards/user-summary/:userId`, ({ params }) => {
    const userId = params.userId as string;
    const summary = getUserRankSummary(userId);

    if (!summary) {
      return HttpResponse.json({ status: 'error', message: 'User not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      data: summary,
    });
  }),

  // Leaderboard System - Leaderboard by Category
  http.get(`${base}/api/v1/leaderboards/boards/:board`, ({ params, request }) => {
    const category = categoryOfBoard.get(params.board as string) ?? (params.board as string);
    const url = new URL(request.url);
    const discipline = url.searchParams.get('discipline');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // Validate category
    if (!VALID_CATEGORIES.includes(category as LeaderboardCategory)) {
      return HttpResponse.json(
        { status: 'error', message: 'Invalid leaderboard category' },
        { status: 404 }
      );
    }

    // Discipline category requires discipline param
    if (category === 'discipline' && !discipline) {
      return HttpResponse.json(
        { status: 'error', message: 'Discipline parameter required for discipline category' },
        { status: 400 }
      );
    }

    // Generate entries from fixtures
    const allEntries = getLeaderboardEntries(
      category as LeaderboardCategory,
      discipline || undefined
    );

    // Pagination
    const totalEntries = allEntries.length;
    const totalPages = Math.ceil(totalEntries / limit);
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const entries = allEntries
      .slice(startIdx, endIdx)
      .map((entry) => toBackendEntry(entry, category as LeaderboardCategory));

    // The real envelope: { entries, currentPage, totalPages, totalEntries }.
    return HttpResponse.json({
      success: true,
      data: { entries, currentPage: page, totalPages, totalEntries },
    });
  }),

  // Leaderboard horse profile (Equoria-8qnv7) — used by useLeaderboardHorseProfile
  // when a leaderboard entry is clicked to open LeaderboardHorseDetailModal.
  // Derives a deterministic profile from the entry id so the name matches the
  // leaderboard fixture convention (horseId 100+rank → "Horse <rank>").
  http.get(`${base}/api/v1/leaderboards/horse/:horseId`, ({ params }) => {
    const horseId = Number(params.horseId);
    if (!Number.isFinite(horseId) || horseId <= 0) {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }
    // Entry ids in the leaderboard fixture are 100 + rank (see
    // generateLeaderboardEntry); mirror that so the modal title matches the
    // clicked entry's visible name.
    const rank = horseId - 100;
    const name = rank >= 1 ? `Horse ${rank}` : `Horse ${horseId}`;

    return HttpResponse.json({
      success: true,
      data: {
        horseId,
        name,
        breed: 'Arabian',
        age: 7,
        sex: 'Mare',
        stats: {
          speed: 88,
          stamina: 91,
          agility: 76,
          balance: 70,
          precision: 82,
          intelligence: 79,
          boldness: 84,
          flexibility: 73,
          obedience: 80,
          focus: 86,
        },
        totalEarnings: 125000,
        competitionWins: 12,
        topThreeFinishes: 21,
      },
    });
  }),
];
