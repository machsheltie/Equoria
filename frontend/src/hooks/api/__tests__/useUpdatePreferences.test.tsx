/**
 * Regression test for Equoria-bvddn.27 (preferences slice).
 *
 * apiClient.ts unwraps the backend `{ status, data }` envelope (returns
 * `data.data`). The backend preferences endpoint
 * (backend/modules/auth/controllers/profileController.mjs updatePreferences,
 * ~line 418-421) answers:
 *   { status: 'success', data: { preferences: { ... } } }
 * so useUpdatePreferences' onSuccess callback receives the UNWRAPPED
 * `{ preferences }` object directly. The hook read `response.data.preferences`,
 * which is undefined on the real (unwrapped) response — every toggle saved
 * server-side but the settings page showed "Couldn't save preference".
 *
 * Seeds the ['profile'] cache with a full user (so the reconciliation write
 * is observable), fires the mutation against an MSW handler mirroring the
 * real backend envelope, and asserts onSuccess reconciles the cache with the
 * server's canonical preferences instead of throwing / leaving stale data.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdatePreferences } from '../useUpdatePreferences';
import { server } from '../../../test/msw/server';
import type { User } from '@/hooks/useAuth';
import type { UserPreferences } from '@/lib/api-client';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const fullPreferences: UserPreferences = {
  emailCompetition: true,
  emailBreeding: true,
  emailSystem: false,
  inAppTraining: true,
  inAppAchievements: true,
  inAppNews: false,
  reducedMotion: false,
  highContrast: false,
  compactCards: false,
  soundEnabled: true,
};

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUpdatePreferences (Equoria-bvddn.27)', () => {
  it('reconciles the profile cache with the unwrapped server preferences on success', async () => {
    const mergedPreferences: UserPreferences = { ...fullPreferences, reducedMotion: true };

    // Exact shape returned by profileController.mjs updatePreferences on success.
    server.use(
      http.patch(`${base}/api/v1/auth/profile/preferences`, () =>
        HttpResponse.json({
          status: 'success',
          data: { preferences: mergedPreferences },
        })
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const seededUser: User = {
      id: 'u1',
      username: 'settings-user',
      email: 'settings@example.com',
      money: 1500,
      role: 'user',
      preferences: fullPreferences,
    };
    queryClient.setQueryData(['profile'], { user: seededUser });

    const { result } = renderHook(() => useUpdatePreferences(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ reducedMotion: true });
    });

    // Before the fix this failed: `response.data` is undefined on the real
    // (already-unwrapped) response, so `response.data.preferences` threw a
    // TypeError inside onSuccess and the mutation never reconciled the cache.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData<{ user: User }>(['profile']);
    expect(cached?.user.preferences).toEqual(mergedPreferences);
    // Fields the preferences endpoint never touches must survive.
    expect(cached?.user.money).toBe(1500);
    expect(cached?.user.role).toBe('user');
  });
});
