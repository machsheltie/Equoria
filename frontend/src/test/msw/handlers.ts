import { http, HttpResponse } from 'msw';

const base = 'http://localhost:3001';

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
      success: true,
      data: {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
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
        { id: 1, name: 'Storm Runner', breed: 'Thoroughbred', gender: 'stallion' },
        { id: 2, name: 'Midnight Dream', breed: 'Arabian', gender: 'mare' },
      ],
    })
  ),
  http.get(`${base}/api/horses/:id/training-history`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 101, discipline: 'dressage', score: 40, trainedAt: '2025-12-01T00:00:00Z' },
        { id: 102, discipline: 'racing', score: 55, trainedAt: '2025-12-02T00:00:00Z' },
      ],
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
      data: [],
    })
  ),
  http.get(`${base}/api/groom-assignments`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
  http.get(`${base}/api/groom-salaries/summary`, () =>
    HttpResponse.json({
      success: true,
      data: {
        totalMonthlyCost: 0,
        totalWeeklyCost: 0,
        groomCount: 0,
        breakdown: [],
      },
    })
  ),

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
      data: [],
    })
  ),

  // Competition System
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
];
