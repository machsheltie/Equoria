import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * ───────────────────────────────────────────────────────────────────────
 * v1 mirror handlers (Epic 20 api-client migration). Each handler below
 * mirrors the response of its /api/... counterpart above. When the legacy
 * path is no longer referenced anywhere, delete the legacy handler AND
 * this mirror together.
 * ───────────────────────────────────────────────────────────────────────
 *
 * Covers: training, breeding-foals POST, grooms, competition list + bulk enter,
 * advanced horse analysis, behavioral flags, genetics/breeding analysis.
 * Registered after the catalog block, before forum. First-match-wins order
 * preserved.
 */
export const v1MirrorHandlers = [
  // Training (mirrors /api/training/check-eligibility, /api/training/train)
  http.post(`${base}/api/v1/training/check-eligibility`, () =>
    HttpResponse.json({ success: true, data: { eligible: true, reason: null } })
  ),
  http.post(`${base}/api/v1/training/train`, async ({ request }) => {
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

  // Breeding / foals — pregnancy-started response (B3 delayed foaling).
  // Mirrors the /api/horses/foals handler above; both paths exist because
  // the backend mounts authRouter on both /api and /api/v1. See the
  // /api/horses/foals handler comment for the contract.
  http.post(`${base}/api/v1/horses/foals`, () =>
    HttpResponse.json({
      success: true,
      message: 'Pregnancy started. Foal due in 7 days.',
      data: {
        pregnancyStarted: true,
        damId: 2,
        sireId: 1,
        foalDueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
  ),

  // Grooms (mirrors /api/groom-assignments, /api/groom-salaries/summary,
  // /api/groom-marketplace, /api/groom-marketplace/hire)
  http.get(`${base}/api/v1/groom-assignments`, () =>
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
  http.post(`${base}/api/v1/groom-assignments`, () => HttpResponse.json({ success: true })),
  http.get(`${base}/api/v1/groom-salaries/summary`, () =>
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
  http.get(`${base}/api/v1/groom-marketplace`, () =>
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
  http.post(`${base}/api/v1/groom-marketplace/hire`, () =>
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

  // Competition (mirrors /api/competition)
  http.get(`${base}/api/v1/competition`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          name: 'Spring Dressage Championship',
          discipline: 'dressage',
          date: '2026-03-15T10:00:00Z',
          entryFee: 50,
          prizePool: 5000,
          status: 'open',
          maxEntries: 20,
          currentEntries: 12,
          location: 'Central Arena',
        },
        {
          id: 2,
          name: 'Weekly Jumping Series',
          discipline: 'jumping',
          date: '2026-02-10T14:00:00Z',
          entryFee: 25,
          prizePool: 2500,
          status: 'open',
          maxEntries: 30,
          currentEntries: 28,
        },
        {
          id: 3,
          name: 'Free Training Show',
          discipline: 'eventing',
          date: '2026-02-05T09:00:00Z',
          entryFee: 0,
          prizePool: 0,
          status: 'open',
          maxEntries: 50,
          currentEntries: 15,
        },
      ],
    })
  ),

  // Bulk competition entry (mirrors /api/competitions/enter). The real client
  // submitCompetitionEntry() posts to the VERSIONED /api/v1/competitions/enter
  // (frontend/src/lib/api/competitions.ts) — without this versioned handler the
  // useEnterCompetition mutation never resolves and waitFor(isSuccess) times out
  // (Equoria-ls2rx). Body shape: { competitionId, horseIds: number[] }.
  http.post(`${base}/api/v1/competitions/enter`, async ({ request }) => {
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

  // Advanced Horse Analysis (mirrors /api/horses/:id/{environmental-analysis,
  // trait-interactions, developmental-timeline, forecast})
  http.get(`${base}/api/v1/horses/:id/environmental-analysis`, () =>
    HttpResponse.json({
      success: true,
      data: { factors: [], summary: 'Normal environment' },
    })
  ),
  http.get(`${base}/api/v1/horses/:id/trait-interactions`, () =>
    HttpResponse.json({ success: true, data: { interactions: [] } })
  ),
  http.get(`${base}/api/v1/horses/:id/developmental-timeline`, () =>
    HttpResponse.json({ success: true, data: { milestones: [] } })
  ),
  http.get(`${base}/api/v1/horses/:id/forecast`, () =>
    HttpResponse.json({ success: true, data: { forecasts: [] } })
  ),

  // Behavioral epigenetic flags (Equoria-yzqhj.8) — GeneticsTab renders the
  // BehavioralFlagsPanel which fetches these. Safe honest defaults: no flags
  // yet, care-patterns ineligible. Per-test overrides supply richer shapes.
  http.get(`${base}/api/v1/flags/horses/:id/flags`, ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        horseId: Number(params.id),
        horseName: 'TestFixture-Horse',
        ageInYears: 4,
        currentBondScore: 50,
        currentStressLevel: 10,
        flagCount: 0,
        flags: [],
        maxFlags: 5,
        canReceiveMoreFlags: false,
      },
    })
  ),
  http.get(`${base}/api/v1/flags/horses/:id/care-patterns`, () =>
    HttpResponse.json({ success: true, data: { eligible: false, patterns: {} } })
  ),
  http.get(`${base}/api/v1/flags/definitions`, () =>
    HttpResponse.json({ success: true, data: { count: 0, flags: [] } })
  ),

  // Genetics / breeding analysis (mirrors /api/genetics/inbreeding-analysis,
  // /api/genetics/breeding-compatibility, /api/breeding/genetic-probability)
  http.post(`${base}/api/v1/genetics/inbreeding-analysis`, () =>
    HttpResponse.json({
      success: true,
      data: {
        inbreedingCoefficient: 0.0625,
        riskLevel: 'low',
        commonAncestors: [],
      },
    })
  ),
  http.post(`${base}/api/v1/genetics/breeding-compatibility`, () =>
    HttpResponse.json({
      success: true,
      data: {
        compatibilityScore: 82,
        recommendation: 'Good match',
        concerns: [],
      },
    })
  ),
  http.post(`${base}/api/v1/breeding/genetic-probability`, () =>
    HttpResponse.json({
      success: true,
      data: {
        traitProbabilities: { bold: 0.75, athletic: 0.5 },
        expectedStatRanges: { speed: [60, 80], stamina: [55, 75] },
      },
    })
  ),
];
