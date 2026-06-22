import { http, HttpResponse } from 'msw';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Competition list / detail / eligibility / entries handlers.
 * Registered after the user block, before competition-results. First-match-wins
 * order preserved.
 */
export const competitionHandlers = [
  // Advanced Horse Analysis
  // (Equoria-0fw18) Deleted dead unversioned /api/horses/:id/{environmental-analysis,
  // trait-interactions, developmental-timeline, forecast, breeding-data} and the
  // unversioned genetics/breeding handlers (/api/genetics/inbreeding-analysis,
  // /api/breeding/lineage-analysis/:s/:m, /api/breeding/genetic-probability,
  // /api/genetics/breeding-compatibility) and unversioned /api/groom-marketplace
  // (GET) — all served by their /api/v1/ mirrors in the v1-mirror block below.

  // Competition API - singular path (used by competitionsApi in api-client.ts)
  // (Equoria-0fw18) Deleted dead unversioned /api/competition (list) — the v1
  // twin /api/v1/competition in the v1-mirror block serves competitionsApi.list.
  // The /disciplines, /eligibility, /enter handlers below have NO v1 mirror, so
  // they are versioned in place (competitionsApi.getDisciplines/checkEligibility/enter).
  http.get(`${base}/api/v1/competition/disciplines`, () =>
    HttpResponse.json({
      success: true,
      data: {
        disciplines: ['dressage', 'jumping', 'eventing', 'racing', 'endurance'],
        disciplineDetails: [],
      },
    })
  ),
  http.get(`${base}/api/v1/competition/eligibility/:horseId/:discipline`, () =>
    HttpResponse.json({
      success: true,
      data: {
        eligibility: {
          eligible: true,
          reasons: [],
        },
      },
    })
  ),
  http.post(`${base}/api/v1/competition/enter`, () =>
    HttpResponse.json({
      success: true,
      data: { entryId: 101 },
    })
  ),

  // Competition System - Filtered List
  http.get(`${base}/api/v1/competitions`, ({ request }) => {
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
  http.get(`${base}/api/v1/competitions/:id`, ({ params }) => {
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
  http.get(`${base}/api/v1/competitions/:compId/eligibility/:userId`, () => {
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
  // (Equoria-0fw18) Deleted dead unversioned POST /api/competitions/enter — the
  // v1 twin POST /api/v1/competitions/enter (v1-mirror block) serves
  // submitCompetitionEntry (frontend/src/lib/api/competitions.ts).

  // Competition System - Entries (legacy)
  http.get(`${base}/api/v1/competitions/:id/entries`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
  http.get(`${base}/api/v1/horses/user/eligible`, () =>
    HttpResponse.json({
      success: true,
      data: [],
    })
  ),
];
