import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Horse list / detail / training-history handlers.
 * Registered after auth, before breeding. First-match-wins order preserved.
 */
export const horseHandlers = [
  // (Equoria-0fw18) Deleted dead unversioned training handlers
  // (/api/training/check-eligibility, /train, /status/:horseId[/:discipline],
  // /trainable/:userId). The real client calls /api/v1/training/... which the
  // v1 mirrors below serve; the unversioned twins never matched a request.

  // Horses
  // (Equoria-0fw18) Deleted dead unversioned /api/horses (list) and
  // /api/horses/:id (detail) handlers — the v1 mirrors below serve the real
  // horsesApi.list / horsesApi.get calls (/api/v1/horses[?t=], /api/v1/horses/:id[?t=]).
  // v1 horse list (horsesApi.list → GET /api/v1/horses?t=<timestamp>)
  http.get(`${base}/api/v1/horses`, () =>
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
  // v1 mirror for horse detail (horsesApi.get → GET /api/v1/horses/:id?t=<timestamp>)
  http.get(`${base}/api/v1/horses/:id`, ({ params }) => {
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
  // (Equoria-0fw18) Deleted dead unversioned /api/horses/:id/training-history —
  // v1 mirror below serves horsesApi.getTrainingHistory.
  // v1 training-history (horsesApi.getTrainingHistory → GET /api/v1/horses/:id/training-history)
  http.get(`${base}/api/v1/horses/:id/training-history`, () =>
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
];
