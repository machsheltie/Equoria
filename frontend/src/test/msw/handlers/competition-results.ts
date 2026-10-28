import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Competition results / horse competition-history / user competition-stats.
 * Registered after the competition block, before the prize block.
 * First-match-wins order preserved.
 */
export const competitionResultsHandlers = [
  // Equoria-oey96.28 — mark-viewed write. The results page fires this whenever it
  // renders results, so it must be handled or MSW's onUnhandledRequest: 'error'
  // fails every suite that mounts the page.
  http.post(`${base}/api/v1/competition/results/viewed`, async ({ request }) => {
    const body = (await request.json()) as { showIds?: number[] };
    return HttpResponse.json({ success: true, markedCount: body?.showIds?.length ?? 0 });
  }),

  // One show's results: the backend's scoped DTO (competitionResultRecord.mjs,
  // Equoria-q4uem.10, owner ruling R4). No `data` envelope; a missing show is
  // 200 with `show: null` and no results.
  http.get(`${base}/api/v1/competition/show/:showId/results`, ({ params }) => {
    const showId = Number(params.showId);

    // Transport failure case (error-state tests).
    if (showId === 999) {
      return HttpResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }

    const show = {
      id: showId,
      name: showId === 888 ? 'Empty Competition' : 'Spring Dressage Championship',
      discipline: 'Dressage',
      showType: 'ridden',
      status: 'completed',
      scheduledRunDate: '2026-03-15T07:00:00.000Z',
      executedAt: '2026-03-15T07:02:00.000Z',
      prize: 5000,
    };

    // Settled with no entrants (empty-state tests).
    if (showId === 888) {
      return HttpResponse.json({ success: true, showId, count: 0, show, results: [] });
    }

    const runDate = '2026-03-15T07:02:00.000Z';
    const results = [
      {
        resultId: 1,
        horseId: 1,
        horseName: 'Thunder',
        ownerName: 'John Doe',
        isViewerHorse: true,
        placement: 1,
        score: 95.5,
        prizeWon: 2500,
        runDate,
        horsePointsAwarded: 30,
        statGain: { stat: 'precision', gain: 1 },
        conformationAward: null,
      },
      {
        resultId: 2,
        horseId: 2,
        horseName: 'Storm',
        ownerName: 'Jane Smith',
        isViewerHorse: false,
        placement: 2,
        score: 88.2,
        prizeWon: 1500,
        runDate,
        horsePointsAwarded: 27,
        statGain: null,
        conformationAward: null,
      },
      {
        resultId: 3,
        horseId: 3,
        horseName: 'Lightning',
        ownerName: 'Bob Wilson',
        isViewerHorse: false,
        placement: 3,
        score: 82.0,
        prizeWon: 1000,
        runDate,
        horsePointsAwarded: 25,
        statGain: null,
        conformationAward: null,
      },
    ];
    return HttpResponse.json({ success: true, showId, count: results.length, show, results });
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
            secondPlaces: 0,
            thirdPlaces: 0,
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
          secondPlaces: 3,
          thirdPlaces: 2,
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
