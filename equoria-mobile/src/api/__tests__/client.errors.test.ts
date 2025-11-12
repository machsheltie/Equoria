import axios, { AxiosError } from 'axios';
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

describe('ApiClient - Error Handling', () => {
  let apiClient: any;
  let mockAxiosInstance: any;

  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup axios instance mock
    mockAxiosInstance = {
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    // Mock secureStorage
    (secureStorage.getAccessToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);

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

  describe('Network Errors', () => {
    it('should handle network connection errors', async () => {
      const networkError = Object.assign(new Error('Network Error'), {
        code: 'ECONNREFUSED',
        isAxiosError: true,
      }) as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(apiClient.get('/test')).rejects.toThrow('Network Error');
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND api.test.com'), {
        code: 'ENOTFOUND',
        isAxiosError: true,
      }) as AxiosError;

      mockAxiosInstance.post.mockRejectedValue(dnsError);

      await expect(apiClient.post('/test', {})).rejects.toThrow('getaddrinfo ENOTFOUND');
    });

    it('should handle request timeout errors', async () => {
      const timeoutError = Object.assign(new Error('timeout of 10000ms exceeded'), {
        code: 'ECONNABORTED',
        isAxiosError: true,
      }) as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(apiClient.get('/slow-endpoint')).rejects.toThrow('timeout');
    });

    it('should handle connection refused errors', async () => {
      const refusedError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), {
        code: 'ECONNREFUSED',
        isAxiosError: true,
      }) as AxiosError;

      mockAxiosInstance.put.mockRejectedValue(refusedError);

      await expect(apiClient.put('/test', {})).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('HTTP Error Codes', () => {
    it('should handle 400 Bad Request errors', async () => {
      const badRequestError = {
        response: {
          status: 400,
          data: { message: 'Invalid request body' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.post.mockRejectedValue(badRequestError);

      await expect(apiClient.post('/users', { invalid: 'data' })).rejects.toMatchObject({
        response: { status: 400 },
      });
    });

    it('should handle 403 Forbidden errors', async () => {
      const forbiddenError = {
        response: {
          status: 403,
          data: { message: 'Insufficient permissions' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(forbiddenError);

      await expect(apiClient.get('/admin/users')).rejects.toMatchObject({
        response: { status: 403 },
      });
    });

    it('should handle 404 Not Found errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Resource not found' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      await expect(apiClient.get('/users/999')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it('should handle 500 Internal Server Error', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.post.mockRejectedValue(serverError);

      await expect(apiClient.post('/users', {})).rejects.toMatchObject({
        response: { status: 500 },
      });
    });

    it('should handle 502 Bad Gateway errors', async () => {
      const badGatewayError = {
        response: {
          status: 502,
          data: { message: 'Bad gateway' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(badGatewayError);

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        response: { status: 502 },
      });
    });

    it('should handle 503 Service Unavailable errors', async () => {
      const serviceUnavailableError = {
        response: {
          status: 503,
          data: { message: 'Service temporarily unavailable' },
        },
        isAxiosError: true,
      } as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(serviceUnavailableError);

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        response: { status: 503 },
      });
    });
  });

  describe('Response Data Errors', () => {
    it('should handle malformed JSON responses', async () => {
      const jsonError = Object.assign(new Error('Unexpected token < in JSON at position 0'), {
        isAxiosError: true,
        response: {
          status: 200,
          data: '<html>Error</html>',
        },
      }) as AxiosError;

      mockAxiosInstance.get.mockRejectedValue(jsonError);

      await expect(apiClient.get('/test')).rejects.toThrow('Unexpected token');
    });

    it('should handle empty response bodies gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: null });

      const result = await apiClient.get('/test');

      expect(result).toBeNull();
    });

    it('should handle undefined response data', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: undefined });

      const result = await apiClient.get('/test');

      expect(result).toBeUndefined();
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors from GET requests', async () => {
      const error = new Error('GET request failed');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(apiClient.get('/test')).rejects.toThrow('GET request failed');
    });

    it('should propagate errors from POST requests', async () => {
      const error = new Error('POST request failed');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(apiClient.post('/test', {})).rejects.toThrow('POST request failed');
    });

    it('should propagate errors from PUT requests', async () => {
      const error = new Error('PUT request failed');
      mockAxiosInstance.put.mockRejectedValue(error);

      await expect(apiClient.put('/test', {})).rejects.toThrow('PUT request failed');
    });

    it('should propagate errors from DELETE requests', async () => {
      const error = new Error('DELETE request failed');
      mockAxiosInstance.delete.mockRejectedValue(error);

      await expect(apiClient.delete('/test')).rejects.toThrow('DELETE request failed');
    });
  });
});
