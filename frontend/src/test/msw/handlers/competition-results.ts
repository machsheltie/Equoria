import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Competition results / horse competition-history / user competition-stats.
 * Registered after the competition block, before the prize block.
 * First-match-wins order preserved.
 */
export const competitionResultsHandlers = [
  // Competition Results System - Competition Results
  http.get(`${base}/api/v1/competitions/:id/results`, ({ params }) => {
    const id = Number(params.id);

    // Return 404 for competition ID 999 (error test case)
    if (id === 999) {
      return HttpResponse.json(
        { status: 'error', message: 'Competition results not found' },
        { status: 404 }
      );
    }

    // Return empty results for competition ID 888 (empty results test case)
    if (id === 888) {
      return HttpResponse.json({
        success: true,
        data: {
          competitionId: id,
          competitionName: 'Empty Competition',
          discipline: 'dressage',
          date: '2026-02-01T10:00:00Z',
          totalParticipants: 0,
          prizePool: 5000,
          prizeDistribution: {
            first: 2500,
            second: 1500,
            third: 1000,
          },
          results: [],
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        competitionId: id,
        competitionName: 'Spring Dressage Championship',
        discipline: 'dressage',
        date: '2026-03-15T10:00:00Z',
        totalParticipants: 12,
        prizePool: 5000,
        prizeDistribution: {
          first: 2500,
          second: 1500,
          third: 1000,
        },
        results: [
          {
            rank: 1,
            horseId: 1,
            horseName: 'Thunder',
            ownerId: 'user-1',
            ownerName: 'John Doe',
            finalScore: 95.5,
            prizeWon: 2500,
            isCurrentUser: true,
            xpGained: 150,
            leveledUp: true,
            oldLevel: 4,
            newLevel: 5,
            scoreBreakdown: {
              baseStatScore: 70,
              traitBonus: 5,
              trainingScore: 10,
              equipmentBonus: 3,
              riderBonus: 5,
              healthModifier: 0,
              randomLuck: 2.5,
            },
          },
          {
            rank: 2,
            horseId: 2,
            horseName: 'Storm',
            ownerId: 'user-2',
            ownerName: 'Jane Smith',
            finalScore: 88.2,
            prizeWon: 1500,
            isCurrentUser: false,
            xpGained: 100,
            leveledUp: false,
            oldLevel: 3,
            newLevel: 3,
          },
          {
            rank: 3,
            horseId: 3,
            horseName: 'Lightning',
            ownerId: 'user-3',
            ownerName: 'Bob Wilson',
            finalScore: 82.0,
            prizeWon: 1000,
            isCurrentUser: false,
            xpGained: 75,
            leveledUp: false,
            oldLevel: 6,
            newLevel: 6,
          },
        ],
      },
    });
  }),

  // Competition Results System - Horse Competition History
  http.get(`${base}/api/v1/horses/:id/competition-history`, ({ params }) => {
    const id = Number(params.id);

    // Return 404 for horse ID 999 (error test case)
    if (id === 999) {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }

    // Return empty history for horse ID 888 (new horse with no history)
    if (id === 888) {
      return HttpResponse.json({
        success: true,
        data: {
          horseId: id,
          horseName: 'New Horse',
          statistics: {
            totalCompetitions: 0,
            wins: 0,
            top3Finishes: 0,
            winRate: 0,
            totalPrizeMoney: 0,
            averagePlacement: 0,
            bestPlacement: 0,
          },
          competitions: [],
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        horseId: id,
        horseName: 'Thunder',
        statistics: {
          totalCompetitions: 15,
          wins: 5,
          top3Finishes: 10,
          winRate: 33.33,
          totalPrizeMoney: 12500,
          averagePlacement: 2.8,
          bestPlacement: 1,
        },
        competitions: [
          {
            competitionId: 1,
            competitionName: 'Spring Dressage Championship',
            discipline: 'dressage',
            date: '2026-03-15T10:00:00Z',
            placement: 1,
            totalParticipants: 12,
            finalScore: 95.5,
            prizeMoney: 2500,
            xpGained: 150,
          },
          {
            competitionId: 2,
            competitionName: 'Winter Jumping Series',
            discipline: 'jumping',
            date: '2026-02-10T14:00:00Z',
            placement: 2,
            totalParticipants: 20,
            finalScore: 88.2,
            prizeMoney: 1500,
            xpGained: 100,
          },
          {
            competitionId: 3,
            competitionName: 'Regional Eventing Finals',
            discipline: 'eventing',
            date: '2026-01-25T09:00:00Z',
            placement: 3,
            totalParticipants: 18,
            finalScore: 82.0,
            prizeMoney: 1000,
            xpGained: 75,
          },
        ],
      },
    });
  }),

  // Competition Results System - User Competition Stats
  http.get(`${base}/api/v1/users/:id/competition-stats`, ({ params }) => {
    const id = params.id as string;

    // Return 404 for user ID 'error-user' (error test case)
    if (id === 'error-user') {
      return HttpResponse.json({ status: 'error', message: 'User not found' }, { status: 404 });
    }

    // Return zero stats for user ID 'new-user' (new user with no stats)
    if (id === 'new-user') {
      return HttpResponse.json({
        success: true,
        data: {
          userId: id,
          totalCompetitions: 0,
          totalWins: 0,
          totalTop3: 0,
          winRate: 0,
          totalPrizeMoney: 0,
          totalXpGained: 0,
          bestPlacement: 0,
          mostSuccessfulDiscipline: '',
          recentCompetitions: [],
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        userId: id,
        totalCompetitions: 45,
        totalWins: 12,
        totalTop3: 28,
        winRate: 26.67,
        totalPrizeMoney: 35000,
        totalXpGained: 4500,
        bestPlacement: 1,
        mostSuccessfulDiscipline: 'dressage',
        recentCompetitions: [
          {
            competitionId: 1,
            competitionName: 'Spring Dressage Championship',
            discipline: 'dressage',
            date: '2026-03-15T10:00:00Z',
            placement: 1,
            totalParticipants: 12,
            finalScore: 95.5,
            prizeMoney: 2500,
            xpGained: 150,
          },
          {
            competitionId: 2,
            competitionName: 'Winter Jumping Series',
            discipline: 'jumping',
            date: '2026-02-10T14:00:00Z',
            placement: 2,
            totalParticipants: 20,
            finalScore: 88.2,
            prizeMoney: 1500,
            xpGained: 100,
          },
          {
            competitionId: 3,
            competitionName: 'Regional Eventing Finals',
            discipline: 'eventing',
            date: '2026-01-25T09:00:00Z',
            placement: 3,
            totalParticipants: 18,
            finalScore: 82.0,
            prizeMoney: 1000,
            xpGained: 75,
          },
          {
            competitionId: 4,
            competitionName: 'Amateur Dressage Cup',
            discipline: 'dressage',
            date: '2026-01-15T11:00:00Z',
            placement: 1,
            totalParticipants: 15,
            finalScore: 91.3,
            prizeMoney: 2000,
            xpGained: 125,
          },
          {
            competitionId: 5,
            competitionName: 'Cross Country Challenge',
            discipline: 'eventing',
            date: '2026-01-05T08:00:00Z',
            placement: 4,
            totalParticipants: 25,
            finalScore: 78.5,
            prizeMoney: 500,
            xpGained: 50,
          },
        ],
      },
    });
  }),
];
