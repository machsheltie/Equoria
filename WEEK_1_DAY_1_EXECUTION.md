# Week 1 Day 1 Execution - Project Initialization

**Date:** 2025-11-10
**Phase:** Foundation Setup - Day 1
**Estimated Time:** 8-10 hours
**Status:** Ready to Begin

---

## Overview

Today we'll initialize the React Native + Expo project with a complete folder structure, TypeScript configuration, and API client setup.

---

## Pre-Flight Checklist

### Environment Verification

**Required Software:**
- [ ] Node.js 18+ or 20+ installed
- [ ] npm 9+ installed
- [ ] Git installed and configured
- [ ] Expo CLI installed globally
- [ ] VS Code with React Native extensions (recommended)

**Optional (for device testing):**
- [ ] iOS Simulator (macOS only)
- [ ] Android Emulator configured
- [ ] Physical device with Expo Go app

**Backend Verification:**
- [ ] Backend server running at http://localhost:3000
- [ ] API health endpoint responding
- [ ] PostgreSQL database accessible

---

## Task 1: Initialize Expo Project (2-3 hours)

### Step 1.1: Create New Expo Project

**Command:**
```bash
# Navigate to project root
cd C:\Users\heirr\OneDrive\Desktop\Equoria

# Create frontend directory
npx create-expo-app@latest equoria-mobile --template blank-typescript

# Navigate to new project
cd equoria-mobile
```

**Expected Output:**
```
✔ Downloaded and extracted project files.
✔ Installed JavaScript dependencies.

✅ Your project is ready!

To run your project, navigate to the directory and run one of the following npm commands.

- cd equoria-mobile
- npm start # you can open iOS, Android, or web from here, or run them directly with the commands below.
- npm run android
- npm run ios
- npm run web
```

---

### Step 1.2: Verify Project Structure

**Expected Initial Structure:**
```
equoria-mobile/
├── App.tsx                 # Main app component
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── node_modules/          # Installed packages
└── assets/                # Images, fonts, etc.
```

**Verification Commands:**
```bash
# Check Node version
node --version

# Check npm version
npm --version

# Check project files exist
ls -la

# Verify TypeScript config
cat tsconfig.json
```

---

### Step 1.3: Install Core Dependencies

**Navigation & State Management:**
```bash
# React Navigation
npm install @react-navigation/native
npm install @react-navigation/native-stack
npm install @react-navigation/bottom-tabs
npm install @react-navigation/drawer
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler react-native-reanimated

# State Management
npm install @reduxjs/toolkit react-redux
npm install redux-persist
npm install @react-native-async-storage/async-storage

# Server State
npm install @tanstack/react-query

# API Client
npm install axios

# Forms
npm install react-hook-form
npm install yup
npm install @hookform/resolvers
```

**Development Dependencies:**
```bash
# Testing
npm install --save-dev @testing-library/react-native
npm install --save-dev @testing-library/jest-native
npm install --save-dev jest-expo

# Code Quality
npm install --save-dev eslint prettier
npm install --save-dev @typescript-eslint/eslint-plugin
npm install --save-dev @typescript-eslint/parser

# DevTools
npm install --save-dev @tanstack/react-query-devtools
```

**Installation Time:** ~5-10 minutes depending on network speed

---

### Step 1.4: Configure TypeScript (tsconfig.json)

**Enhanced TypeScript Configuration:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-native",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@screens/*": ["src/screens/*"],
      "@navigation/*": ["src/navigation/*"],
      "@state/*": ["src/state/*"],
      "@api/*": ["src/api/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"],
      "@constants/*": ["src/constants/*"],
      "@hooks/*": ["src/hooks/*"],
      "@theme/*": ["src/theme/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

### Step 1.5: Configure Babel (babel.config.js)

**Enhanced Babel Configuration:**
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@state': './src/state',
            '@api': './src/api',
            '@utils': './src/utils',
            '@types': './src/types',
            '@constants': './src/constants',
            '@hooks': './src/hooks',
            '@theme': './src/theme'
          }
        }
      ]
    ]
  };
};
```

**Install Babel Plugin:**
```bash
npm install --save-dev babel-plugin-module-resolver
```

---

### Step 1.6: Create Folder Structure

**Complete Directory Structure:**
```bash
mkdir -p src/screens/auth
mkdir -p src/screens/horses
mkdir -p src/screens/training
mkdir -p src/screens/competition
mkdir -p src/screens/breeding
mkdir -p src/screens/profile
mkdir -p src/components/common
mkdir -p src/components/forms
mkdir -p src/components/layouts
mkdir -p src/components/navigation
mkdir -p src/navigation
mkdir -p src/state/slices
mkdir -p src/api
mkdir -p src/utils
mkdir -p src/types
mkdir -p src/constants
mkdir -p src/hooks
mkdir -p src/theme
```

**Verification:**
```bash
# List directory structure
tree src -L 2

# Or on Windows:
dir src /s /b
```

---

### Step 1.7: Configure ESLint (.eslintrc.js)

**Create ESLint Configuration:**
```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    'react-native/react-native': true,
    es6: true,
    node: true
  },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

**Install ESLint Plugins:**
```bash
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks
```

---

### Step 1.8: Configure Prettier (.prettierrc)

**Create Prettier Configuration:**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "auto",
  "bracketSpacing": true,
  "jsxBracketSameLine": false,
  "jsxSingleQuote": false
}
```

---

### Step 1.9: Update package.json Scripts

**Add Useful Scripts:**
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\"",
    "type-check": "tsc --noEmit"
  }
}
```

---

### Step 1.10: Configure app.json

**Enhanced Expo Configuration:**
```json
{
  "expo": {
    "name": "Equoria",
    "slug": "equoria",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1E40AF"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.equoria.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1E40AF"
      },
      "package": "com.equoria.app"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "apiUrl": "http://localhost:3000/api"
    }
  }
}
```

---

## Task 2: Environment Configuration (2 hours)

### Step 2.1: Install Environment Variables Package

```bash
npm install expo-constants
npm install dotenv
npm install --save-dev @types/node
```

---

### Step 2.2: Create Environment Files

**.env.local (Development):**
```env
# API Configuration
API_BASE_URL=http://localhost:3000/api
API_TIMEOUT=10000

# Environment
ENV=development
DEBUG=true

# Feature Flags
ENABLE_DEV_TOOLS=true
ENABLE_LOGGING=true
```

**.env.production:**
```env
# API Configuration
API_BASE_URL=https://api.equoria.com/api
API_TIMEOUT=10000

# Environment
ENV=production
DEBUG=false

# Feature Flags
ENABLE_DEV_TOOLS=false
ENABLE_LOGGING=false
```

**.gitignore (Update):**
```
# Environment variables
.env
.env.local
.env.*.local
```

---

### Step 2.3: Create Environment Config (src/config/env.ts)

```typescript
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
```

---

### Step 2.4: Create API Client (src/api/client.ts)

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from '../config/env';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: env.apiBaseUrl,
      timeout: env.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        if (env.enableLogging) {
          console.log('API Request:', config.method?.toUpperCase(), config.url);
        }

        return config;
      },
      (error) => {
        if (env.enableLogging) {
          console.error('API Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        if (env.enableLogging) {
          console.log('API Response:', response.status, response.config.url);
        }
        return response;
      },
      async (error) => {
        if (env.enableLogging) {
          console.error('API Response Error:', error.response?.status, error.config?.url);
        }

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          // Try to refresh token
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry original request
            return this.instance.request(error.config);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    // TODO: Get token from AsyncStorage
    return null;
  }

  private async refreshToken(): Promise<boolean> {
    // TODO: Implement token refresh logic
    return false;
  }

  // Generic request methods
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.get(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.post(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.put(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

---

### Step 2.5: Test API Connection (src/api/test.ts)

```typescript
import { apiClient } from './client';

export const testApiConnection = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get<{ status: string }>('/health');
    console.log('API Health Check:', response);
    return response.status === 'ok';
  } catch (error) {
    console.error('API Connection Failed:', error);
    return false;
  }
};
```

---

## Task 3: Initial App Setup (2-3 hours)

### Step 3.1: Update App.tsx

```typescript
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { useEffect, useState } from 'react';
import { testApiConnection } from './src/api/test';

export default function App() {
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiConnection();
  }, []);

  const checkApiConnection = async () => {
    const connected = await testApiConnection();
    setApiConnected(connected);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equoria Mobile</Text>
      <Text style={styles.subtitle}>Horse Breeding Simulation</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>API Status:</Text>
        <Text style={[
          styles.statusValue,
          { color: apiConnected ? '#10B981' : '#EF4444' }
        ]}>
          {apiConnected === null ? 'Checking...' : apiConnected ? 'Connected ✓' : 'Disconnected ✗'}
        </Text>
      </View>

      <Button title="Retry Connection" onPress={checkApiConnection} />

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1E40AF',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
```

---

### Step 3.2: Create Config Directory

```bash
mkdir src/config
```

---

## Day 1 Verification Checklist

### Project Setup
- [ ] Expo project created successfully
- [ ] All dependencies installed (no errors)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)

### Folder Structure
- [ ] All directories created (screens, components, navigation, state, api, etc.)
- [ ] Path aliases working in TypeScript
- [ ] Import statements resolve correctly

### Configuration
- [ ] tsconfig.json configured with strict mode
- [ ] babel.config.js configured with path resolver
- [ ] .eslintrc.js configured
- [ ] .prettierrc configured
- [ ] app.json updated with app details

### Environment & API
- [ ] Environment configuration working
- [ ] API client created
- [ ] Axios interceptors setup
- [ ] Test API connection working

### Testing
- [ ] App runs on iOS simulator (or Expo Go)
- [ ] App runs on Android emulator (or Expo Go)
- [ ] Hot reload working
- [ ] No console errors or warnings
- [ ] API connection test shows status

---

## Common Issues & Solutions

### Issue 1: Module Resolution Errors
**Symptom:** "Cannot find module '@/components/...'"
**Solution:**
```bash
# Clear metro cache
npx expo start --clear

# Or
rm -rf node_modules
npm install
```

### Issue 2: TypeScript Path Alias Not Working
**Symptom:** TypeScript can't resolve path aliases
**Solution:** Ensure babel-plugin-module-resolver is installed and babel.config.js matches tsconfig.json paths

### Issue 3: API Connection Fails
**Symptom:** "Network request failed" or timeout
**Solution:**
- Verify backend is running at http://localhost:3000
- Check firewall settings
- On Android emulator, use http://10.0.2.2:3000 instead of localhost
- On iOS simulator, localhost should work

### Issue 4: Expo Start Fails
**Symptom:** "Unable to start server"
**Solution:**
```bash
# Clear Expo cache
npx expo start --clear

# Kill any processes on port 19000
npx kill-port 19000

# Restart
npm start
```

---

## End of Day 1 Deliverables

**Code:**
- ✅ React Native + Expo project initialized
- ✅ TypeScript strict mode configured
- ✅ Complete folder structure created
- ✅ API client with interceptors
- ✅ Environment configuration
- ✅ ESLint and Prettier configured

**Documentation:**
- ✅ This execution guide
- ✅ Configuration files documented
- ✅ Common issues documented

**Testing:**
- ✅ App runs on at least one platform
- ✅ Hot reload verified
- ✅ API connection tested
- ✅ No critical errors

---

## Next Steps (Day 2)

Tomorrow we'll tackle:
1. Redux Toolkit setup with auth slice
2. React Query configuration
3. AsyncStorage for persistence
4. Token management utilities

**Estimated Time:** 8-10 hours

---

**Day 1 Status:** Ready to Execute
**Time Estimate:** 8-10 hours
**Complexity:** Medium (setup and configuration)

**Let's begin! Start with Step 1.1 to create the Expo project.**
