import { testApiConnection } from '../test';
import { apiClient } from '../client';

// Mock the API client
jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe('testApiConnection', () => {
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('successful connection', () => {
    it('should return true when API responds with status ok', async () => {
      const mockResponse = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00Z',
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(apiClient.get).toHaveBeenCalledWith('/health');
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('API Health Check:', mockResponse);
      expect(result).toBe(true);
    });

    it('should return true when API responds with status ok without timestamp', async () => {
      const mockResponse = {
        status: 'ok',
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(result).toBe(true);
    });
  });

  describe('failed connection', () => {
    it('should return false when API responds with status not ok', async () => {
      const mockResponse = {
        status: 'error',
        message: 'Service unavailable',
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(console.log).toHaveBeenCalledWith('API Health Check:', mockResponse);
      expect(result).toBe(false);
    });

    it('should return false when API responds with different status', async () => {
      const mockResponse = {
        status: 'degraded',
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });

    it('should return false when status is missing', async () => {
      const mockResponse = {
        message: 'No status field',
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });
  });

  describe('network errors', () => {
    it('should return false and log error when network request fails', async () => {
      const error = new Error('Network error');
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const result = await testApiConnection();

      expect(console.error).toHaveBeenCalledWith('API Connection Failed:', error);
      expect(result).toBe(false);
    });

    it('should return false when request times out', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      (apiClient.get as jest.Mock).mockRejectedValue(timeoutError);

      const result = await testApiConnection();

      expect(console.error).toHaveBeenCalledWith('API Connection Failed:', timeoutError);
      expect(result).toBe(false);
    });

    it('should return false when server returns 500 error', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      };
      (apiClient.get as jest.Mock).mockRejectedValue(serverError);

      const result = await testApiConnection();

      expect(console.error).toHaveBeenCalledWith('API Connection Failed:', serverError);
      expect(result).toBe(false);
    });

    it('should return false when server returns 404 error', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { error: 'Not Found' },
        },
      };
      (apiClient.get as jest.Mock).mockRejectedValue(notFoundError);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });

    it('should return false when connection is refused', async () => {
      const connectionError = new Error('ECONNREFUSED');
      (apiClient.get as jest.Mock).mockRejectedValue(connectionError);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });
  });

  describe('response validation', () => {
    it('should validate response structure correctly', async () => {
      const responses = [
        { status: 'ok', expected: true },
        { status: 'OK', expected: false }, // Case sensitive
        { status: 'ok ', expected: false }, // Whitespace
        { status: ' ok', expected: false }, // Leading whitespace
        { STATUS: 'ok', expected: false }, // Wrong key
      ];

      for (const { status, expected } of responses) {
        jest.clearAllMocks();
        (apiClient.get as jest.Mock).mockResolvedValue({ status });

        const result = await testApiConnection();

        expect(result).toBe(expected);
      }
    });

    it('should handle empty response object', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({});

      const result = await testApiConnection();

      expect(result).toBe(false);
    });

    it('should handle null response', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(null);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });

    it('should handle undefined response', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(undefined);

      const result = await testApiConnection();

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle response with additional fields', async () => {
      const mockResponse = {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00Z',
        version: '1.0.0',
        environment: 'production',
        extra: { data: 'value' },
      };

      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await testApiConnection();

      expect(result).toBe(true);
    });

    it('should call apiClient.get exactly once per invocation', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ status: 'ok' });

      await testApiConnection();
      await testApiConnection();

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
