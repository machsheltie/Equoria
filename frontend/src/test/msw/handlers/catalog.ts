import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Misc catalog / dashboard handlers: breeds, marketplace store buy, next-actions,
 * while-you-were-gone, conformation scores + breed conformation averages.
 * Registered after leaderboards, before the v1-mirror block.
 * First-match-wins order preserved.
 */
export const catalogHandlers = [
  // ── Breeds ──────────────────────────────────────────────────────────────────
  http.get(`${base}/api/v1/breeds`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        { id: 1, name: 'Thoroughbred', description: 'A fast breed' },
        { id: 2, name: 'Arabian', description: 'An endurance breed' },
        { id: 3, name: 'Warmblood', description: 'A dressage breed' },
        // Equoria-x83v4: a post-import breed that carries real rating_profiles.
        // The GET /api/v1/breeds controller trims breedGeneticProfile to ONLY
        // rating_profiles (Equoria-refgs), which is exactly what useBreeds reads
        // to derive statTendencies — so this mock mirrors the real trimmed shape.
        // Shire is NOT in the hand-authored BREED_PRESETS map — exercising the
        // ~300-breed derivation path against the real (trimmed) data shape.
        {
          id: 99,
          name: 'Shire',
          description: 'A heavy draft breed',
          breedGeneticProfile: {
            rating_profiles: {
              conformation: {
                head: { mean: 70, std_dev: 6 },
                neck: { mean: 72, std_dev: 6 },
                shoulders: { mean: 74, std_dev: 7 },
                back: { mean: 78, std_dev: 5 },
                hindquarters: { mean: 82, std_dev: 5 },
                legs: { mean: 80, std_dev: 6 },
                hooves: { mean: 80, std_dev: 6 },
                topline: { mean: 76, std_dev: 6 },
              },
              gaits: {
                walk: { mean: 70, std_dev: 8 },
                trot: { mean: 62, std_dev: 9 },
                canter: { mean: 58, std_dev: 9 },
                gallop: { mean: 50, std_dev: 9 },
                gaiting: null,
              },
              is_gaited_breed: false,
              gaited_gait_registry: null,
            },
          },
        },
      ],
      count: 4,
    });
  }),

  // ── Marketplace: Horse Trader store purchase (Equoria-m1ck) ────────────────
  // POST /api/v1/marketplace/store/buy — buy a 3-year-old store horse.
  // Default handler returns the success envelope. Tests that need to exercise
  // the 400 insufficient-funds path should override with `server.use(...)` in
  // the test itself (see HorseTraderPage.test.tsx for the error variant).
  http.post(`${base}/api/v1/marketplace/store/buy`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      breedId?: number;
      sex?: 'Mare' | 'Stallion';
    };
    return HttpResponse.json({
      success: true,
      data: {
        horse: {
          id: 9001,
          name: `${body.sex ?? 'Mare'} of Breed ${body.breedId ?? 1}`,
          breedId: body.breedId ?? 1,
          sex: body.sex ?? 'Mare',
          age: 3,
        },
        pricePaid: 1000,
        newBalance: 4000,
      },
    });
  }),

  // ── Next Actions ────────────────────────────────────────────────────────────
  http.get(`${base}/api/v1/next-actions`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        actions: [
          { type: 'train', priority: 1, horseId: 1, horseName: 'Thunder' },
          { type: 'compete', priority: 2, horseId: 2, horseName: 'Lightning' },
          { type: 'claim-prize', priority: 3 },
        ],
      },
    });
  }),

  // ── While You Were Gone ─────────────────────────────────────────────────────
  http.get(`${base}/api/v1/while-you-were-gone`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          {
            type: 'competition-result',
            priority: 1,
            title: 'Thunder won 1st place!',
            description: 'Dressage Grand Prix',
            timestamp: new Date().toISOString(),
            actionUrl: '/competitions/1',
          },
        ],
        since: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        hasMore: false,
      },
    });
  }),

  // ── Conformation ──────────────────────────────────────────────────────────
  // GET /api/v1/horses/:horseId/conformation
  http.get(`${base}/api/v1/horses/:horseId/conformation`, ({ params }) => {
    const horseId = parseInt(params.horseId as string) || 0;
    const seed = horseId % 20;
    const head = 70 + seed;
    const neck = 68 + seed;
    const shoulders = 72 + seed;
    const back = 65 + seed;
    const hindquarters = 75 + seed;
    const legs = 71 + seed;
    const hooves = 69 + seed;
    const topline = 67 + seed;
    const overallConformation =
      Math.round(
        ((head + neck + shoulders + back + hindquarters + legs + hooves + topline) / 8) * 10
      ) / 10;
    return HttpResponse.json({
      success: true,
      data: {
        horseId,
        horseName: `Horse ${horseId}`,
        breedId: 1,
        conformationScores: {
          head,
          neck,
          shoulders,
          back,
          hindquarters,
          legs,
          hooves,
          topline,
          overallConformation,
        },
      },
    });
  }),

  // GET /api/v1/breeds/:breedId/conformation-averages
  http.get(`${base}/api/v1/breeds/:breedId/conformation-averages`, ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        breedId: String(params.breedId),
        breedName: 'Arabian',
        averages: {
          head: 75,
          neck: 73,
          shoulders: 77,
          back: 72,
          hindquarters: 76,
          legs: 74,
          hooves: 73,
          topline: 71,
          overallConformation: 73.9,
        },
        horseCount: 5,
      },
    });
  }),
];
