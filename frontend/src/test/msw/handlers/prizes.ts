import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Prize history / horse prize-summary / XP history / claim-prizes handlers.
 * Registered after the competition-results block, before leaderboards.
 * First-match-wins order preserved.
 */
export const prizeHandlers = [
  // Prize System - User Prize History
  http.get(`${base}/api/v1/users/:userId/prize-history`, ({ params, request }) => {
    const userId = params.userId as string;
    const url = new URL(request.url);
    const dateRange = url.searchParams.get('dateRange');
    const horseId = url.searchParams.get('horseId');
    const discipline = url.searchParams.get('discipline');

    // Return 404 for error-user (error test case)
    if (userId === 'error-user') {
      return HttpResponse.json({ status: 'error', message: 'User not found' }, { status: 404 });
    }

    // Return empty for new-user (empty history test case)
    if (userId === 'new-user') {
      return HttpResponse.json({
        success: true,
        data: [],
      });
    }

    // Full prize history data
    let prizeHistory = [
      {
        transactionId: 'txn-001',
        date: '2026-03-15T10:00:00Z',
        competitionId: 1,
        competitionName: 'Spring Dressage Championship',
        horseId: 1,
        horseName: 'Thunder',
        discipline: 'dressage',
        placement: 1,
        prizeMoney: 2500,
        xpGained: 150,
        claimed: true,
        claimedAt: '2026-03-15T12:00:00Z',
      },
      {
        transactionId: 'txn-002',
        date: '2026-02-10T14:00:00Z',
        competitionId: 2,
        competitionName: 'Winter Jumping Series',
        horseId: 2,
        horseName: 'Storm',
        discipline: 'jumping',
        placement: 2,
        prizeMoney: 1500,
        xpGained: 100,
        claimed: true,
        claimedAt: '2026-02-10T16:00:00Z',
      },
      {
        transactionId: 'txn-003',
        date: '2026-01-25T09:00:00Z',
        competitionId: 3,
        competitionName: 'Regional Eventing Finals',
        horseId: 1,
        horseName: 'Thunder',
        discipline: 'eventing',
        placement: 3,
        prizeMoney: 1000,
        xpGained: 75,
        claimed: false,
      },
      {
        transactionId: 'txn-004',
        date: '2025-12-20T10:00:00Z',
        competitionId: 4,
        competitionName: 'Holiday Dressage Cup',
        horseId: 1,
        horseName: 'Thunder',
        discipline: 'dressage',
        placement: 1,
        prizeMoney: 2000,
        xpGained: 125,
        claimed: true,
        claimedAt: '2025-12-20T14:00:00Z',
      },
    ];

    // Apply filters
    if (horseId) {
      prizeHistory = prizeHistory.filter((p) => p.horseId === Number(horseId));
    }
    if (discipline) {
      prizeHistory = prizeHistory.filter((p) => p.discipline === discipline);
    }
    if (dateRange && dateRange !== 'all') {
      const now = new Date('2026-03-20');
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      prizeHistory = prizeHistory.filter((p) => new Date(p.date) >= cutoff);
    }

    return HttpResponse.json({
      success: true,
      data: prizeHistory,
    });
  }),

  // Prize System - Horse Prize Summary
  http.get(`${base}/api/v1/horses/:horseId/prize-summary`, ({ params }) => {
    const horseId = Number(params.horseId);

    // Return 404 for horse ID 999 (error test case)
    if (horseId === 999) {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }

    // Return empty summary for horse ID 888 (new horse)
    if (horseId === 888) {
      return HttpResponse.json({
        success: true,
        data: {
          horseId,
          horseName: 'New Horse',
          totalCompetitions: 0,
          totalPrizeMoney: 0,
          totalXpGained: 0,
          firstPlaces: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          unclaimedPrizes: 0,
          recentPrizes: [],
        },
      });
    }

    return HttpResponse.json({
      success: true,
      data: {
        horseId,
        horseName: 'Thunder',
        totalCompetitions: 15,
        totalPrizeMoney: 12500,
        totalXpGained: 950,
        firstPlaces: 5,
        secondPlaces: 4,
        thirdPlaces: 3,
        unclaimedPrizes: 1,
        recentPrizes: [
          {
            transactionId: 'txn-001',
            date: '2026-03-15T10:00:00Z',
            competitionId: 1,
            competitionName: 'Spring Dressage Championship',
            horseId,
            horseName: 'Thunder',
            discipline: 'dressage',
            placement: 1,
            prizeMoney: 2500,
            xpGained: 150,
            claimed: true,
            claimedAt: '2026-03-15T12:00:00Z',
          },
          {
            transactionId: 'txn-003',
            date: '2026-01-25T09:00:00Z',
            competitionId: 3,
            competitionName: 'Regional Eventing Finals',
            horseId,
            horseName: 'Thunder',
            discipline: 'eventing',
            placement: 3,
            prizeMoney: 1000,
            xpGained: 75,
            claimed: false,
          },
        ],
      },
    });
  }),

  // (Equoria-0fw18) Deleted dead /api/horses/:horseId/level-info handler — no
  // api-client call (horses.ts exposes getXP/getXPHistory, not level-info) and
  // no test referenced it.

  // XP System - Horse XP History
  http.get(`${base}/api/v1/horses/:horseId/xp-history`, ({ params, request }) => {
    const horseId = Number(params.horseId);
    const url = new URL(request.url);
    url.searchParams.get('dateRange'); // read but not filtered — all dates returned
    const source = url.searchParams.get('source');

    // Return 404 for horse ID 999 (error test case)
    if (horseId === 999) {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }

    let history = [
      {
        xpGainId: 'xp-1',
        horseId,
        horseName: 'Test Horse',
        source: 'competition',
        sourceId: 123,
        sourceName: 'Show Jumping Classic',
        xpAmount: 50,
        timestamp: '2026-03-15T10:00:00Z',
        oldLevel: 4,
        newLevel: 5,
        oldXp: 400,
        newXp: 450,
        leveledUp: true,
      },
      {
        xpGainId: 'xp-2',
        horseId,
        horseName: 'Test Horse',
        source: 'training',
        sourceId: 456,
        sourceName: 'Dressage Training',
        xpAmount: 25,
        timestamp: '2026-03-10T14:00:00Z',
        oldLevel: 4,
        newLevel: 4,
        oldXp: 375,
        newXp: 400,
        leveledUp: false,
      },
    ];

    // Apply source filter
    if (source) {
      history = history.filter((h) => h.source === source);
    }

    return HttpResponse.json({
      success: true,
      data: history,
    });
  }),

  // (Equoria-0fw18) Deleted dead /api/horses/add-xp handler — no api-client
  // call and no test referenced it (manual XP-add is a backend-only/admin path,
  // not exposed in the frontend client).

  // Prize System - Claim Competition Prizes
  // NOTE: the real client posts to the SINGULAR /api/v1/competition/:id/claim-prizes
  // (frontend/src/lib/api/prizes.ts), NOT the plural /competitions/. Versioned to match.
  http.post(`${base}/api/v1/competition/:competitionId/claim-prizes`, ({ params }) => {
    const competitionId = Number(params.competitionId);

    // Return 404 for competition ID 999 (not found)
    if (competitionId === 999) {
      return HttpResponse.json(
        { status: 'error', message: 'Competition not found' },
        { status: 404 }
      );
    }

    // Return 400 for competition ID 888 (already claimed)
    if (competitionId === 888) {
      return HttpResponse.json(
        { status: 'error', message: 'Prizes already claimed' },
        { status: 400 }
      );
    }

    // Return 403 for competition ID 777 (no prizes to claim)
    if (competitionId === 777) {
      return HttpResponse.json(
        { status: 'error', message: 'No prizes available to claim' },
        { status: 403 }
      );
    }

    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        prizesClaimed: [
          {
            horseId: 1,
            horseName: 'Thunder',
            competitionId,
            competitionName: 'Spring Dressage Championship',
            discipline: 'dressage',
            date: '2026-03-15T10:00:00Z',
            placement: 1,
            totalParticipants: 12,
            prizeMoney: 2500,
            xpGained: 150,
            claimed: true,
            claimedAt: new Date().toISOString(),
          },
        ],
        newBalance: 10500,
        message: 'Successfully claimed 1 prize totaling $2500',
      },
    });
  }),
];
