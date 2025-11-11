import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage utility for sensitive data using expo-secure-store
 * Uses hardware-backed encryption on supported devices
 */

const KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER_ID: 'auth_user_id',
} as const;

export const secureStorage = {
  /**
   * Store access token securely
   */
  async setAccessToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('Error storing access token:', error);
      throw error;
    }
  },

  /**
   * Retrieve access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  },

  /**
   * Store refresh token securely
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw error;
    }
  },

  /**
   * Retrieve refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error retrieving refresh token:', error);
      return null;
    }
  },

  /**
   * Store user ID
   */
  async setUserId(userId: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.USER_ID, userId);
    } catch (error) {
      console.error('Error storing user ID:', error);
      throw error;
    }
  },

  /**
   * Retrieve user ID
   */
  async getUserId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(KEYS.USER_ID);
    } catch (error) {
      console.error('Error retrieving user ID:', error);
      return null;
    }
  },

  /**
   * Clear all authentication data (logout)
   */
  async clearAuthData(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.USER_ID),
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  },

  /**
   * Check if user is authenticated (has access token)
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  },
};
