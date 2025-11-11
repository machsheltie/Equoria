import * as SecureStore from 'expo-secure-store';
import { secureStorage } from '../secureStorage';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('secureStorage', () => {
  // Mock console to avoid noise in test output
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  describe('setAccessToken', () => {
    it('should store access token successfully', async () => {
      const token = 'test-access-token';
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await secureStorage.setAccessToken(token);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_access_token', token);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if SecureStore fails', async () => {
      const token = 'test-access-token';
      const error = new Error('SecureStore error');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(error);

      await expect(secureStorage.setAccessToken(token)).rejects.toThrow('SecureStore error');
      expect(console.error).toHaveBeenCalledWith('Error storing access token:', error);
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve access token successfully', async () => {
      const token = 'test-access-token';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(token);

      const result = await secureStorage.getAccessToken();

      expect(result).toBe(token);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_access_token');
      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should return null if token does not exist', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await secureStorage.getAccessToken();

      expect(result).toBeNull();
    });

    it('should return null and log error if SecureStore fails', async () => {
      const error = new Error('SecureStore error');
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(error);

      const result = await secureStorage.getAccessToken();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error retrieving access token:', error);
    });
  });

  describe('setRefreshToken', () => {
    it('should store refresh token successfully', async () => {
      const token = 'test-refresh-token';
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await secureStorage.setRefreshToken(token);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_refresh_token', token);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if SecureStore fails', async () => {
      const token = 'test-refresh-token';
      const error = new Error('SecureStore error');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(error);

      await expect(secureStorage.setRefreshToken(token)).rejects.toThrow('SecureStore error');
      expect(console.error).toHaveBeenCalledWith('Error storing refresh token:', error);
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve refresh token successfully', async () => {
      const token = 'test-refresh-token';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(token);

      const result = await secureStorage.getRefreshToken();

      expect(result).toBe(token);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_refresh_token');
      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should return null if token does not exist', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await secureStorage.getRefreshToken();

      expect(result).toBeNull();
    });

    it('should return null and log error if SecureStore fails', async () => {
      const error = new Error('SecureStore error');
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(error);

      const result = await secureStorage.getRefreshToken();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error retrieving refresh token:', error);
    });
  });

  describe('setUserId', () => {
    it('should store user ID successfully', async () => {
      const userId = 'user-123';
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await secureStorage.setUserId(userId);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth_user_id', userId);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if SecureStore fails', async () => {
      const userId = 'user-123';
      const error = new Error('SecureStore error');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(error);

      await expect(secureStorage.setUserId(userId)).rejects.toThrow('SecureStore error');
      expect(console.error).toHaveBeenCalledWith('Error storing user ID:', error);
    });
  });

  describe('getUserId', () => {
    it('should retrieve user ID successfully', async () => {
      const userId = 'user-123';
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(userId);

      const result = await secureStorage.getUserId();

      expect(result).toBe(userId);
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('auth_user_id');
      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it('should return null if user ID does not exist', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await secureStorage.getUserId();

      expect(result).toBeNull();
    });

    it('should return null and log error if SecureStore fails', async () => {
      const error = new Error('SecureStore error');
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(error);

      const result = await secureStorage.getUserId();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error retrieving user ID:', error);
    });
  });

  describe('clearAuthData', () => {
    it('should clear all authentication data successfully', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await secureStorage.clearAuthData();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_refresh_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_user_id');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
    });

    it('should throw error if SecureStore fails', async () => {
      const error = new Error('SecureStore error');
      (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValue(error);

      await expect(secureStorage.clearAuthData()).rejects.toThrow('SecureStore error');
      expect(console.error).toHaveBeenCalledWith('Error clearing auth data:', error);
    });

    it('should throw error if any deletion fails in Promise.all', async () => {
      const error = new Error('Deletion failed');
      (SecureStore.deleteItemAsync as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error);

      await expect(secureStorage.clearAuthData()).rejects.toThrow('Deletion failed');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if access token exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test-token');

      const result = await secureStorage.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false if access token is null', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await secureStorage.isAuthenticated();

      expect(result).toBe(false);
    });

    it('should return false if getAccessToken returns null due to error', async () => {
      const error = new Error('SecureStore error');
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(error);

      const result = await secureStorage.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
