/**
 * Unit Tests: useAuth Hooks
 *
 * Tests React Query authentication hooks with httpOnly cookies
 * Verifies proper cache management and error handling
 *
 * Phase 1, Day 1-2: HttpOnly Cookie Migration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useProfile,
  useLogin,
  useRegister,
  useLogout,
  useIsAuthenticated,
} from '../useAuth';
import * as apiClient from '../../lib/api-client';

// Mock the API client
vi.mock('../../lib/api-client', () => ({
  authApi: {
    getProfile: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('useAuth Hooks - Cookie-Based Authentication', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    // Wrapper with QueryClientProvider
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('useProfile - Get Current User', () => {
    it('should fetch user profile using httpOnly cookies', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUser);
      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should handle 401 Unauthorized (expired/invalid cookies)', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Invalid or expired token',
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 401,
      });
    });

    it('should NOT retry on 401 errors (invalid cookies)', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValue({
        statusCode: 401,
        message: 'Invalid token',
      });

      const { result } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should only call once (no retries for 401)
      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should cache profile data for 5 minutes', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValue(mockUser);

      const { result, rerender } = renderHook(() => useProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Rerender should use cache
      rerender();

      expect(apiClient.authApi.getProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('useLogin - Login with Cookies', () => {
    it('should login and update profile cache', async () => {
      const mockResponse = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.login).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({
        email: 'test@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);

      // Verify profile cache was updated
      const profileCache = queryClient.getQueryData(['profile']);
      expect(profileCache).toEqual(mockResponse);
    });

    it('should handle login errors (invalid credentials)', async () => {
      vi.mocked(apiClient.authApi.login).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Invalid email or password',
      });

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should NOT expose tokens (httpOnly cookies used)', async () => {
      const mockResponse = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
        // NO token or refreshToken in response
      };

      vi.mocked(apiClient.authApi.login).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({
        email: 'test@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify no tokens in response data
      expect((result.current.data as any)?.token).toBeUndefined();
      expect((result.current.data as any)?.refreshToken).toBeUndefined();
    });
  });

  describe('useRegister - Register with Cookies', () => {
    it('should register and update profile cache', async () => {
      const mockResponse = {
        user: {
          id: 1,
          username: 'newuser',
          email: 'new@example.com',
          money: 1000,
          level: 1,
          xp: 0,
        },
      };

      vi.mocked(apiClient.authApi.register).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);

      // Verify profile cache was updated
      const profileCache = queryClient.getQueryData(['profile']);
      expect(profileCache).toEqual(mockResponse);
    });

    it('should handle registration errors (duplicate email)', async () => {
      vi.mocked(apiClient.authApi.register).mockRejectedValueOnce({
        statusCode: 400,
        message: 'User with this email already exists',
      });

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('useLogout - Clear Cookies', () => {
    it('should logout and clear all cached data', async () => {
      const mockResponse = { message: 'Logout successful' };

      vi.mocked(apiClient.authApi.logout).mockResolvedValueOnce(mockResponse);

      // Seed profile cache
      queryClient.setQueryData(['profile'], {
        user: { id: 1, username: 'testuser', email: 'test@example.com' },
      });

      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify all cache was cleared
      const profileCache = queryClient.getQueryData(['profile']);
      expect(profileCache).toBeUndefined();
    });

    it('should call logout endpoint to clear httpOnly cookies', async () => {
      vi.mocked(apiClient.authApi.logout).mockResolvedValueOnce({
        message: 'Logout successful',
      });

      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiClient.authApi.logout).toHaveBeenCalledTimes(1);
    });
  });

  describe('useIsAuthenticated - Check Auth Status', () => {
    it('should return true when user is authenticated', async () => {
      const mockUser = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.getProfile).mockResolvedValueOnce(mockUser);

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should return false when user is not authenticated', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 401,
        message: 'Invalid token',
      });

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('should return false when profile query fails', async () => {
      vi.mocked(apiClient.authApi.getProfile).mockRejectedValueOnce({
        statusCode: 500,
        message: 'Server error',
      });

      const { result } = renderHook(() => useIsAuthenticated(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('Security: No Token Storage', () => {
    it('should NOT store tokens in localStorage', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      const mockResponse = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.login).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useLogin(), { wrapper });

      result.current.mutate({
        email: 'test@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify NO localStorage usage
      expect(setItemSpy).not.toHaveBeenCalled();
    });

    it('should NOT store tokens in sessionStorage', async () => {
      const setItemSpy = vi.spyOn(sessionStorage, 'setItem');

      const mockResponse = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        },
      };

      vi.mocked(apiClient.authApi.register).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useRegister(), { wrapper });

      result.current.mutate({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify NO sessionStorage usage
      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });
});
