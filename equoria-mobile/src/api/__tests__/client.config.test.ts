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

describe('ApiClient - Configuration', () => {
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
    (secureStorage.getRefreshToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setUserId as jest.Mock).mockResolvedValue(undefined);

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

  describe('Axios Instance Configuration', () => {
    it('should create axios instance with correct baseURL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.test.com',
        })
      );
    });

    it('should create axios instance with correct timeout', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('should create axios instance with default Content-Type header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should setup request and response interceptors on initialization', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    it('should set access token in memory and storage', async () => {
      const token = 'new-access-token';

      await apiClient.setAccessToken(token);

      expect(secureStorage.setAccessToken).toHaveBeenCalledWith(token);
    });

    it('should clear tokens from memory and storage', async () => {
      await apiClient.setAccessToken('test-token');
      await apiClient.clearTokens();

      expect(secureStorage.clearAuthData).toHaveBeenCalled();
    });

    it('should attempt to load token from storage on initialization', async () => {
      // Wait for async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(secureStorage.getAccessToken).toHaveBeenCalled();
    });

    it('should handle errors during token initialization gracefully', async () => {
      // Clear mocks and set error before creating instance
      jest.clearAllMocks();
      (secureStorage.getAccessToken as jest.Mock).mockRejectedValue(
        new Error('Storage access denied')
      );

      // Create new instance with error-throwing mock
      let newClient: any;
      jest.isolateModules(() => {
        newClient = require('../client').apiClient;
      });

      // Wait for async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Client should still be defined - error is handled gracefully
      expect(newClient).toBeDefined();

      // Error should have been logged (this is implementation detail)
      // The important thing is the client still works
      expect(secureStorage.getAccessToken).toHaveBeenCalled();
    });
  });

  describe('HTTP Method Configuration', () => {
    it('should configure GET method to return response data', async () => {
      const responseData = { id: 1, name: 'Test' };
      mockAxiosInstance.get.mockResolvedValue({ data: responseData });

      const result = await apiClient.get('/users/1');

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/1', undefined);
    });

    it('should configure POST method to return response data', async () => {
      const requestData = { name: 'New Item' };
      const responseData = { id: 1, name: 'New Item' };
      mockAxiosInstance.post.mockResolvedValue({ data: responseData });

      const result = await apiClient.post('/items', requestData);

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/items', requestData, undefined);
    });

    it('should configure PUT method to return response data', async () => {
      const requestData = { name: 'Updated Item' };
      const responseData = { id: 1, name: 'Updated Item' };
      mockAxiosInstance.put.mockResolvedValue({ data: responseData });

      const result = await apiClient.put('/items/1', requestData);

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/items/1', requestData, undefined);
    });

    it('should configure DELETE method to return response data', async () => {
      const responseData = { success: true };
      mockAxiosInstance.delete.mockResolvedValue({ data: responseData });

      const result = await apiClient.delete('/items/1');

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/items/1', undefined);
    });
  });

  describe('Custom Configuration Support', () => {
    it('should support custom config in GET requests', async () => {
      const customConfig = { params: { page: 1, limit: 10 }, headers: { 'X-Custom': 'value' } };
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await apiClient.get('/items', customConfig);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items', customConfig);
    });

    it('should support custom config in POST requests', async () => {
      const customConfig = { headers: { 'X-Request-ID': '123' } };
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      await apiClient.post('/items', { name: 'Test' }, customConfig);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/items', { name: 'Test' }, customConfig);
    });

    it('should support custom config in PUT requests', async () => {
      const customConfig = { timeout: 5000 };
      mockAxiosInstance.put.mockResolvedValue({ data: { success: true } });

      await apiClient.put('/items/1', { name: 'Updated' }, customConfig);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/items/1', { name: 'Updated' }, customConfig);
    });

    it('should support custom config in DELETE requests', async () => {
      const customConfig = { params: { force: true } };
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

      await apiClient.delete('/items/1', customConfig);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/items/1', customConfig);
    });
  });
});
