/**
 * Shared fixtures + render/nav helpers for the HorseDetailPage Training-tab
 * integration suites (Equoria-smnow).
 *
 * Extracted verbatim from the former 1242-line
 * frontend/src/pages/__tests__/HorseDetailPage.Training.test.tsx so the per-tab
 * test files (trainingTab.integration.test.tsx, trainingTab.confirmation.test.tsx,
 * trainingTab.result.test.tsx, trainingTab.flow.test.tsx) can share one fixture
 * surface and each stay <=300 lines per the Equoria-g6aed AC.
 *
 * NOTE: this preserves the existing fetch-mock test style (predates CLAUDE.md
 * §3's "no new mocks" rule — this is a re-org, not a new mock). Assertions are
 * unchanged; only their physical file home moved.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../../test/utils';
import { vi, expect } from 'vitest';

// Mock horse data with training-compatible structure
export const createMockHorse = (overrides = {}) => ({
  id: 1,
  name: 'Thunder',
  breed: 'Thoroughbred',
  breedId: 1,
  age: 5,
  gender: 'Stallion',
  dateOfBirth: '2020-03-15',
  healthStatus: 'Excellent',
  description: 'A magnificent thoroughbred with exceptional speed and stamina.',
  imageUrl: 'https://example.com/horses/thunder.jpg',
  stats: {
    speed: 85,
    stamina: 80,
    agility: 75,
    strength: 82,
    intelligence: 78,
    health: 95,
  },
  disciplineScores: {
    'western-pleasure': 45,
    dressage: 30,
    'show-jumping': 55,
    endurance: 25,
    'barrel-racing': 0,
  },
  traits: ['Fast Learner', 'Even Tempered', 'Strong Build'],
  parentIds: {
    sireId: 10,
    damId: 11,
  },
  ...overrides,
});

// Mock horse data for young horses (under 3 years)
export const createYoungHorse = () =>
  createMockHorse({
    id: 2,
    name: 'Foalster',
    age: 2,
    dateOfBirth: '2023-06-15',
  });

// Mock training overview (no cooldowns)
export const createMockTrainingOverview = () => [
  { discipline: 'western-pleasure', score: 45, nextEligibleDate: null, lastTrainedAt: null },
  { discipline: 'dressage', score: 30, nextEligibleDate: null, lastTrainedAt: null },
  { discipline: 'show-jumping', score: 55, nextEligibleDate: null, lastTrainedAt: null },
];

// Mock training overview with cooldown
export const createMockTrainingOverviewWithCooldown = () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

  return [
    {
      discipline: 'western-pleasure',
      score: 45,
      nextEligibleDate: futureDate.toISOString(),
      lastTrainedAt: new Date().toISOString(),
    },
    { discipline: 'dressage', score: 30, nextEligibleDate: null, lastTrainedAt: null },
    { discipline: 'show-jumping', score: 55, nextEligibleDate: null, lastTrainedAt: null },
  ];
};

// Mock successful training result
export const createMockTrainingResult = (disciplineId: string) => ({
  success: true,
  updatedHorse: {
    id: 1,
    name: 'Thunder',
    discipline_scores: { [disciplineId]: 50 },
  },
  message: 'Training successful',
  nextEligible: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  statGain: { stat: 'speed', amount: 2, traitModified: false },
  // Equoria-o1x6g: trainRouteHandler now surfaces the real awarded XP and the
  // authoritative discipline-score delta. TrainingTab reads result.xpAwarded
  // for the XP row (was traitEffects.xpModifier) and result.disciplineScoreIncrease
  // for scoreGain, so the shared mock must carry the real contract fields.
  xpAwarded: 25,
  disciplineScoreIncrease: 5,
  traitEffects: { appliedTraits: ['Fast Learner'], scoreModifier: 1, xpModifier: 25 },
  updatedScore: 50,
  discipline: disciplineId,
  horseId: 1,
});

// Store original fetch
export const originalFetch = global.fetch;

// Create mock fetch handler
export const createFetchMock = (
  options: {
    horse?: any;
    trainingOverview?: any;
    trainingResult?: any;
    trainingError?: string;
    geneticsData?: any;
  } = {}
) => {
  const {
    horse = createMockHorse(),
    trainingOverview = createMockTrainingOverview(),
    trainingResult,
    trainingError,
    geneticsData = { traits: [], interactions: [], timeline: [] },
  } = options;

  return vi.fn((url: string | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const method = init?.method?.toUpperCase() || 'GET';

    // Horse endpoint (covers both legacy /api/horses/:id and v1 /api/v1/horses/:id)
    if (
      (urlStr.includes('/api/horses/') || urlStr.includes('/api/v1/horses/')) &&
      method === 'GET' &&
      !urlStr.includes('/training')
    ) {
      if (horse === null) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ success: false, message: 'Horse not found' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: horse }),
      } as Response);
    }

    // Training overview endpoint (covers both legacy /api/training/status/ and v1 /api/v1/training/status/)
    if (
      (urlStr.includes('/api/training/status/') || urlStr.includes('/api/v1/training/status/')) &&
      method === 'GET'
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: trainingOverview }),
      } as Response);
    }

    // Training execution endpoint
    if (urlStr.includes('/api/v1/training/train') && method === 'POST') {
      if (trainingError) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ success: false, message: trainingError }),
        } as Response);
      }

      // Extract discipline from request body
      const body = init?.body ? JSON.parse(init.body.toString()) : {};
      const result = trainingResult || createMockTrainingResult(body.discipline);

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: result }),
      } as Response);
    }

    // Genetics endpoints
    if (urlStr.includes('/epigenetic-insights')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { traits: geneticsData.traits } }),
      } as Response);
    }
    if (urlStr.includes('/trait-interactions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ success: true, data: { interactions: geneticsData.interactions } }),
      } as Response);
    }
    if (urlStr.includes('/trait-timeline')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { timeline: geneticsData.timeline } }),
      } as Response);
    }

    // Fallback
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    } as Response);
  }) as typeof fetch;
};

// Test wrapper with required providers
export const renderWithProviders = (ui: React.ReactElement, { route = '/horses/1' } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Set up routing
  window.history.pushState({}, 'Test', route);

  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/horses/:id" element={ui} />
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};

// Helper to wait for horse data to load
export const waitForHorseToLoad = async (horseName: string = 'Thunder') => {
  await waitFor(() => {
    expect(screen.getByText(horseName)).toBeInTheDocument();
  });
};

// Helper to navigate to training tab
export const navigateToTrainingTab = async () => {
  const trainingTab = screen.getByRole('tab', { name: /training/i });
  await userEvent.click(trainingTab);

  await waitFor(() => {
    expect(trainingTab).toHaveAttribute('aria-selected', 'true');
  });
};
