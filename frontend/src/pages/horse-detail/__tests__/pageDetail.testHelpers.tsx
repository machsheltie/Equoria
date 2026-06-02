/**
 * Shared fixtures + render/fetch helpers for the page-level HorseDetailPage
 * suites (Equoria-snx5i).
 *
 * Extracted verbatim from the former 886-line
 * frontend/src/pages/__tests__/HorseDetailPage.test.tsx so the page-concern
 * test files (pageDetail.rendering, pageDetail.navigation, pageDetail.errorState,
 * pageDetail.apiAndPregnancy) can share one fixture surface and each stay
 * <=300 lines per the Equoria-g6aed AC.
 *
 * These describe blocks test PAGE-level concerns (page shell, routing, tab
 * switching, loading/error states, responsive render) rather than per-tab
 * container internals, so the split groups by page-concern, not by tab.
 *
 * NOTE: this preserves the existing global.fetch-mock test style (predates
 * CLAUDE.md §3's "no new mocks" rule — this is a re-org, not a new mock).
 * Assertions are unchanged; only their physical file home moved.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MockAuthProvider } from '../../../test/utils';
import { vi } from 'vitest';

// Mock horse data for testing (NO MOCKING - real data structures)
export const mockHorse = {
  id: 1,
  name: 'Thunder',
  breed: 'Thoroughbred',
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
    'Western Pleasure': 85,
    Dressage: 70,
    'Show Jumping': 78,
    Endurance: 72,
  },
  traits: ['Fast Learner', 'Even Tempered', 'Strong Build'],
  parentIds: {
    sireId: 10,
    damId: 11,
  },
};

// Mock fetch globally
export const originalFetch = global.fetch;

// Helper to create fetch mock that handles both horse data AND genetics endpoints
export const createFetchMock = (horseResponse?: any) => {
  return vi.fn(((url: string, ...args) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Handle genetics endpoints
    if (urlStr.includes('/epigenetic-insights')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { traits: [] } }),
      } as Response);
    }
    if (urlStr.includes('/trait-interactions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { interactions: [] } }),
      } as Response);
    }
    if (urlStr.includes('/trait-timeline')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { timeline: [] } }),
      } as Response);
    }

    // Handle horse data endpoint if response provided
    if (horseResponse !== undefined) {
      return Promise.resolve({
        ok: horseResponse.ok ?? true,
        status: horseResponse.status ?? 200,
        json: () => Promise.resolve(horseResponse),
      } as Response);
    }

    // Fall back to original fetch
    return originalFetch(url, ...args);
  }) as typeof fetch);
};

// Test wrapper with required providers and routing
export const createTestWrapper = (_horseId: string = '1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/horses/:id" element={children} />
          </Routes>
        </BrowserRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
};
