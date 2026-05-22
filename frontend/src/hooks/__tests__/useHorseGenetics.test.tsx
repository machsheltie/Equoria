/**
 * Unit Tests: Horse Genetics Hooks
 *
 * Tests React Query hooks for genetics data:
 * - useHorseTraitInteractions
 * - useHorseEpigeneticInsights
 * - useHorseTraitTimeline
 *
 * Equoria-yzar3 — the hooks now map the REAL backend response shapes into a
 * stable UI view model. These tests therefore feed the MSW network boundary
 * the ACTUAL backend JSON (verified against the route handlers + services)
 * and assert the mapped view model — NOT the previous fictional shapes that
 * hid the contract mismatch (AC §4: mocked fictional shapes are not evidence).
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) — NOT vi.mock of the api-client module. This exercises the
 * real api-client fetch + `{ success, data }` unwrap and the hook mappers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useHorseTraitInteractions,
  useHorseEpigeneticInsights,
  useHorseTraitTimeline,
} from '../useHorseGenetics';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/* ---------------------------------------------------------------------------
 * REAL backend-shaped payloads (post `{ success, data }` unwrap is what MSW
 * returns as `data`). Sources:
 *  - epigenetic-insights: enhancedReportingRoutes.mjs:198-208 + traitInteractionMatrix
 *  - trait-interactions:  advancedEpigeneticRoutes.mjs:303-312 + analyzeTraitInteractions
 *  - trait-timeline:      enhancedReportingRoutes.mjs:262-271 + buildTraitTimeline
 * ------------------------------------------------------------------------- */

const realEpigeneticInsights = {
  horseId: 456,
  traitAnalysis: {
    horseId: 456,
    traits: ['brave', 'confident', 'social'],
    synergies: [{ trait1: 'brave', trait2: 'confident', strength: 0.8 }],
    conflicts: [],
    overallHarmony: 0.7,
    dominantTraits: [
      { trait: 'brave', dominanceScore: 0.85, dominanceLevel: 'dominant' },
    ],
    interactionStrength: 0.6,
  },
  environmentalInfluences: {},
  developmentalProgress: {},
  predictiveInsights: {},
  recommendations: ['Continue current care approach'],
};

const realTraitInteractions = {
  horseId: 123,
  traitInteractions: {
    horseId: 123,
    traits: ['brave', 'confident', 'social'],
    synergies: [
      {
        trait1: 'brave',
        trait2: 'confident',
        strength: 0.8,
        amplificationFactor: 1.3,
        category: 'confidence_cluster',
        description: 'Confidence and social traits reinforce each other',
      },
    ],
    conflicts: [
      {
        trait1: 'fearful',
        trait2: 'brave',
        strength: 0.9,
        suppressionFactor: 0.6,
        category: 'fear_confidence',
        description: 'Fear-based traits conflict with confidence traits',
      },
    ],
    overallHarmony: 0.5,
    interactionStrength: 0.7,
  },
  synergies: { horseId: 123, synergyPairs: [] },
  conflicts: [],
  dominance: {},
};

const realTraitTimeline = {
  horseId: 789,
  timeline: [
    {
      date: '2024-01-15T10:00:00Z',
      type: 'trait_discovery',
      event: 'Discovered trait: brave',
      method: 'milestone',
      context: 'unknown',
      data: { traitName: 'brave' },
    },
    {
      date: '2024-06-20T14:30:00Z',
      type: 'significant_interaction',
      event: 'grooming: trust_building',
      groom: 'Anna',
      bondingChange: 5,
      stressChange: -3,
      quality: 'excellent',
      data: {},
    },
  ],
  milestones: [],
  criticalPeriods: [],
  environmentalEvents: [],
};

describe('Horse Genetics Hooks', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  describe('useHorseTraitInteractions', () => {
    it('maps real backend trait-interactions into the view model', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-interactions`, () =>
          HttpResponse.json({ success: true, data: realTraitInteractions })
        )
      );

      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const interactions = result.current.data?.interactions ?? [];
      // synergy + conflict pairs both surface.
      expect(interactions).toHaveLength(2);
      // strength normalized 0..1 float → 0..100 int.
      expect(interactions[0].strength).toBe(80);
      // description becomes the UI `effect`.
      expect(interactions[0].effect).toMatch(/reinforce each other/i);
      // trait names humanized.
      expect(interactions[0].trait1).toBe('Brave');
      expect(interactions[0].trait2).toBe('Confident');
    });

    it('should handle 404 error (horse not found)', async () => {
      server.use(
        http.get(`${base}/api/horses/999/trait-interactions`, () =>
          HttpResponse.json({ message: 'Horse not found' }, { status: 404 })
        )
      );
      const { result } = renderHook(() => useHorseTraitInteractions(999), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ statusCode: 404, message: 'Horse not found' });
    });

    it('should handle network errors', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-interactions`, () => HttpResponse.error())
      );
      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseTraitInteractions(123, { enabled: false }), {
        wrapper,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should not fetch when horseId is 0', async () => {
      const { result } = renderHook(() => useHorseTraitInteractions(0), { wrapper });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('returns empty interactions when the backend matrix is empty', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-interactions`, () =>
          HttpResponse.json({
            success: true,
            data: {
              horseId: 123,
              traitInteractions: { horseId: 123, traits: [], synergies: [], conflicts: [] },
              conflicts: [],
            },
          })
        )
      );
      const { result } = renderHook(() => useHorseTraitInteractions(123), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.interactions).toHaveLength(0);
    });
  });

  describe('useHorseEpigeneticInsights', () => {
    it('maps real backend epigenetic-insights into trait view models', async () => {
      server.use(
        http.get(`${base}/api/horses/456/epigenetic-insights`, () =>
          HttpResponse.json({ success: true, data: realEpigeneticInsights })
        )
      );

      const { result } = renderHook(() => useHorseEpigeneticInsights(456), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const traits = result.current.data?.traits ?? [];
      // one trait per traitAnalysis.traits name.
      expect(traits).toHaveLength(3);
      const brave = traits.find((t) => t.name === 'Brave');
      expect(brave).toBeDefined();
      // dominant trait (dominanceScore 0.85 → 85) is legendary, others default.
      expect(brave?.strength).toBe(85);
      expect(brave?.rarity).toBe('legendary');
      // every trait has a defined description + impact object (TraitCard safe).
      for (const t of traits) {
        expect(typeof t.description).toBe('string');
        expect(t.impact).toBeDefined();
      }
    });

    it('returns empty traits when backend has no traitAnalysis', async () => {
      server.use(
        http.get(`${base}/api/horses/123/epigenetic-insights`, () =>
          HttpResponse.json({ success: true, data: { horseId: 123, recommendations: [] } })
        )
      );
      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.traits).toHaveLength(0);
    });

    it('should handle 401 unauthorized error', async () => {
      server.use(
        http.get(`${base}/api/horses/123/epigenetic-insights`, () =>
          HttpResponse.json({ message: 'Authentication required' }, { status: 401 })
        )
      );
      const { result } = renderHook(() => useHorseEpigeneticInsights(123), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ statusCode: 401 });
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseEpigeneticInsights(123, { enabled: false }), {
        wrapper,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('uses the correct query key', async () => {
      server.use(
        http.get(`${base}/api/horses/456/epigenetic-insights`, () =>
          HttpResponse.json({ success: true, data: realEpigeneticInsights })
        )
      );
      const { result } = renderHook(() => useHorseEpigeneticInsights(456), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(queryClient.getQueryData(['horse', 456, 'epigenetic-insights'])).toBeDefined();
    });
  });

  describe('useHorseTraitTimeline', () => {
    it('maps real backend timeline items so eventType is never undefined (crash guard)', async () => {
      server.use(
        http.get(`${base}/api/horses/789/trait-timeline`, () =>
          HttpResponse.json({ success: true, data: realTraitTimeline })
        )
      );

      const { result } = renderHook(() => useHorseTraitTimeline(789), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const timeline = result.current.data?.timeline ?? [];
      expect(timeline).toHaveLength(2);
      // AC §3: eventType is always a defined, non-empty string — the
      // `entry.eventType.charAt(0)` crash path is gone.
      for (const entry of timeline) {
        expect(typeof entry.eventType).toBe('string');
        expect(entry.eventType.length).toBeGreaterThan(0);
        expect(() => entry.eventType.charAt(0)).not.toThrow();
        expect(typeof entry.id).toBe('string');
        expect(typeof entry.timestamp).toBe('string');
      }
      // backend `type: trait_discovery` → humanized 'Trait Discovery'.
      expect(timeline[0].eventType).toBe('Trait Discovery');
      expect(timeline[0].traitName).toBe('Discovered trait: brave');
    });

    it('does not crash when timeline items are missing the type field', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-timeline`, () =>
          HttpResponse.json({
            success: true,
            data: {
              horseId: 123,
              // item with NO type/date/event — the worst-case real-world row.
              timeline: [{ data: {} }, null],
            },
          })
        )
      );
      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const timeline = result.current.data?.timeline ?? [];
      // null filtered out; the bare item gets a safe default eventType.
      expect(timeline).toHaveLength(1);
      expect(timeline[0].eventType).toBe('Event');
      expect(() => timeline[0].eventType.charAt(0)).not.toThrow();
    });

    it('should handle 404 error (horse not found)', async () => {
      server.use(
        http.get(`${base}/api/horses/999/trait-timeline`, () =>
          HttpResponse.json({ message: 'Horse not found' }, { status: 404 })
        )
      );
      const { result } = renderHook(() => useHorseTraitTimeline(999), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ statusCode: 404 });
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useHorseTraitTimeline(123, { enabled: false }), {
        wrapper,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('handles an empty timeline (young horse)', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-timeline`, () =>
          HttpResponse.json({ success: true, data: { horseId: 123, timeline: [] } })
        )
      );
      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.timeline).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      server.use(http.get(`${base}/api/horses/123/trait-timeline`, () => HttpResponse.error()));
      const { result } = renderHook(() => useHorseTraitTimeline(123), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Cache and Stale Time Configuration', () => {
    it('useHorseTraitInteractions populates the cache', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-interactions`, () =>
          HttpResponse.json({ success: true, data: realTraitInteractions })
        )
      );
      renderHook(() => useHorseTraitInteractions(123), { wrapper });
      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'trait-interactions']);
        expect(cacheEntry?.dataUpdatedAt).toBeGreaterThan(0);
      });
    });

    it('useHorseEpigeneticInsights populates the cache', async () => {
      server.use(
        http.get(`${base}/api/horses/123/epigenetic-insights`, () =>
          HttpResponse.json({ success: true, data: realEpigeneticInsights })
        )
      );
      renderHook(() => useHorseEpigeneticInsights(123), { wrapper });
      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'epigenetic-insights']);
        expect(cacheEntry?.dataUpdatedAt).toBeGreaterThan(0);
      });
    });

    it('useHorseTraitTimeline populates the cache', async () => {
      server.use(
        http.get(`${base}/api/horses/123/trait-timeline`, () =>
          HttpResponse.json({ success: true, data: realTraitTimeline })
        )
      );
      renderHook(() => useHorseTraitTimeline(123), { wrapper });
      await waitFor(() => {
        const cacheEntry = queryClient.getQueryState(['horse', 123, 'trait-timeline']);
        expect(cacheEntry?.dataUpdatedAt).toBeGreaterThan(0);
      });
    });
  });
});
