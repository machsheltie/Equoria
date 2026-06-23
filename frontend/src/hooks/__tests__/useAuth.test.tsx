/**
 * Unit Tests: useAuth Hooks
 *
 * Tests React Query authentication hooks with httpOnly cookies
 * Verifies proper cache management and error handling
 *
 * Phase 1, Day 1-2: HttpOnly Cookie Migration
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. This exercises the
 * REAL api-client auth flow — including the CSRF round-trip on mutations and
 * the single 401→refresh→retry path — so the cache-invalidation, no-retry,
 * and no-token-storage contracts are validated against the actual client.
 * The user-facing login/register/logout journeys are additionally covered by
 * the auth Playwright E2E specs (tests/e2e/); these unit tests lock the hooks'
 * cache/security logic that an E2E cannot observe directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useProfile, useLogin, useRegister, useLogout, useIsAuthenticated } from '../useAuth';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Profile 401 + a failing refresh so the client does NOT retry getProfile. */
function stubProfileUnauthorized(message = 'Invalid or expired token') {
  let profileCalls = 0;
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () => {
      profileCalls += 1;
      return HttpResponse.json({ message, status: 'error' }, { status: 401 });
    }),
    // Refresh fails → client throws the 401 instead of retrying.
    http.post(`${base}/api/v1/auth/refresh-token`, () =>
      HttpResponse.json({ message: 'no session' }, { status: 401 })
    )
  );
  return () => profileCalls;
}

describe('useAuth Hooks - Cookie-Based Authentication', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  describe('useProfile - Get Current User', () => {
    it('should fetch user profile using httpOnly cookies', async () => {
      const mockUser = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };

      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.json({ data: mockUser }))
      );

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUser);
    });

    it('should handle 401 Unauthorized (expired/invalid cookies)', async () => {
      stubProfileUnauthorized();

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toMatchObject({ statusCode: 401 });
    });

    it('should NOT retry on 401 errors (invalid cookies)', async () => {
      const getCalls = stubProfileUnauthorized('Invalid token');

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // React Query retry:false → exactly one getProfile attempt. (The client's
      // internal 401→refresh→retry is suppressed because refresh also 401s.)
      expect(getCalls()).toBe(1);
    });

    it('should cache profile data for 5 minutes', async () => {
      const mockUser = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };
      let getCalls = 0;
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => {
          getCalls += 1;
          return HttpResponse.json({ data: mockUser });
        })
      );

      const { result, rerender } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Rerender should use cache
      rerender();

      expect(getCalls).toBe(1);
    });
  });

  describe('useLogin - Login with Cookies', () => {
    it('should login and invalidate profile cache', async () => {
      const mockResponse = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };
      server.use(
        http.post(`${base}/api/v1/auth/login`, () => HttpResponse.json({ data: mockResponse }))
      );

      // Seed stale profile data to verify invalidation clears it
      queryClient.setQueryData(['profile'], { user: { id: 'user-uuid-stale', username: 'stale' } });

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({ email: 'test@example.com', password: 'password123' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);

      // Profile cache should be invalidated.
      const cacheState = queryClient.getQueryState(['profile']);
      expect(cacheState?.isInvalidated).toBe(true);
    });

    it('should handle login errors (invalid credentials)', async () => {
      server.use(
        http.post(`${base}/api/v1/auth/login`, () =>
          HttpResponse.json(
            { message: 'Invalid email or password', status: 'error' },
            { status: 401 }
          )
        )
      );

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({ email: 'wrong@example.com', password: 'wrongpassword' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should NOT expose tokens (httpOnly cookies used)', async () => {
      const mockResponse = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
        // NO token or refreshToken in response
      };
      server.use(
        http.post(`${base}/api/v1/auth/login`, () => HttpResponse.json({ data: mockResponse }))
      );

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({ email: 'test@example.com', password: 'password123' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect((result.current.data as any)?.token).toBeUndefined();
      expect((result.current.data as any)?.refreshToken).toBeUndefined();
    });
  });

  describe('useRegister - Register with Cookies', () => {
    it('should register and invalidate profile cache', async () => {
      const mockResponse = {
        user: {
          id: 'user-uuid-newuser',
          username: 'newuser',
          email: 'new@example.com',
          money: 1000,
          level: 1,
          xp: 0,
        },
      };
      server.use(
        http.post(`${base}/api/v1/auth/register`, () => HttpResponse.json({ data: mockResponse }))
      );

      queryClient.setQueryData(['profile'], { user: { id: 'user-uuid-stale', username: 'stale' } });

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);

      const cacheState = queryClient.getQueryState(['profile']);
      expect(cacheState?.isInvalidated).toBe(true);
    });

    it('should handle registration errors (duplicate email)', async () => {
      server.use(
        http.post(`${base}/api/v1/auth/register`, () =>
          HttpResponse.json(
            { message: 'User with this email already exists', status: 'error' },
            { status: 400 }
          )
        )
      );

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toMatchObject({ statusCode: 400 });
    });
  });

  describe('useLogout - Clear Cookies', () => {
    it('should logout and clear all cached data', async () => {
      server.use(
        http.post(`${base}/api/v1/auth/logout`, () =>
          HttpResponse.json({ data: { message: 'Logout successful' } })
        )
      );

      // Seed profile cache
      queryClient.setQueryData(['profile'], {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      });

      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // onSettled calls queryClient.clear() → profile cache gone.
      const profileCache = queryClient.getQueryData(['profile']);
      expect(profileCache).toBeUndefined();
    });

    it('should call logout endpoint to clear httpOnly cookies', async () => {
      let logoutCalls = 0;
      server.use(
        http.post(`${base}/api/v1/auth/logout`, () => {
          logoutCalls += 1;
          return HttpResponse.json({ data: { message: 'Logout successful' } });
        })
      );

      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(logoutCalls).toBe(1);
    });
  });

  describe('useIsAuthenticated - Check Auth Status', () => {
    it('should return true when user is authenticated', async () => {
      const mockUser = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () => HttpResponse.json({ data: mockUser }))
      );

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('should return false when user is not authenticated', async () => {
      stubProfileUnauthorized('Invalid token');

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => expect(result.current).toBe(false));
    });

    it('should return false when profile query fails', async () => {
      server.use(
        http.get(`${base}/api/v1/auth/profile`, () =>
          HttpResponse.json({ message: 'Server error', status: 'error' }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => expect(result.current).toBe(false));
    });
  });

  describe('Security: No Token Storage', () => {
    it('should NOT store tokens in localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const mockResponse = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };
      server.use(
        http.post(`${base}/api/v1/auth/login`, () => HttpResponse.json({ data: mockResponse }))
      );

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({ email: 'test@example.com', password: 'password123' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });

    it('should NOT store tokens in sessionStorage', async () => {
      const setItemSpy = vi.spyOn(sessionStorage, 'setItem');

      const mockResponse = {
        user: { id: 'user-uuid-0001', username: 'testuser', email: 'test@example.com' },
      };
      server.use(
        http.post(`${base}/api/v1/auth/register`, () => HttpResponse.json({ data: mockResponse }))
      );

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(setItemSpy).not.toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });
});
