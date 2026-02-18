import { http, HttpResponse } from 'msw';
import {
  getLeaderboardEntries,
  getUserRankSummary,
  VALID_CATEGORIES,
} from '../fixtures/leaderboards';
import type { LeaderboardCategory } from '@/components/leaderboard/LeaderboardCategorySelector';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const handlers = [
  // Auth login/register/logout
  http.post(`${base}/api/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email?: string; password?: string };

    if (!email || !password || password === 'wrong' || email.includes('invalid')) {
      return HttpResponse.json(
        { status: 'error', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (password === 'rate-limit') {
      return HttpResponse.json(
        { status: 'error', message: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    return HttpResponse.json({
      status: 'success',
      data: {
        user: {
          id: 1,
          username: 'testuser',
          email,
          firstName: 'Test',
          lastName: 'User',
          money: 1000,
          level: 1,
          xp: 0,
        },
      },
    });
  }),
  http.post(`${base}/api/auth/register`, async ({ request }) => {
    const { email, username, password } = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
    };

    if (!email || !username || !password) {
      return HttpResponse.json(
        { status: 'error', message: 'Missing required fields' },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        status: 'success',
        data: {
          user: {
            id: 2,
            username,
            email,
            money: 500,
            level: 1,
            xp: 0,
          },
        },
      },
      { status: 201 }
    );
  }),
  http.post(`${base}/api/auth/logout`, () =>
    HttpResponse.json({ status: 'success', message: 'Logged out' })
  ),
  http.post(`${base}/api/auth/refresh-token`, () =>
    HttpResponse.json({ status: 'success', message: 'Token refreshed' })
  ),

  // Auth profile
  http.get(`${base}/api/auth/profile`, () =>
    HttpResponse.json({
      status: 'success',
      data: {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'user',
        },
      },
    })
  ),
  http.get(`${base}/api/auth/me`, () =>
    HttpResponse.json({
      status: 'success',
      data: {
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
      },
    })
  ),
  http.post(`${base}/api/auth/forgot-password`, async ({ request }) => {
    const { email } = (await request.json()) as { email?: string };
    if (!email) {
      return HttpResponse.json({ status: 'error', message: 'Email is required' }, { status: 400 });
    }
    return HttpResponse.json({ status: 'success', message: 'Reset email sent' });
  }),
  http.post(`${base}/api/auth/reset-password`, async ({ request }) => {
    const { token, newPassword } = (await request.json()) as {
      token?: string;
      newPassword?: string;
    };
    if (!token || !newPassword) {
      return HttpResponse.json(
        { status: 'error', message: 'Invalid reset request' },
        { status: 400 }
      );
    }
    return HttpResponse.json({ status: 'success', message: 'Password reset successful' });
  }),

  // Training eligibility/status
  http.post(`${base}/api/training/check-eligibility`, () =>
    HttpResponse.json({ success: true, data: { eligible: true, reason: null } })
  ),
  http.post(`${base}/api/training/train`, async ({ request }) => {
    const body = (await request.json()) as { horseId: number; discipline: string };
    return HttpResponse.json({
      success: true,
      data: {
        updatedScore: 50,
        nextEligibleDate: '2025-12-10T00:00:00Z',
        discipline: body.discipline,
        horseId: body.horseId,
        message: 'Training completed successfully',
      },
    });
  }),
  http.get(`${base}/api/training/status/:horseId/:discipline`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        discipline: params.discipline,
        score: 42,
        nextEligibleDate: null,
        lastTrainedAt: '2025-12-01T00:00:00Z',
      },
    })
  ),
  http.get(`${base}/api/training/status/:horseId`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { discipline: 'dressage', score: 42, nextEligibleDate: null },
        { discipline: 'racing', score: 55, nextEligibleDate: '2025-12-10T00:00:00Z' },
      ],
    })
  ),
  http.get(`${base}/api/training/trainable/:userId`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          name: 'Storm Runner',
          bestDisciplines: ['racing', 'eventing'],
          level: 15,
          nextEligibleAt: null,
          breed: 'Thoroughbred',
          userId: params.userId,
        },
      ],
    })
  ),

  // Horses
  http.get(`${base}/api/horses`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          name: 'Storm Runner',
          breed: 'Thoroughbred',
          gender: 'stallion',
          age: 5,
          dateOfBirth: '2020-01-01T00:00:00Z',
          healthStatus: 'Good',
          imageUrl: undefined,
          stats: {
            speed: 75,
            stamina: 70,
            agility: 65,
            strength: 60,
            intelligence: 55,
            health: 80,
          },
          disciplineScores: { dressage: 45, show_jumping: 55 },
          traits: ['Bold', 'Athletic'],
          description: 'A spirited thoroughbred with excellent racing potential.',
          parentIds: { sireId: 10, damId: 11 },
        },
        {
          id: 2,
          name: 'Midnight Dream',
          breed: 'Arabian',
          gender: 'mare',
          age: 4,
          dateOfBirth: '2021-03-15T00:00:00Z',
          healthStatus: 'Excellent',
          imageUrl: undefined,
          stats: {
            speed: 80,
            stamina: 75,
            agility: 85,
            strength: 55,
            intelligence: 90,
            health: 85,
          },
          disciplineScores: { dressage: 65, endurance: 70 },
          traits: ['Intelligent', 'Agile'],
          description: 'An elegant Arabian with exceptional endurance.',
          parentIds: {},
        },
      ],
    })
  ),
  // Single horse detail (used by useHorse hook → HorseDetailPage)
  http.get(`${base}/api/horses/:id`, ({ params }) => {
    if (params.id === '999') {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        name: 'Storm Runner',
        breed: 'Thoroughbred',
        gender: 'stallion',
        age: 5,
        dateOfBirth: '2020-01-01T00:00:00Z',
        healthStatus: 'Good',
        imageUrl: undefined,
        stats: { speed: 75, stamina: 70, agility: 65, strength: 60, intelligence: 55, health: 80 },
        disciplineScores: { dressage: 45, show_jumping: 55 },
        traits: ['Bold', 'Athletic'],
        description: 'A spirited thoroughbred with excellent racing potential.',
        parentIds: { sireId: 10, damId: 11 },
      },
    });
  }),
  http.get(`${base}/api/horses/:id/training-history`, () =>
    HttpResponse.json({
      success: true,
      data: {
        trainingHistory: [
          { id: 101, discipline: 'dressage', score: 40, trainedAt: '2025-12-01T00:00:00Z' },
          { id: 102, discipline: 'racing', score: 55, trainedAt: '2025-12-02T00:00:00Z' },
        ],
        disciplineBalance: {},
        trainingFrequency: {},
      },
    })
  ),

  // Breeding / foals
  http.post(`${base}/api/foals/breeding/breed`, () =>
    HttpResponse.json({
      success: true,
      data: { foalId: 10, message: 'Foal created' },
    })
  ),
  http.get(`${base}/api/foals/:id`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        name: 'Foal Example',
        sireId: 1,
        damId: 2,
        ageDays: 12,
        traits: ['bold', 'focused'],
      },
    })
  ),
  http.get(`${base}/api/foals/:id/development`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        stage: 'Neonate',
        progress: 20,
        bonding: 50,
        stress: 10,
        enrichmentLevel: 5,
        foalId: Number(params.id),
      },
    })
  ),
  http.get(`${base}/api/foals/:id/activities`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 1, activity: 'trust_building', duration: 30, createdAt: '2025-12-02T00:00:00Z' },
      ],
    })
  ),
  http.post(`${base}/api/foals/:id/activity`, async ({ request, params }) => {
    const body = (await request.json()) as { activityType?: string; activity?: string };
    return HttpResponse.json({
      success: true,
      data: {
        id: 2,
        activity: body.activityType ?? body.activity ?? 'activity',
        foalId: params.id,
      },
    });
  }),
  http.post(`${base}/api/foals/:id/enrich`, async ({ request, params }) => {
    const body = (await request.json()) as { activity?: string };
    return HttpResponse.json({
      success: true,
      data: { id: 3, activity: body.activity ?? 'enrichment', foalId: params.id },
    });
  }),
  http.post(`${base}/api/foals/:id/reveal-traits`, () =>
    HttpResponse.json({ success: true, data: { traits: ['brave', 'athletic'] } })
  ),
  http.put(`${base}/api/foals/:id/develop`, async ({ request, params }) => {
    const updates = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { foalId: Number(params.id), ...updates },
    });
  }),

  // Groom Management
  http.get(`${base}/api/grooms/user/:userId`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 10,
          name: 'Alice Thornton',
          skillLevel: 'Expert',
          specialty: 'Dressage',
          personality: 'Calm',
          experience: 8,
          sessionRate: 150,
          isActive: true,
          availableSlots: 2,
          currentAssignments: 1,
          maxAssignments: 3,
        },
      ],
    })
  ),
  http.get(`${base}/api/groom-assignments`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          groomId: 10,
          horseId: 1,
          priority: 1,
          isActive: true,
          startDate: '2026-01-01T00:00:00Z',
        },
      ],
    })
  ),
  http.get(`${base}/api/groom-salaries/summary`, () =>
    HttpResponse.json({
      success: true,
      data: {
        totalMonthlyCost: 600,
        totalWeeklyCost: 150,
        groomCount: 1,
        breakdown: [
          { groomId: 10, groomName: 'Alice Thornton', weeklyCost: 150, assignmentCount: 1 },
        ],
      },
    })
  ),
  http.post(`${base}/api/groom-marketplace/hire`, () =>
    HttpResponse.json({
      success: true,
      data: {
        groom: {
          id: 10,
          name: 'Alice Thornton',
          skillLevel: 'Expert',
          specialty: 'Dressage',
          personality: 'Calm',
          experience: 8,
          sessionRate: 150,
          isActive: true,
          availableSlots: 2,
          currentAssignments: 1,
          maxAssignments: 3,
        },
        cost: 150,
        remainingMoney: 4850,
      },
    })
  ),
  http.post(`${base}/api/groom-marketplace/refresh`, () =>
    HttpResponse.json({
      success: true,
      data: {
        grooms: [
          {
            marketplaceId: 'mp-001',
            firstName: 'Alice',
            lastName: 'Thornton',
            specialty: 'Dressage',
            skillLevel: 'Expert',
            personality: 'Calm',
            experience: 8,
            sessionRate: 150,
            bio: 'Experienced dressage specialist.',
            availability: true,
          },
          {
            marketplaceId: 'mp-002',
            firstName: 'Ben',
            lastName: 'Marsh',
            specialty: 'Show Jumping',
            skillLevel: 'Intermediate',
            personality: 'Energetic',
            experience: 4,
            sessionRate: 100,
            bio: 'Show jumping enthusiast.',
            availability: true,
          },
        ],
        lastRefresh: '2026-02-25T00:00:00Z',
        nextFreeRefresh: '2026-03-04T00:00:00Z',
        refreshCost: 500,
        canRefreshFree: true,
        refreshCount: 4,
      },
    })
  ),
  http.post(`${base}/api/groom-assignments`, () => HttpResponse.json({ success: true })),

  // Auth Status
  http.get(`${base}/api/auth/verification-status`, () =>
    HttpResponse.json({
      success: true,
      data: {
        isEmailVerified: true,
        email: 'test@example.com',
      },
    })
  ),

  // User Dashboard & Progress
  http.get(`${base}/api/users/:id/progress`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        userId: params.id,
        username: 'testuser',
        level: 1,
        xp: 50,
        xpToNextLevel: 50,
        xpForNextLevel: 100,
        xpForCurrentLevel: 0,
        progressPercentage: 50,
        totalEarnings: 1000,
      },
    });
  }),
  http.get(`${base}/api/users/dashboard/:id`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: params.id,
          username: 'testuser',
          level: 1,
          xp: 50,
          money: 1000,
        },
        horses: { total: 2, trainable: 1 },
        shows: { upcomingEntries: 0, nextShowRuns: [] },
        activity: { lastTrained: 'never', lastShowPlaced: 'never' },
      },
    });
  }),
  http.get(`${base}/api/users/:id/activity`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
  // User profile (used by useUser hook) — MUST be after all /users/:id/* sub-routes
  http.get(`${base}/api/users/:id`, ({ params }) => {
    if (params.id === '999999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        id: params.id,
        username: 'testuser',
        money: 1000,
        level: 1,
        currentHorses: 2,
        stableLimit: 10,
      },
    });
  }),

  // Advanced Horse Analysis
  http.get(`${base}/api/horses/:id/environmental-analysis`, () =>
    HttpResponse.json({
      success: true,
      data: {
        factors: [],
        summary: 'Normal environment',
      },
    })
  ),
  http.get(`${base}/api/horses/:id/trait-interactions`, () =>
    HttpResponse.json({
      success: true,
      data: {
        interactions: [],
      },
    })
  ),
  http.get(`${base}/api/horses/:id/developmental-timeline`, () =>
    HttpResponse.json({
      success: true,
      data: {
        milestones: [],
      },
    })
  ),
  http.get(`${base}/api/horses/:id/forecast`, () =>
    HttpResponse.json({
      success: true,
      data: {
        forecasts: [],
      },
    })
  ),

  // Marketplace
  http.get(`${base}/api/groom-marketplace`, () =>
    HttpResponse.json({
      success: true,
      data: {
        grooms: [
          {
            marketplaceId: 'mp-001',
            firstName: 'Alice',
            lastName: 'Thornton',
            specialty: 'Dressage',
            skillLevel: 'Expert',
            personality: 'Calm',
            experience: 8,
            sessionRate: 150,
            bio: 'Experienced dressage specialist.',
            availability: true,
          },
          {
            marketplaceId: 'mp-002',
            firstName: 'Ben',
            lastName: 'Marsh',
            specialty: 'Show Jumping',
            skillLevel: 'Intermediate',
            personality: 'Energetic',
            experience: 4,
            sessionRate: 100,
            bio: 'Show jumping enthusiast.',
            availability: true,
          },
        ],
        lastRefresh: '2026-02-18T00:00:00Z',
        nextFreeRefresh: '2026-02-25T00:00:00Z',
        refreshCost: 500,
        canRefreshFree: false,
        refreshCount: 3,
      },
    })
  ),

  // Competition System - Filtered List
  http.get(`${base}/api/competitions`, ({ request }) => {
    const url = new URL(request.url);
    const discipline = url.searchParams.get('discipline');

    const competitions = [
      {
        id: 1,
        name: 'Spring Dressage Championship',
        discipline: 'dressage',
        date: '2026-03-15T10:00:00Z',
        entryFee: 50,
        maxEntries: 20,
        currentEntries: 12,
        status: 'open',
        prizePool: 5000,
        location: 'Central Arena',
      },
      {
        id: 2,
        name: 'Weekly Jumping Series',
        discipline: 'jumping',
        date: '2026-02-10T14:00:00Z',
        entryFee: 25,
        maxEntries: 30,
        currentEntries: 28,
        status: 'open',
        prizePool: 2500,
      },
      {
        id: 3,
        name: 'Free Training Show',
        discipline: 'eventing',
        date: '2026-02-05T09:00:00Z',
        entryFee: 0,
        maxEntries: 50,
        currentEntries: 15,
        status: 'open',
      },
    ];

    const filtered = discipline
      ? competitions.filter((c) => c.discipline === discipline)
      : competitions;

    return HttpResponse.json({
      success: true,
      data: filtered,
    });
  }),

  // Competition System - Single Competition Details
  http.get(`${base}/api/competitions/:id`, ({ params }) => {
    const id = Number(params.id);
    if (id === 999) {
      return HttpResponse.json(
        { status: 'error', message: 'Competition not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        id,
        name: 'Spring Dressage Championship',
        description: 'Annual spring dressage competition',
        discipline: 'dressage',
        date: '2026-03-15T10:00:00Z',
        location: 'Central Arena',
        prizePool: 5000,
        entryFee: 50,
        maxEntries: 20,
        currentEntries: 12,
        status: 'open',
        requirements: {
          minAge: 3,
          maxAge: 15,
          minLevel: 5,
          requiredTraits: ['balanced', 'focused'],
        },
      },
    });
  }),

  // Competition System - Horse Eligibility
  http.get(`${base}/api/competitions/:compId/eligibility/:userId`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          name: 'Thunder',
          breed: 'Thoroughbred',
          age: 5,
          level: 8,
          healthStatus: 'healthy',
          isEligible: true,
          eligibilityReasons: [],
          alreadyEntered: false,
        },
        {
          id: 2,
          name: 'Storm',
          breed: 'Arabian',
          age: 2,
          level: 3,
          healthStatus: 'healthy',
          isEligible: false,
          eligibilityReasons: ['Horse does not meet minimum age requirement (3 years)'],
          alreadyEntered: false,
        },
      ],
    });
  }),

  // Competition System - Enter Competition
  http.post(`${base}/api/competitions/enter`, async ({ request }) => {
    const body = (await request.json()) as { competitionId: number; horseIds: number[] };
    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        entryIds: body.horseIds.map((_, i) => 100 + i),
        totalCost: body.horseIds.length * 50,
        message: `Successfully entered ${body.horseIds.length} horses into the competition`,
      },
    });
  }),

  // Competition System - Entries (legacy)
  http.get(`${base}/api/competitions/:id/entries`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
  http.get(`${base}/api/horses/user/eligible`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),

  // Competition Results System - Competition Results
  http.get(`${base}/api/competitions/:id/results`, ({ params }) => {
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
  http.get(`${base}/api/horses/:id/competition-history`, ({ params }) => {
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
  http.get(`${base}/api/users/:id/competition-stats`, ({ params }) => {
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

  // Prize System - User Prize History
  http.get(`${base}/api/users/:userId/prize-history`, ({ params, request }) => {
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
  http.get(`${base}/api/horses/:horseId/prize-summary`, ({ params }) => {
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

  // XP System - Horse Level Info
  http.get(`${base}/api/horses/:horseId/level-info`, ({ params }) => {
    const horseId = Number(params.horseId);

    // Return 404 for horse ID 999 (error test case)
    if (horseId === 999) {
      return HttpResponse.json({ status: 'error', message: 'Horse not found' }, { status: 404 });
    }

    return HttpResponse.json({
      success: true,
      data: {
        horseId,
        horseName: 'Test Horse',
        currentLevel: 5,
        currentXp: 450,
        xpForCurrentLevel: 45,
        xpToNextLevel: 100,
        totalXp: 450,
        progressPercent: 45,
        levelThresholds: { 1: 0, 2: 100, 3: 300, 4: 600, 5: 1000 },
      },
    });
  }),

  // XP System - Horse XP History
  http.get(`${base}/api/horses/:horseId/xp-history`, ({ params, request }) => {
    const horseId = Number(params.horseId);
    const url = new URL(request.url);
    const __dateRange = url.searchParams.get('dateRange');
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

  // XP System - Add XP
  http.post(`${base}/api/horses/add-xp`, async ({ request }) => {
    const body = (await request.json()) as {
      horseId: number;
      xpAmount: number;
      source: string;
      sourceId: number;
      sourceName: string;
    };

    // Return 400 for invalid horse ID
    if (!body.horseId || body.horseId <= 0) {
      return HttpResponse.json({ status: 'error', message: 'Invalid horse ID' }, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
      data: {
        success: true,
        xpGain: {
          xpGainId: 'xp-new',
          horseId: body.horseId,
          horseName: 'Test Horse',
          source: body.source,
          sourceId: body.sourceId,
          sourceName: body.sourceName,
          xpAmount: body.xpAmount,
          timestamp: new Date().toISOString(),
          oldLevel: 5,
          newLevel: 6,
          oldXp: 450,
          newXp: 500,
          leveledUp: true,
        },
        leveledUp: true,
        newLevel: 6,
        message: 'XP added successfully',
      },
    });
  }),

  // Prize System - Claim Competition Prizes
  http.post(`${base}/api/competitions/:competitionId/claim-prizes`, ({ params }) => {
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

  // Leaderboard System - User Rank Summary
  // NOTE: This handler MUST appear before the :category handler so that
  // "user-summary" is not captured as a category parameter.
  http.get(`${base}/api/leaderboards/user-summary/:userId`, ({ params }) => {
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
  http.get(`${base}/api/leaderboards/:category`, ({ params, request }) => {
    const category = params.category as string;
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'all-time';
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
    const entries = allEntries.slice(startIdx, endIdx);

    // Find user's rank
    const userEntry = allEntries.find((e) => e.isCurrentUser);
    const userRank = userEntry ? { rank: userEntry.rank, entry: userEntry } : undefined;

    return HttpResponse.json({
      success: true,
      data: {
        category,
        period,
        totalEntries,
        currentPage: page,
        totalPages,
        entries,
        userRank,
        lastUpdated: new Date().toISOString(),
      },
    });
  }),
];
