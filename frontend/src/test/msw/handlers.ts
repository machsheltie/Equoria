import { http, HttpResponse } from 'msw';

const base = 'http://localhost:3001';

export const handlers = [
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
    }),
  ),

  // Training eligibility/status
  http.post(`${base}/api/training/check-eligibility`, () =>
    HttpResponse.json({ success: true, data: { eligible: true, reason: null } }),
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
    }),
  ),
  http.get(`${base}/api/training/status/:horseId`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { discipline: 'dressage', score: 42, nextEligibleDate: null },
        { discipline: 'racing', score: 55, nextEligibleDate: '2025-12-10T00:00:00Z' },
      ],
    }),
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
    }),
  ),

  // Horses
  http.get(`${base}/api/horses`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 1, name: 'Storm Runner', breed: 'Thoroughbred', gender: 'stallion' },
        { id: 2, name: 'Midnight Dream', breed: 'Arabian', gender: 'mare' },
      ],
    }),
  ),
  http.get(`${base}/api/horses/:id/training-history`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 101, discipline: 'dressage', score: 40, trainedAt: '2025-12-01T00:00:00Z' },
        { id: 102, discipline: 'racing', score: 55, trainedAt: '2025-12-02T00:00:00Z' },
      ],
    }),
  ),

  // Breeding / foals
  http.post(`${base}/api/foals/breeding/breed`, () =>
    HttpResponse.json({
      success: true,
      data: { foalId: 10, message: 'Foal created' },
    }),
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
    }),
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
    }),
  ),
  http.get(`${base}/api/foals/:id/activities`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 1, activity: 'trust_building', duration: 30, createdAt: '2025-12-02T00:00:00Z' },
      ],
    }),
  ),
  http.post(`${base}/api/foals/:id/activity`, async ({ request, params }) => {
    const body = (await request.json()) as { activityType?: string; activity?: string };
    return HttpResponse.json({
      success: true,
      data: { id: 2, activity: body.activityType ?? body.activity ?? 'activity', foalId: params.id },
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
    HttpResponse.json({ success: true, data: { traits: ['brave', 'athletic'] } }),
  ),
  http.put(`${base}/api/foals/:id/develop`, async ({ request, params }) => {
    const updates = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      success: true,
      data: { foalId: Number(params.id), ...updates },
    });
  }),
];
