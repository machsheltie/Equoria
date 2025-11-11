import Constants from 'expo-constants';

interface EnvironmentConfig {
  apiBaseUrl: string;
  apiTimeout: number;
  env: 'development' | 'staging' | 'production';
  debug: boolean;
  enableDevTools: boolean;
  enableLogging: boolean;
}

const getEnvConfig = (): EnvironmentConfig => {
  const extra = Constants.expoConfig?.extra || {};

  return {
    apiBaseUrl: extra.apiUrl || 'http://localhost:3000/api',
    apiTimeout: 10000,
    env: __DEV__ ? 'development' : 'production',
    debug: __DEV__,
    enableDevTools: __DEV__,
    enableLogging: __DEV__,
  };
};

export const env = getEnvConfig();
