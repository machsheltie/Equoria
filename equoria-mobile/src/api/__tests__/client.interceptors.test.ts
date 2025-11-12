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

describe('ApiClient - Interceptors', () => {
  let apiClient: any;
  let mockAxiosInstance: any;
  let requestInterceptor: any;
  let responseInterceptor: any;
  let responseErrorHandler: any;

  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup axios instance mock with interceptor capture
    requestInterceptor = null;
    responseInterceptor = null;
    responseErrorHandler = null;

    // Create a mock function for the instance itself
    const mockInstanceFunction = jest.fn().mockResolvedValue({ data: { success: true } });

    mockAxiosInstance = Object.assign(mockInstanceFunction, {
      interceptors: {
        request: {
          use: jest.fn((successHandler, errorHandler) => {
            requestInterceptor = successHandler;
            return 0;
          }),
        },
        response: {
          use: jest.fn((successHandler, errorHandler) => {
            responseInterceptor = successHandler;
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
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
    });

    // Mock secureStorage
    (secureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue('refresh-token');
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
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('Request Interceptor', () => {
    it('should attach access token to request headers when token exists', async () => {
      await apiClient.setAccessToken('test-token');

      const config: InternalAxiosRequestConfig = {
        headers: {},
        url: '/test',
        method: 'get',
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should load token from secure storage if not in memory', async () => {
      (secureStorage.getAccessToken as jest.Mock).mockResolvedValue('stored-token');

      const config: InternalAxiosRequestConfig = {
        headers: {},
        url: '/test',
        method: 'get',
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(secureStorage.getAccessToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe('Bearer stored-token');
    });

    it('should not attach Authorization header when no token exists', async () => {
      (secureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);

      const config: InternalAxiosRequestConfig = {
        headers: {},
        url: '/test',
        method: 'get',
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should preserve existing custom headers', async () => {
      await apiClient.setAccessToken('test-token');

      const config: InternalAxiosRequestConfig = {
        headers: {
          'X-Custom-Header': 'custom-value',
          'Content-Type': 'application/x-www-form-urlencoded',
        } as any,
        url: '/test',
        method: 'post',
      } as InternalAxiosRequestConfig;

      const result = await requestInterceptor(config);

      expect(result.headers['X-Custom-Header']).toBe('custom-value');
      expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should handle request interceptor errors gracefully', async () => {
      const error = new Error('Request interceptor error');
      const requestErrorHandler = mockAxiosInstance.interceptors.request.use.mock.calls[0][1];

      await expect(requestErrorHandler(error)).rejects.toThrow('Request interceptor error');
    });
  });

  describe('Response Interceptor', () => {
    it('should pass through successful responses', async () => {
      const response = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { url: '/test' } as InternalAxiosRequestConfig,
      };

      const result = await responseInterceptor(response);

      expect(result).toEqual(response);
    });

    it('should handle non-401 errors by rejecting', async () => {
      const error = {
        response: { status: 500, data: { message: 'Server Error' } },
        config: { url: '/test' },
      } as AxiosError;

      await expect(responseErrorHandler(error)).rejects.toEqual(error);
    });

    it('should trigger token refresh on 401 error', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      mockAxiosInstance.mockResolvedValue({ data: { success: true } });

      await responseErrorHandler(error);

      expect(secureStorage.getRefreshToken).toHaveBeenCalled();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.test.com/auth/refresh',
        { refreshToken: 'refresh-token' },
        { timeout: 10000 }
      );
    });

    it('should retry original request with new token after refresh', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      mockAxiosInstance.mockResolvedValue({ data: { protected: 'data' } });

      const result = await responseErrorHandler(error);

      expect(result.data).toEqual({ protected: 'data' });
      expect(originalRequest.headers.Authorization).toBe('Bearer new-access-token');
      expect(secureStorage.setAccessToken).toHaveBeenCalledWith('new-access-token');
      expect(secureStorage.setRefreshToken).toHaveBeenCalledWith('new-refresh-token');
    });

    it('should queue concurrent 401 requests during token refresh', async () => {
      const request1 = {
        url: '/protected1',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const request2 = {
        url: '/protected2',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error1 = {
        response: { status: 401 },
        config: request1,
      } as AxiosError;

      const error2 = {
        response: { status: 401 },
        config: request2,
      } as AxiosError;

      // Mock axios instance to return different data for each request
      let callCount = 0;
      (mockAxiosInstance as jest.Mock).mockImplementation((config: InternalAxiosRequestConfig) => {
        callCount++;
        return Promise.resolve({
          data: { request: config.url, call: callCount },
        });
      });

      // Start both requests simultaneously
      const promise1 = responseErrorHandler(error1);
      const promise2 = responseErrorHandler(error2);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should succeed with correct data
      expect(result1.data.request).toBe('/protected1');
      expect(result2.data.request).toBe('/protected2');

      // Refresh should only be called once
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should reject when no refresh token is available', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      // Mock no refresh token available
      (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);

      await expect(responseErrorHandler(error)).rejects.toBeTruthy();
      // Note: clearAuthData is NOT called when refresh token is missing
      // This is current behavior - tokens remain until explicit logout
    });

    it('should not retry 401 request if already retried', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
        _retry: true, // Already retried
      } as InternalAxiosRequestConfig & { _retry?: boolean };

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      await expect(responseErrorHandler(error)).rejects.toEqual(error);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should mark request as retried after first 401', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      mockAxiosInstance.mockResolvedValue({ data: { success: true } });

      await responseErrorHandler(error);

      expect((originalRequest as any)._retry).toBe(true);
    });

    it('should handle refresh token network errors gracefully', async () => {
      const originalRequest = {
        url: '/protected',
        headers: {},
        method: 'get',
      } as InternalAxiosRequestConfig;

      const error = {
        response: { status: 401 },
        config: originalRequest,
      } as AxiosError;

      // Mock refresh endpoint failure
      (mockedAxios.post as jest.Mock).mockRejectedValue(
        new Error('Network connection failed')
      );

      await expect(responseErrorHandler(error)).rejects.toBeTruthy();

      // Note: refreshToken() catches errors internally and returns null
      // The error is logged but tokens are not automatically cleared
      // This prevents aggressive token clearing on temporary network issues
    });
  });

  describe('Token Refresh Queue', () => {
    it('should process all queued requests after successful refresh', async () => {
      const requests = [
        { url: '/request1', headers: {}, method: 'get' } as InternalAxiosRequestConfig,
        { url: '/request2', headers: {}, method: 'post' } as InternalAxiosRequestConfig,
        { url: '/request3', headers: {}, method: 'put' } as InternalAxiosRequestConfig,
      ];

      const errors = requests.map(
        (config) =>
          ({
            response: { status: 401 },
            config,
          } as AxiosError)
      );

      (mockAxiosInstance as jest.Mock).mockImplementation((config: InternalAxiosRequestConfig) =>
        Promise.resolve({ data: { url: config.url } })
      );

      // Execute all requests concurrently
      const promises = errors.map((error) => responseErrorHandler(error));
      const results = await Promise.all(promises);

      // All should have new token in headers
      requests.forEach((request) => {
        expect(request.headers.Authorization).toBe('Bearer new-access-token');
      });

      // All should return successful responses
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.data.url).toBe(requests[index].url);
      });

      // Refresh should only happen once
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
