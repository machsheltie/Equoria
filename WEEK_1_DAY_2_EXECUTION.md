# Week 1 Day 2: State Management Implementation

**Date:** 2025-11-11
**Status:** Ready to Begin
**Prerequisites:** Day 1 Complete ✅

---

## Overview

Day 2 focuses on implementing comprehensive state management using Redux Toolkit for client state and React Query for server state. This dual-state approach provides optimal performance and developer experience.

---

## Objectives

1. **Redux Toolkit Setup**
   - Configure store with proper middleware
   - Create authentication slice
   - Create app configuration slice
   - Implement Redux Persist for offline support

2. **React Query Setup**
   - Configure QueryClient
   - Set up query dev tools
   - Create custom hooks for API queries
   - Implement caching strategy

3. **Testing**
   - Write comprehensive tests for all slices
   - Test Redux Persist integration
   - Test React Query hooks
   - Achieve 80%+ coverage

---

## Architecture

### State Management Strategy

```
┌─────────────────────────────────────────┐
│         Application State               │
├─────────────────────────────────────────┤
│                                         │
│  CLIENT STATE (Redux Toolkit)           │
│  ├── Authentication (tokens, user)      │
│  ├── App Config (theme, language)       │
│  └── UI State (modals, loading)         │
│                                         │
│  SERVER STATE (React Query)              │
│  ├── Horses (cached API data)           │
│  ├── Competitions (cached API data)     │
│  ├── Training (cached API data)         │
│  └── Breeding (cached API data)         │
│                                         │
└─────────────────────────────────────────┘
```

### Why Two State Libraries?

- **Redux Toolkit**: Perfect for client-side state (auth, UI preferences, app config)
- **React Query**: Specialized for server state (automatic caching, refetching, invalidation)
- **Benefits**: Each tool optimized for its purpose, less boilerplate, better performance

---

## Step 1: Redux Toolkit Setup

### 1.1 Create Redux Store

**File:** `src/state/store.ts`

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer from './slices/authSlice';
import appReducer from './slices/appSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'app'], // Only persist these reducers
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, {
  auth: authReducer,
  app: appReducer,
});

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 1.2 Create Auth Slice

**File:** `src/state/slices/authSlice.ts`

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true, // True initially while checking persisted state
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = authSlice.actions;
export default authSlice.reducer;
```

### 1.3 Create App Slice

**File:** `src/state/slices/appSlice.ts`

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark' | 'system';
type Language = 'en' | 'es' | 'fr';

interface AppState {
  theme: Theme;
  language: Language;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

const initialState: AppState = {
  theme: 'system',
  language: 'en',
  notificationsEnabled: true,
  soundEnabled: true,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    toggleNotifications: (state) => {
      state.notificationsEnabled = !state.notificationsEnabled;
    },
    toggleSound: (state) => {
      state.soundEnabled = !state.soundEnabled;
    },
  },
});

export const { setTheme, setLanguage, toggleNotifications, toggleSound } = appSlice.actions;
export default appSlice.reducer;
```

### 1.4 Create Redux Hooks

**File:** `src/state/hooks.ts`

```typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

---

## Step 2: React Query Setup

### 2.1 Configure QueryClient

**File:** `src/state/queryClient.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 2.2 Create API Query Hooks

**File:** `src/api/queries/auth.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { useAppDispatch } from '../../state/hooks';
import { setUser, clearUser } from '../../state/slices/authSlice';
import { secureStorage } from '../../utils/secureStorage';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  accessToken: string;
  refreshToken: string;
}

export const useLogin = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      return response;
    },
    onSuccess: async (data) => {
      // Store tokens securely
      await secureStorage.setAccessToken(data.accessToken);
      await secureStorage.setRefreshToken(data.refreshToken);
      await secureStorage.setUserId(data.user.id);

      // Update API client
      await apiClient.setAccessToken(data.accessToken);

      // Update Redux state
      dispatch(setUser(data.user));

      // Invalidate all queries to refetch with new auth
      queryClient.invalidateQueries();
    },
  });
};

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: async () => {
      // Clear tokens
      await secureStorage.clearAuthData();
      await apiClient.clearTokens();

      // Clear Redux state
      dispatch(clearUser());

      // Clear all queries
      queryClient.clear();
    },
  });
};
```

---

## Step 3: Provider Setup

### 3.1 Update App.tsx

**File:** `App.tsx`

```typescript
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { store, persistor } from './src/state/store';
import { queryClient } from './src/state/queryClient';

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <View style={styles.container}>
            <Text style={styles.title}>Equoria Mobile</Text>
            <Text style={styles.subtitle}>State Management Configured ✅</Text>
            <StatusBar style="auto" />
          </View>
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#10B981',
  },
});
```

---

## Step 4: Testing

### 4.1 Test Auth Slice

**File:** `src/state/slices/__tests__/authSlice.test.ts`

```typescript
import authReducer, { setUser, clearUser, setLoading } from '../authSlice';

describe('authSlice', () => {
  const initialState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };

  it('should return initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle setUser', () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };
    const actual = authReducer(initialState, setUser(user));
    expect(actual.user).toEqual(user);
    expect(actual.isAuthenticated).toBe(true);
    expect(actual.isLoading).toBe(false);
  });

  it('should handle clearUser', () => {
    const stateWithUser = {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      isAuthenticated: true,
      isLoading: false,
    };
    const actual = authReducer(stateWithUser, clearUser());
    expect(actual.user).toBeNull();
    expect(actual.isAuthenticated).toBe(false);
    expect(actual.isLoading).toBe(false);
  });

  it('should handle setLoading', () => {
    const actual = authReducer(initialState, setLoading(false));
    expect(actual.isLoading).toBe(false);
  });
});
```

### 4.2 Test App Slice

**File:** `src/state/slices/__tests__/appSlice.test.ts`

Similar structure to authSlice tests.

### 4.3 Test React Query Hooks

**File:** `src/api/queries/__tests__/auth.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from '../../../state/store';
import { useLogin } from '../auth';
import { apiClient } from '../../client';

jest.mock('../../client');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );
};

describe('useLogin', () => {
  it('should login successfully', async () => {
    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
    };

    (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      email: 'test@example.com',
      password: 'password',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
  });
});
```

---

## Verification Checklist

- [ ] Redux store configured with persist
- [ ] Auth slice created and tested
- [ ] App slice created and tested
- [ ] Redux hooks exported
- [ ] QueryClient configured
- [ ] Auth query hooks created
- [ ] App.tsx updated with providers
- [ ] All tests passing (80%+ coverage)
- [ ] TypeScript errors: 0
- [ ] App renders with state management

---

## Success Criteria

1. **All tests pass** - 80%+ coverage on all new code
2. **TypeScript compiles** - Zero errors
3. **Redux DevTools working** - Can inspect state
4. **Persist works** - State survives app reload
5. **React Query works** - Mutations and queries functional

---

## Estimated Time

- Redux Setup: 1 hour
- React Query Setup: 45 minutes
- Testing: 1.5 hours
- Integration & Debugging: 45 minutes

**Total:** ~4 hours

---

## Next Steps (Day 3)

- Navigation system (React Navigation)
- Screen components structure
- Route configuration
- Deep linking setup

---

**Ready to begin Day 2!** 🚀
