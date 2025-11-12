import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../../utils/secureStorage';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/secureStorage');
jest.mock('../../config/env', () => ({
  env: {
    apiBaseUrl: 'https://api.test.com',
    apiTimeout: 10000,
    enableLogging: false,
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiClient - Integration Tests', () => {
  let apiClient: any;
  let mockAxiosInstance: any;
  let requestInterceptor: any;
  let responseErrorHandler: any;

  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup axios instance mock with interceptor capture
    requestInterceptor = null;
    responseErrorHandler = null;

    const mockInstanceFunction = jest.fn().mockResolvedValue({ data: { success: true } });

    mockAxiosInstance = Object.assign(mockInstanceFunction, {
      interceptors: {
        request: {
          use: jest.fn((successHandler) => {
            requestInterceptor = successHandler;
            return 0;
          }),
        },
        response: {
          use: jest.fn((successHandler, errorHandler) => {
            responseErrorHandler = errorHandler;
            return 0;
          }),
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    });

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    (mockedAxios.post as jest.Mock).mockResolvedValue({
      data: { accessToken: 'refreshed-token', refreshToken: 'new-refresh-token' },
    });

    // Mock secureStorage
    (secureStorage.getAccessToken as jest.Mock).mockResolvedValue('valid-token');
    (secureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue('valid-refresh-token');
    (secureStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);

    // Import fresh instance
    jest.isolateModules(() => {
      const { apiClient: client } = require('../client');
      apiClient = client;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('End-to-End Authentication Flow', () => {
    it('should complete full login flow with token storage', async () => {
      const loginResponse = {
        user: { id: '1', email: 'user@test.com' },
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: loginResponse });

      const result = await apiClient.post('/auth/login', {
        email: 'user@test.com',
        password: 'password123',
      });

      expect(result).toEqual(loginResponse);

      // Now set the token as would happen in the login mutation
      await apiClient.setAccessToken(loginResponse.accessToken);

      expect(secureStorage.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should complete full token refresh flow with queued requests', async () => {
      const request1Config = {
        url: '/protected/resource1',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const request2Config = {
        url: '/protected/resource2',
        headers: {},
        method: 'post',
      } as InternalAxiosRequestConfig;

      const error1 = {
        response: { status: 401 },
        config: request1Config,
      } as AxiosError;

      const error2 = {
        response: { status: 401 },
        config: request2Config,
      } as AxiosError;

      // Mock successful responses after refresh
      let callCount = 0;
      (mockAxiosInstance as jest.Mock).mockImplementation((config: InternalAxiosRequestConfig) => {
        callCount++;
        return Promise.resolve({ data: { resource: config.url, attempt: callCount } });
      });

      // Execute both 401 errors simultaneously
      const [result1, result2] = await Promise.all([
        responseErrorHandler(error1),
        responseErrorHandler(error2),
      ]);

      // Both should succeed
      expect(result1.data.resource).toBe('/protected/resource1');
      expect(result2.data.resource).toBe('/protected/resource2');

      // Refresh should only happen once
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.test.com/auth/refresh',
        { refreshToken: 'valid-refresh-token' },
        { timeout: 10000 }
      );

      // New tokens should be stored
      expect(secureStorage.setAccessToken).toHaveBeenCalledWith('refreshed-token');
      expect(secureStorage.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
    });

    it('should complete full logout flow with token cleanup', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await apiClient.post('/auth/logout');
      await apiClient.clearTokens();

      expect(secureStorage.clearAuthData).toHaveBeenCalled();
    });
  });

  describe('Multi-Request Scenarios', () => {
    it('should handle multiple concurrent authenticated requests', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { items: [] } });

      const requests = [
        apiClient.get('/users'),
        apiClient.get('/posts'),
        apiClient.get('/comments'),
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toEqual({ items: [] });
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed HTTP method requests concurrently', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { items: [] } });
      mockAxiosInstance.post.mockResolvedValue({ data: { created: true } });
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: true } });
      mockAxiosInstance.delete.mockResolvedValue({ data: { deleted: true } });

      const results = await Promise.all([
        apiClient.get('/users'),
        apiClient.post('/users', { name: 'New User' }),
        apiClient.put('/users/1', { name: 'Updated' }),
        apiClient.delete('/users/2'),
      ]);

      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({ items: [] });
      expect(results[1]).toEqual({ created: true });
      expect(results[2]).toEqual({ updated: true });
      expect(results[3]).toEqual({ deleted: true });
    });
  });

  describe('Error Recovery Patterns', () => {
    it('should recover from transient network errors with retry', async () => {
      let attemptCount = 0;
      mockAxiosInstance.get.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({ data: { success: true } });
      });

      // First call fails
      await expect(apiClient.get('/test')).rejects.toThrow('Network timeout');

      // Second call succeeds (simulating retry)
      const result = await apiClient.get('/test');
      expect(result).toEqual({ success: true });
    });

    it('should handle service degradation gracefully', async () => {
      const errors = [
        { status: 503, message: 'Service Unavailable' },
        { status: 429, message: 'Too Many Requests' },
        { status: 500, message: 'Internal Server Error' },
      ];

      for (const error of errors) {
        mockAxiosInstance.get.mockRejectedValue({
          response: { status: error.status, data: { message: error.message } },
        } as AxiosError);

        await expect(apiClient.get('/test')).rejects.toMatchObject({
          response: { status: error.status },
        });
      }
    });

    it('should maintain functionality after auth failure and re-login', async () => {
      // Simulate expired token scenario
      const error = {
        response: { status: 401 },
        config: { url: '/protected', headers: {}, method: 'get' } as InternalAxiosRequestConfig,
      } as AxiosError;

      // Mock refresh failure (no refresh token)
      (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);

      // Should reject the request
      await expect(responseErrorHandler(error)).rejects.toBeTruthy();

      // Simulate re-login
      await apiClient.setAccessToken('new-login-token');
      (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue('new-refresh-token');

      // Should now be able to make requests again
      mockAxiosInstance.get.mockResolvedValue({ data: { success: true } });
      const result = await apiClient.get('/protected');

      expect(result).toEqual({ success: true });
    });
  });

  describe('Custom Header Preservation', () => {
    it('should preserve custom headers through interceptors', async () => {
      await apiClient.setAccessToken('test-token');

      const customConfig = {
        headers: {
          'X-Request-ID': '123',
          'X-Client-Version': '1.0.0',
        },
      };

      const config = {
        ...customConfig,
        headers: customConfig.headers as any,
        url: '/test',
        method: 'get',
      } as InternalAxiosRequestConfig;

      const processedConfig = await requestInterceptor(config);

      // Should have both custom headers and auth header
      expect(processedConfig.headers['X-Request-ID']).toBe('123');
      expect(processedConfig.headers['X-Client-Version']).toBe('1.0.0');
      expect(processedConfig.headers.Authorization).toBe('Bearer test-token');
    });

    it('should preserve custom headers through token refresh', async () => {
      const customHeaders = {
        'X-Trace-ID': 'trace-123',
        'X-Custom': 'value',
      };

      const originalRequest = {
        url: '/protected',
        headers: customHeaders as any,
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      mockAxiosInstance.mockResolvedValue({ data: { success: true } });

      await responseErrorHandler(error);

      // Custom headers should still be present
      expect(originalRequest.headers['X-Trace-ID']).toBe('trace-123');
      expect(originalRequest.headers['X-Custom']).toBe('value');
      // And auth header should be updated
      expect(originalRequest.headers.Authorization).toBe('Bearer refreshed-token');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve request and response data types', async () => {
      const requestData = {
        name: 'Test User',
        age: 30,
        active: true,
        metadata: { key: 'value' },
      };

      const responseData = {
        id: '123',
        ...requestData,
        createdAt: '2025-01-01T00:00:00Z',
      };

      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await apiClient.post('/users', requestData);

      expect(result).toEqual(responseData);
      expect(typeof result.id).toBe('string');
      expect(typeof result.name).toBe('string');
      expect(typeof result.age).toBe('number');
      expect(typeof result.active).toBe('boolean');
      expect(typeof result.metadata).toBe('object');
    });

    it('should handle complex nested data structures', async () => {
      const complexData = {
        user: {
          profile: {
            name: 'Test',
            settings: {
              theme: 'dark',
              notifications: ['email', 'push'],
            },
          },
        },
        metadata: [{ key: 'value1' }, { key: 'value2' }],
      };

      mockAxiosInstance.post.mockResolvedValue({ data: complexData });

      const result = await apiClient.post('/complex', complexData);

      expect(result).toEqual(complexData);
      expect(result.user.profile.settings.notifications).toHaveLength(2);
      expect(result.metadata[0].key).toBe('value1');
    });
  });
});
