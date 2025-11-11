import Constants from 'expo-constants';

// Mock expo-constants before importing env
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'https://test-api.example.com/api',
    },
  },
}));

describe('env configuration', () => {
  // Store original __DEV__ value
  const originalDev = global.__DEV__;

  afterEach(() => {
    // Restore original __DEV__ value
    global.__DEV__ = originalDev;
    // Clear module cache to allow re-importing with different __DEV__ values
    jest.resetModules();
  });

  describe('development environment', () => {
    beforeEach(() => {
      global.__DEV__ = true;
      jest.resetModules();
    });

    it('should load configuration with custom apiUrl from Constants.expoConfig.extra', () => {
      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('https://test-api.example.com/api');
      expect(env.apiTimeout).toBe(10000);
      expect(env.env).toBe('development');
      expect(env.debug).toBe(true);
      expect(env.enableDevTools).toBe(true);
      expect(env.enableLogging).toBe(true);
    });

    it('should enable all development features when __DEV__ is true', () => {
      const { env } = require('../env');

      expect(env.debug).toBe(true);
      expect(env.enableDevTools).toBe(true);
      expect(env.enableLogging).toBe(true);
      expect(env.env).toBe('development');
    });
  });

  describe('production environment', () => {
    beforeEach(() => {
      global.__DEV__ = false;
      jest.resetModules();
    });

    it('should disable development features when __DEV__ is false', () => {
      const { env } = require('../env');

      expect(env.debug).toBe(false);
      expect(env.enableDevTools).toBe(false);
      expect(env.enableLogging).toBe(false);
      expect(env.env).toBe('production');
    });

    it('should still use custom apiUrl in production', () => {
      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('https://test-api.example.com/api');
    });
  });

  describe('default values', () => {
    beforeEach(() => {
      global.__DEV__ = true;
      // Mock Constants with missing extra
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        expoConfig: {},
      }));
    });

    it('should use default apiBaseUrl when Constants.expoConfig.extra is undefined', () => {
      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('http://localhost:3000/api');
      expect(env.apiTimeout).toBe(10000);
    });

    it('should use default apiBaseUrl when Constants.expoConfig.extra.apiUrl is undefined', () => {
      jest.doMock('expo-constants', () => ({
        expoConfig: {
          extra: {},
        },
      }));

      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('http://localhost:3000/api');
    });
  });

  describe('null/undefined expoConfig handling', () => {
    beforeEach(() => {
      global.__DEV__ = true;
    });

    it('should handle null expoConfig', () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({
        expoConfig: null,
      }));

      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('http://localhost:3000/api');
      expect(env.apiTimeout).toBe(10000);
    });

    it('should handle undefined expoConfig', () => {
      jest.resetModules();
      jest.doMock('expo-constants', () => ({}));

      const { env } = require('../env');

      expect(env.apiBaseUrl).toBe('http://localhost:3000/api');
      expect(env.apiTimeout).toBe(10000);
    });
  });

  describe('configuration values', () => {
    beforeEach(() => {
      global.__DEV__ = true;
      jest.resetModules();
    });

    it('should have correct timeout value', () => {
      const { env } = require('../env');

      expect(env.apiTimeout).toBe(10000);
      expect(typeof env.apiTimeout).toBe('number');
    });

    it('should have correct env type values', () => {
      const { env } = require('../env');

      expect(['development', 'staging', 'production']).toContain(env.env);
    });

    it('should have boolean values for feature flags', () => {
      const { env } = require('../env');

      expect(typeof env.debug).toBe('boolean');
      expect(typeof env.enableDevTools).toBe('boolean');
      expect(typeof env.enableLogging).toBe('boolean');
    });
  });
});
