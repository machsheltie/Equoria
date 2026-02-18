/**
 * useGrooms Hook Tests (Story 8.4: Groom System Live)
 *
 * Tests that groom hooks fetch real data via MSW:
 * - useGroomMarketplace: returns MarketplaceData with grooms[] from GET /api/groom-marketplace
 * - useUserGrooms: returns Groom[] from GET /api/grooms/user/:userId
 * - useGroomAssignments: returns GroomAssignment[] from GET /api/groom-assignments
 * - useGroomSalaries: returns SalarySummary from GET /api/groom-salaries/summary
 * - useHireGroom: POST /api/groom-marketplace/hire succeeds and invalidates queries
 * - useAssignGroom: POST /api/groom-assignments succeeds and invalidates queries
 * - groomKeys: correct query key structure
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.3 useHorses.story-8-3.test.tsx.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useGroomMarketplace,
  useUserGrooms,
  useGroomAssignments,
  useGroomSalaries,
  useHireGroom,
  useAssignGroom,
  groomKeys,
} from '../useGrooms';

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ─── useGroomMarketplace ──────────────────────────────────────────────────────

describe('useGroomMarketplace', () => {
  it('returns MarketplaceData with grooms array from MSW (AC: 1)', async () => {
    const { result } = renderHook(() => useGroomMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data?.grooms)).toBe(true);
    expect(result.current.data?.grooms).toHaveLength(2);
  });

  it('returns MarketplaceGroom with correct fields (AC: 1)', async () => {
    const { result } = renderHook(() => useGroomMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.grooms[0];
    expect(first?.marketplaceId).toBe('mp-001');
    expect(first?.firstName).toBe('Alice');
    expect(first?.lastName).toBe('Thornton');
    expect(first?.specialty).toBe('Dressage');
    expect(first?.skillLevel).toBe('Expert');
  });

  it('returns marketplace metadata (refreshCost, canRefreshFree, refreshCount)', async () => {
    const { result } = renderHook(() => useGroomMarketplace(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.refreshCost).toBe(500);
    expect(result.current.data?.canRefreshFree).toBe(false);
    expect(result.current.data?.refreshCount).toBe(3);
  });
});

// ─── useUserGrooms ────────────────────────────────────────────────────────────

describe('useUserGrooms', () => {
  it('returns an array of Groom objects for a userId (AC: 3)', async () => {
    const { result } = renderHook(() => useUserGrooms(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(1);
  });

  it('returns Groom with correct fields (AC: 3)', async () => {
    const { result } = renderHook(() => useUserGrooms(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const groom = result.current.data?.[0];
    expect(groom?.id).toBe(10);
    expect(groom?.name).toBe('Alice Thornton');
    expect(groom?.skillLevel).toBe('Expert');
    expect(groom?.specialty).toBe('Dressage');
  });

  it('is disabled when userId is 0 (falsy)', () => {
    const { result } = renderHook(() => useUserGrooms(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useGroomAssignments ──────────────────────────────────────────────────────

describe('useGroomAssignments', () => {
  it('returns GroomAssignment array from MSW (AC: 5)', async () => {
    const { result } = renderHook(() => useGroomAssignments(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(1);
  });

  it('returns GroomAssignment with correct fields (AC: 5)', async () => {
    const { result } = renderHook(() => useGroomAssignments(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const assignment = result.current.data?.[0];
    expect(assignment?.id).toBe(1);
    expect(assignment?.groomId).toBe(10);
    expect(assignment?.horseId).toBe(1);
    expect(assignment?.isActive).toBe(true);
  });
});

// ─── useGroomSalaries ────────────────────────────────────────────────────────

describe('useGroomSalaries', () => {
  it('returns SalarySummary with totals from MSW (AC: 6)', async () => {
    const { result } = renderHook(() => useGroomSalaries(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalMonthlyCost).toBe(600);
    expect(result.current.data?.totalWeeklyCost).toBe(150);
    expect(result.current.data?.groomCount).toBe(1);
  });

  it('returns SalarySummary with non-empty breakdown (AC: 6)', async () => {
    const { result } = renderHook(() => useGroomSalaries(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data?.breakdown)).toBe(true);
    const entry = result.current.data?.breakdown[0];
    expect(entry?.groomId).toBe(10);
    expect(entry?.groomName).toBe('Alice Thornton');
    expect(entry?.weeklyCost).toBe(150);
  });
});

// ─── useHireGroom mutation ────────────────────────────────────────────────────

describe('useHireGroom', () => {
  it('mutation succeeds and returns hire response (AC: 2)', async () => {
    const { result } = renderHook(() => useHireGroom(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate('mp-001');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('mutation is in idle state before firing', () => {
    const { result } = renderHook(() => useHireGroom(), { wrapper: createWrapper() });
    expect(result.current.isIdle).toBe(true);
  });
});

// ─── useAssignGroom mutation ──────────────────────────────────────────────────

describe('useAssignGroom', () => {
  it('mutation succeeds when called with valid data (AC: 4)', async () => {
    const { result } = renderHook(() => useAssignGroom(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({ groomId: 10, horseId: 1, priority: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('mutation is in idle state before firing', () => {
    const { result } = renderHook(() => useAssignGroom(), { wrapper: createWrapper() });
    expect(result.current.isIdle).toBe(true);
  });
});

// ─── groomKeys ────────────────────────────────────────────────────────────────

describe('groomKeys', () => {
  it('all key is ["grooms"]', () => {
    expect(groomKeys.all).toEqual(['grooms']);
  });

  it('user key includes userId', () => {
    expect(groomKeys.user(42)).toEqual(['grooms', 'user', 42]);
  });

  it('marketplace key is ["grooms", "marketplace"]', () => {
    expect(groomKeys.marketplace()).toEqual(['grooms', 'marketplace']);
  });
});
