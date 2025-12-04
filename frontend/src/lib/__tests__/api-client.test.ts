/**
 * Unit Tests: Frontend API Client
 *
 * Tests the httpOnly cookie-based API client
 * Verifies credentials: 'include' and proper error handling
 *
 * Phase 1, Day 1-2: HttpOnly Cookie Migration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, authApi } from '../api-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client - HttpOnly Cookie Support', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchWithAuth - Credentials Configuration', () => {
    it('should include credentials: "include" in all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { success: true } }),
      });

      await apiClient.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should send httpOnly cookies automatically with credentials: "include"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { user: { id: 1 } } }),
      });

      await apiClient.get('/api/auth/profile');

      // Verify credentials: 'include' is set (browser automatically sends cookies)
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs?.credentials).toBe('include');
    });

    it('should NOT manually set Cookie header (browser handles this)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await apiClient.get('/api/test');

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs?.headers as Record<string, string>;

      // API client should NOT set Cookie header manually
      expect(headers?.Cookie).toBeUndefined();
      expect(headers?.cookie).toBeUndefined();
    });
  });

  describe('API Methods - Cookie Support', () => {
    it('GET request should include credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { items: [] } }),
      });

      await apiClient.get('/api/items');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('POST request should include credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 1 } }),
      });

      await apiClient.post('/api/items', { name: 'Test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/items'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ name: 'Test' }),
        })
      );
    });

    it('PUT request should include credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 1, name: 'Updated' } }),
      });

      await apiClient.put('/api/items/1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          credentials: 'include',
        })
      );
    });

    it('DELETE request should include credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await apiClient.delete('/api/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
    });
  });

  describe('Authentication API - Cookie-Based Auth', () => {
    describe('authApi.login', () => {
      it('should send credentials and NOT expect tokens in response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              user: {
                id: 1,
                email: 'test@example.com',
                username: 'testuser',
              },
              // NO token or refreshToken in response (httpOnly cookies instead)
            },
          }),
        });

        const result = await authApi.login({
          email: 'test@example.com',
          password: 'password123',
        });

        // Verify credentials: 'include'
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/login'),
          expect.objectContaining({
            credentials: 'include',
          })
        );

        // Verify response contains user but NO tokens
        expect(result.user).toBeDefined();
        expect(result.user.id).toBe(1);
        expect((result as any).token).toBeUndefined();
        expect((result as any).refreshToken).toBeUndefined();
      });
    });

    describe('authApi.register', () => {
      it('should send credentials and NOT expect tokens in response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            status: 'success',
            data: {
              user: {
                id: 1,
                username: 'newuser',
                email: 'new@example.com',
                money: 1000,
                level: 1,
                xp: 0,
              },
            },
          }),
        });

        const result = await authApi.register({
          username: 'newuser',
          email: 'new@example.com',
          password: 'password123',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/register'),
          expect.objectContaining({
            credentials: 'include',
          })
        );

        expect(result.user).toBeDefined();
        expect((result as any).token).toBeUndefined();
      });
    });

    describe('authApi.getProfile', () => {
      it('should use httpOnly cookies for authentication (no Authorization header)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            data: {
              user: {
                id: 1,
                username: 'testuser',
                email: 'test@example.com',
              },
            },
          }),
        });

        await authApi.getProfile();

        const callArgs = mockFetch.mock.calls[0][1];
        const headers = callArgs?.headers as Record<string, string>;

        // Should NOT have Authorization header (uses cookies instead)
        expect(headers?.Authorization).toBeUndefined();
        expect(headers?.authorization).toBeUndefined();

        // Should have credentials: 'include'
        expect(callArgs?.credentials).toBe('include');
      });
    });

    describe('authApi.logout', () => {
      it('should send request to clear httpOnly cookies', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            message: 'Logout successful',
          }),
        });

        const result = await authApi.logout();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/logout'),
          expect.objectContaining({
            method: 'POST',
            credentials: 'include',
          })
        );

        expect(result.message).toBe('Logout successful');
      });
    });

    describe('authApi.refreshToken', () => {
      it('should use httpOnly refreshToken cookie automatically', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'success',
            message: 'Token refreshed successfully',
          }),
        });

        await authApi.refreshToken();

        const callArgs = mockFetch.mock.calls[0][1];

        // Should NOT send refresh token in body (uses httpOnly cookie)
        expect(callArgs?.body).toBeUndefined();

        // Should have credentials: 'include'
        expect(callArgs?.credentials).toBe('include');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized (invalid/expired cookies)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Invalid or expired token',
          status: 'error',
        }),
      });

      await expect(apiClient.get('/api/auth/profile')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Session expired. Please log in again.',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.get('/api/test')).rejects.toMatchObject({
        message: 'Network error',
        statusCode: 0,
      });
    });

    it('should handle 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: 'Insufficient permissions',
          status: 'error',
        }),
      });

      await expect(apiClient.get('/api/admin/users')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Insufficient permissions',
      });
    });
  });

  describe('Security: No Token Exposure', () => {
    it('should NEVER include tokens in request headers (uses cookies)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await apiClient.get('/api/auth/profile');

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs?.headers as Record<string, string>;

      // Verify NO token-related headers
      expect(headers?.Authorization).toBeUndefined();
      expect(headers?.authorization).toBeUndefined();
      expect(headers?.Token).toBeUndefined();
      expect(headers?.['X-Auth-Token']).toBeUndefined();
    });

    it('should NOT store tokens in localStorage (XSS protection)', () => {
      // This test verifies the API client never touches localStorage
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { user: { id: 1 } } }),
      });

      apiClient.get('/api/auth/profile');

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(getItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('Content-Type Headers', () => {
    it('should set Content-Type: application/json for POST requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 1 } }),
      });

      await apiClient.post('/api/items', { name: 'Test' });

      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs?.headers as Record<string, string>;

      expect(headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('Base URL Configuration', () => {
    it('should use environment variable for API base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      await apiClient.get('/api/test');

      const url = mockFetch.mock.calls[0][0];

      // Should construct full URL
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain('/api/test');
    });
  });
});
