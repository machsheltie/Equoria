import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Trailing v1 mirror handlers — registered LAST in the exported `handlers`
 * array (after clubs). Covers: training status/trainable, grooms-by-user,
 * foal detail/development/activities/enrich/reveal-traits, and breeding
 * prediction (breeding-data, lineage-analysis). First-match-wins order
 * preserved.
 */
export const v1TrailingMirrorHandlers = [
  // ── v1 Training status / trainable mirrors ─────────────────────────────────
  // useTrainingOverview calls /api/v1/training/status/:horseId
  // useTrainingStatus calls /api/v1/training/status/:horseId/:discipline
  // useTrainableHorses calls /api/v1/training/trainable/:userId
  http.get(`${base}/api/v1/training/status/:horseId/:discipline`, ({ params }) =>
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
  http.get(`${base}/api/v1/training/status/:horseId`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { discipline: 'dressage', score: 42, nextEligibleDate: null },
        { discipline: 'racing', score: 55, nextEligibleDate: '2025-12-10T00:00:00Z' },
      ],
    })
  ),
  http.get(`${base}/api/v1/training/trainable/:userId`, ({ params }) =>
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

  // ── v1 Grooms user mirror ──────────────────────────────────────────────────
  // useUserGrooms calls /api/v1/grooms/user/:userId
  http.get(`${base}/api/v1/grooms/user/:userId`, () =>
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

  // ── v1 Foal mirrors ────────────────────────────────────────────────────────
  // useFoal calls /api/v1/foals/:id
  // useFoalDevelopment calls /api/v1/foals/:id/development
  // useFoalActivities calls /api/v1/foals/:id/activities
  // useEnrichFoal calls POST /api/v1/foals/:id/enrich
  // useRevealFoalTraits calls POST /api/v1/foals/:id/reveal-traits
  http.get(`${base}/api/v1/foals/:id`, ({ params }) =>
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
  http.get(`${base}/api/v1/foals/:id/development`, () =>
    // Equoria-n3yw6: real backend envelope — nested `data.development`.
    HttpResponse.json({
      success: true,
      data: {
        foal: { id: 1, name: 'TestFixture-Foal', age: 0, breed: 'X', owner: 'Y' },
        development: {
          currentDay: 1,
          bondingLevel: 50,
          stressLevel: 10,
          completedActivities: {},
          maxDay: 6,
          enrichmentDay: 1,
          enrichmentWindowOpen: true,
        },
        availableEnrichmentActivities: [
          { type: 'gentle_touch', name: 'Gentle Touch' },
          { type: 'soft_voice', name: 'Soft Voice' },
        ],
        activityHistory: [],
        availableActivities: [],
      },
    })
  ),
  http.get(`${base}/api/v1/foals/:id/activities`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { id: 1, activity: 'trust_building', duration: 30, createdAt: '2025-12-02T00:00:00Z' },
      ],
    })
  ),
  http.post(`${base}/api/v1/foals/:id/enrich`, async ({ request, params }) => {
    const body = (await request.json()) as { activity?: string };
    return HttpResponse.json({
      success: true,
      data: { id: 3, activity: body.activity ?? 'enrichment', foalId: params.id },
    });
  }),
  http.post(`${base}/api/v1/foals/:id/reveal-traits`, () =>
    HttpResponse.json({ success: true, data: { traits: ['brave', 'athletic'] } })
  ),

  // ── v1 Breeding prediction mirrors ────────────────────────────────────────
  // useHorseBreedingData calls /api/v1/horses/:id/breeding-data
  // useLineageAnalysis calls /api/v1/breeding/lineage-analysis/:stallionId/:mareId
  http.get(`${base}/api/v1/horses/:id/breeding-data`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        horseId: Number(params.id),
        breedingHistory: [],
        offspringCount: 0,
        lastBreedingDate: null,
        breedingCooldownEnd: null,
      },
    })
  ),
  http.get(`${base}/api/v1/breeding/lineage-analysis/:stallionId/:mareId`, () =>
    // Real backend shape (Equoria-qfdf9) — mirrors the unversioned handler.
    HttpResponse.json({
      success: true,
      data: {
        lineageTree: { root: { stallion: null, mare: null } },
        diversityMetrics: {},
        performanceAnalysis: {},
        visualizationData: {},
      },
    })
  ),
];
