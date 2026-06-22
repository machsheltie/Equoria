/**
 * Shared test utilities for the HorseListView test suite.
 *
 * Extracted (Equoria-urqic.2) from the original monolithic
 * HorseListView.test.tsx so the behavior-grouped sibling files
 * (HorseListView.rendering/filtering/actions/eligibility.test.tsx)
 * can share the same mock horse data and provider wrapper VERBATIM.
 * No values or semantics were changed during extraction.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { createMockHorse } from '../../test/factories';

// Mock horse data for testing (NO MOCKING - real data structures).
// Refactored to use the createMockHorse factory (Equoria-tjyc) — values are
// preserved exactly so component behavior is unchanged; the factory just
// removes the repeated literal object boilerplate. The third horse omits
// imageUrl (undefined) to exercise the placeholder path.
export const mockHorses = [
  createMockHorse({
    id: 1,
    name: 'Thunder',
    breed: 'Thoroughbred',
    age: 5,
    level: 10,
    health: 95,
    xp: 1500,
    imageUrl: 'https://example.com/horses/thunder.jpg',
    stats: {
      speed: 85,
      stamina: 80,
      agility: 75,
      strength: 70,
      intelligence: 68,
      temperament: 68,
      balance: 70,
      precision: 72,
      boldness: 78,
      flexibility: 65,
      obedience: 70,
      focus: 75,
    },
    disciplineScores: {
      'Western Pleasure': 85,
      Dressage: 70,
    },
  }),
  createMockHorse({
    id: 2,
    name: 'Lightning',
    breed: 'Arabian',
    age: 3,
    level: 5,
    health: 100,
    xp: 500,
    imageUrl: 'https://example.com/horses/lightning.jpg',
    stats: {
      speed: 90,
      stamina: 85,
      agility: 88,
      strength: 70,
      intelligence: 85,
      temperament: 68,
      balance: 82,
      precision: 80,
      boldness: 75,
      flexibility: 78,
      obedience: 80,
      focus: 82,
    },
    disciplineScores: {
      Endurance: 90,
      'Show Jumping': 75,
    },
  }),
  createMockHorse({
    id: 3,
    name: 'Storm',
    breed: 'Quarter Horse',
    age: 7,
    level: 15,
    health: 90,
    xp: 3000,
    imageUrl: undefined, // No imageUrl - should use placeholder
    stats: {
      speed: 80,
      stamina: 75,
      agility: 70,
      strength: 70,
      intelligence: 72,
      temperament: 68,
      balance: 75,
      precision: 78,
      boldness: 85,
      flexibility: 68,
      obedience: 75,
      focus: 70,
    },
    disciplineScores: {
      'Barrel Racing': 88,
      Reining: 82,
    },
  }),
];

// Test wrapper with required providers
export const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};
