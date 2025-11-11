// Simplified API client tests focusing on public API and behavior
import axios from 'axios';
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

describe('ApiClient - Public API', () => {
  let apiClient: any;
  let mockAxiosInstance: any;

  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();

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
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);

    // Import fresh instance
    jest.isolateModules(() => {
      const { apiClient: client } = require('../client');
      apiClient = client;
    });
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('initialization', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.test.com',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should setup interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('setAccessToken', () => {
    it('should set access token and store it securely', async () => {
      const token = 'test-token';
      await apiClient.setAccessToken(token);

      expect(secureStorage.setAccessToken).toHaveBeenCalledWith(token);
    });
  });

  describe('clearTokens', () => {
    it('should clear all authentication data', async () => {
      await apiClient.clearTokens();

      expect(secureStorage.clearAuthData).toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    describe('get', () => {
      it('should make GET request and return data', async () => {
        const responseData = { id: 1, name: 'Test' };
        mockAxiosInstance.get.mockResolvedValue({ data: responseData });

        const result = await apiClient.get('/users/1');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/1', undefined);
        expect(result).toEqual(responseData);
      });

      it('should pass config to GET request', async () => {
        const config = { params: { page: 1 } };
        mockAxiosInstance.get.mockResolvedValue({ data: [] });

        await apiClient.get('/users', config);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users', config);
      });

      it('should handle GET request errors', async () => {
        mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

        await expect(apiClient.get('/users')).rejects.toThrow('Network error');
      });
    });

    describe('post', () => {
      it('should make POST request and return data', async () => {
        const requestData = { name: 'New User' };
        const responseData = { id: 1, name: 'New User' };
        mockAxiosInstance.post.mockResolvedValue({ data: responseData });

        const result = await apiClient.post('/users', requestData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/users', requestData, undefined);
        expect(result).toEqual(responseData);
      });

      it('should handle POST request errors', async () => {
        mockAxiosInstance.post.mockRejectedValue(new Error('Validation error'));

        await expect(apiClient.post('/users', {})).rejects.toThrow('Validation error');
      });
    });

    describe('put', () => {
      it('should make PUT request and return data', async () => {
        const requestData = { name: 'Updated User' };
        const responseData = { id: 1, name: 'Updated User' };
        mockAxiosInstance.put.mockResolvedValue({ data: responseData });

        const result = await apiClient.put('/users/1', requestData);

        expect(mockAxiosInstance.put).toHaveBeenCalledWith('/users/1', requestData, undefined);
        expect(result).toEqual(responseData);
      });

      it('should handle PUT request errors', async () => {
        mockAxiosInstance.put.mockRejectedValue(new Error('Update failed'));

        await expect(apiClient.put('/users/1', {})).rejects.toThrow('Update failed');
      });
    });

    describe('delete', () => {
      it('should make DELETE request and return data', async () => {
        const responseData = { success: true };
        mockAxiosInstance.delete.mockResolvedValue({ data: responseData });

        const result = await apiClient.delete('/users/1');

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/users/1', undefined);
        expect(result).toEqual(responseData);
      });

      it('should handle DELETE request errors', async () => {
        mockAxiosInstance.delete.mockRejectedValue(new Error('Delete failed'));

        await expect(apiClient.delete('/users/1')).rejects.toThrow('Delete failed');
      });
    });
  });

  describe('initialization behavior', () => {
    it('should attempt to load token from secure storage on initialization', async () => {
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(secureStorage.getAccessToken).toHaveBeenCalled();
    });
  });
});
