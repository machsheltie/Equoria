/**
 * Unit Tests: useHorseTraits hooks + pure mappers
 *
 * Covers Equoria-hriey (discovery-status hook + discover mutation),
 * Equoria-6rf97 (authoritative positive/negative classification), and the
 * data feeding Equoria-vpgmc (detail modal).
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides —
 * NOT vi.mock of the api-client. This exercises the real api-client fetch +
 * `{ success, data }` unwrap and the hook mappers against the ACTUAL backend
 * JSON shapes (verified against traitController.mjs getHorseTraits /
 * getDiscoveryStatus / discoverTraits).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useHorseTraits,
  useHorseTraitDiscoveryStatus,
  useDiscoverTraits,
  mapHorseTraits,
  mapDiscoveryStatus,
  humanizeTraitKey,
} from '../useHorseTraits';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/* Real backend-shaped payloads (post `{ success, data }` unwrap = data). */
const realHorseTraits = {
  horseId: 42,
  horseName: 'TestFixture-Trait-Horse',
  bondScore: 50,
  stressLevel: 10,
  age: 4,
  traits: {
    positive: [
      {
        name: 'resilient',
        definition: {
          type: 'positive',
          rarity: 'common',
          description: 'Less likely to be affected by stress.',
          category: 'epigenetic',
        },
      },
    ],
    negative: [
      {
        name: 'nervous',
        definition: {
          type: 'negative',
          rarity: 'common',
          description: 'Easily startled by new situations.',
          category: 'epigenetic',
        },
      },
    ],
    hidden: [
      { name: '???', definition: null },
      { name: '???', definition: null },
    ],
  },
  summary: { totalTraits: 4, visibleTraits: 2, hiddenTraits: 2 },
};

const realDiscoveryStatus = {
  horseId: 42,
  horseName: 'TestFixture-Trait-Horse',
  currentStats: { bondScore: 50, stressLevel: 10, age: 4 },
  traitCounts: { visible: 2, hidden: 2 },
  discoveryConditions: {
    met: [{ trait: 'brave', reason: 'High bond score reached' }],
    enrichment: [],
    total: 1,
  },
  canDiscover: true,
};

describe('useHorseTraits — pure mappers', () => {
  describe('mapHorseTraits', () => {
    it('classifies positive and negative traits authoritatively from the backend buckets', () => {
      const view = mapHorseTraits(realHorseTraits);
      // Sentinel-positive: a known positive and a known negative render distinctly.
      expect(view.positive).toHaveLength(1);
      expect(view.positive[0]).toMatchObject({
        key: 'resilient',
        name: 'Resilient',
        valence: 'positive',
      });
      expect(view.positive[0].description).toMatch(/stress/i);
      expect(view.negative).toHaveLength(1);
      expect(view.negative[0]).toMatchObject({
        key: 'nervous',
        name: 'Nervous',
        valence: 'negative',
      });
      // hidden names are NOT revealed — only counted.
      expect(view.hiddenCount).toBe(2);
      expect(view.totalTraits).toBe(4);
    });

    it('is total/defensive on missing/null shapes', () => {
      expect(mapHorseTraits(null)).toEqual({
        positive: [],
        negative: [],
        hiddenCount: 0,
        totalTraits: 0,
      });
      expect(mapHorseTraits({})).toEqual({
        positive: [],
        negative: [],
        hiddenCount: 0,
        totalTraits: 0,
      });
      expect(mapHorseTraits({ traits: { positive: [{ name: '' }, {}] } }).positive).toHaveLength(0);
    });
  });

  describe('mapDiscoveryStatus', () => {
    it('maps backend counts into the HiddenTraitIndicator shape', () => {
      const status = mapDiscoveryStatus(realDiscoveryStatus);
      expect(status.totalTraits).toBe(4);
      expect(status.discoveredTraits).toBe(2);
      expect(status.hiddenTraits).toBe(2);
      expect(status.partiallyDiscoveredTraits).toBe(0);
      expect(status.discoveryProgress).toBe(50);
      expect(status.nextDiscoveryHint).toMatch(/bond score/i);
    });

    it('handles no hidden traits / no conditions', () => {
      const status = mapDiscoveryStatus({ horseId: 1, traitCounts: { visible: 3, hidden: 0 } });
      expect(status.hiddenTraits).toBe(0);
      expect(status.discoveryProgress).toBe(100);
      expect(status.nextDiscoveryHint).toBeUndefined();
    });

    // Equoria-9zmc4: pre-eligibility flag + reason mapping.
    it('passes through canDiscover=true with no reason when eligible', () => {
      const status = mapDiscoveryStatus(realDiscoveryStatus);
      expect(status.canDiscover).toBe(true);
      expect(status.cannotDiscoverReason).toBeUndefined();
    });

    it('derives an "already discovered" reason when not eligible and no hidden traits', () => {
      const status = mapDiscoveryStatus({
        horseId: 1,
        traitCounts: { visible: 5, hidden: 0 },
        canDiscover: false,
      });
      expect(status.canDiscover).toBe(false);
      expect(status.cannotDiscoverReason).toMatch(/already been discovered/i);
    });

    it('derives a "no conditions met" reason when not eligible but hidden traits remain', () => {
      const status = mapDiscoveryStatus({
        horseId: 1,
        traitCounts: { visible: 2, hidden: 3 },
        discoveryConditions: { met: [], enrichment: [], total: 0 },
        canDiscover: false,
      });
      expect(status.canDiscover).toBe(false);
      expect(status.hiddenTraits).toBe(3);
      expect(status.cannotDiscoverReason).toMatch(/no discovery conditions are met/i);
    });

    it('defaults a MISSING canDiscover flag to true (never silently disables)', () => {
      const status = mapDiscoveryStatus({ horseId: 1, traitCounts: { visible: 1, hidden: 2 } });
      expect(status.canDiscover).toBe(true);
      expect(status.cannotDiscoverReason).toBeUndefined();
    });
  });

  describe('humanizeTraitKey', () => {
    it('title-cases snake and camel keys', () => {
      expect(humanizeTraitKey('resilient')).toBe('Resilient');
      expect(humanizeTraitKey('show_calm')).toBe('Show Calm');
      expect(humanizeTraitKey('crowdReady')).toBe('Crowd Ready');
      expect(humanizeTraitKey('')).toBe('Unknown Trait');
    });
  });
});

describe('useHorseTraits hooks', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  it('useHorseTraits fetches /traits/horse/:id and maps the classification', async () => {
    server.use(
      http.get(`${base}/api/v1/traits/horse/42`, () =>
        HttpResponse.json({ success: true, data: realHorseTraits })
      )
    );
    const { result } = renderHook(() => useHorseTraits(42), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.positive[0].name).toBe('Resilient');
    expect(result.current.data?.negative[0].valence).toBe('negative');
    expect(result.current.data?.hiddenCount).toBe(2);
  });

  it('useHorseTraitDiscoveryStatus fetches /traits/discovery-status/:id', async () => {
    server.use(
      http.get(`${base}/api/v1/traits/discovery-status/42`, () =>
        HttpResponse.json({ success: true, data: realDiscoveryStatus })
      )
    );
    const { result } = renderHook(() => useHorseTraitDiscoveryStatus(42), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.hiddenTraits).toBe(2);
    expect(result.current.data?.discoveryProgress).toBe(50);
  });

  it('does not fetch when horseId is 0', async () => {
    const { result } = renderHook(() => useHorseTraits(0), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useDiscoverTraits posts /traits/discover/:id and resolves with revealed traits', async () => {
    server.use(
      http.post(`${base}/api/v1/traits/discover/42`, () =>
        HttpResponse.json({
          success: true,
          message: 'Discovered 1 trait',
          data: {
            horseId: 42,
            traitsRevealed: [{ traitKey: 'brave', traitName: 'brave', category: 'positive' }],
            summary: { totalTraitsRevealed: 1, hiddenAfter: 1 },
          },
        })
      )
    );
    const { result } = renderHook(() => useDiscoverTraits(42), { wrapper });
    const res = await result.current.mutateAsync();
    expect(res.summary?.totalTraitsRevealed).toBe(1);
  });

  it('useDiscoverTraits surfaces the real backend 400 eligibility message', async () => {
    server.use(
      http.post(`${base}/api/v1/traits/discover/7`, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'Horse with ID 7 is not eligible for trait discovery (age: 1).',
          },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useDiscoverTraits(7), { wrapper });
    await expect(result.current.mutateAsync()).rejects.toMatchObject({
      statusCode: 400,
      message: /not eligible for trait discovery/i,
    });
  });
});
