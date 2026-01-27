# Day 3 Implementation Plan

## API Client Testing + Navigation System

**Date:** 2025-11-11
**Status:** Ready to Begin
**Day 2 Status:** Complete - 134/134 tests passing, Grade A+ (4.86/5)
**Estimated Time:** 10-12 hours
**Target Tests:** 160+ passing tests
**Target Coverage:** 80%+ overall

---

## Executive Summary

Day 3 focuses on two critical objectives:

1. **Address Day 2 Recommendations** - Fix test warnings and significantly improve API client test coverage (currently 31.5%, target 80%+)
2. **Navigation System Setup** - Implement React Navigation v7 with type-safe navigation structure

This plan incorporates recommendations from the Day 2 technical review and maintains our TDD-first approach.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Address Day 2 Recommendations](#phase-1-address-day-2-recommendations)
3. [Phase 2: API Client Comprehensive Testing](#phase-2-api-client-comprehensive-testing)
4. [Phase 3: Navigation System Setup](#phase-3-navigation-system-setup)
5. [Phase 4: Screen Templates](#phase-4-screen-templates)
6. [Phase 5: Integration & Quality Assurance](#phase-5-integration--quality-assurance)
7. [Success Criteria](#success-criteria)
8. [Risk Mitigation](#risk-mitigation)

---

## Prerequisites

### ✅ Day 2 Completion Checklist

- [x] Redux store configured with persistence
- [x] Auth slice with 100% test coverage (19 tests)
- [x] App slice with 100% test coverage (26 tests)
- [x] React Query configured
- [x] useLogin/useLogout hooks with tests (8 tests)
- [x] All providers integrated in App.tsx
- [x] 134/134 tests passing
- [x] Zero TypeScript errors
- [x] Technical review complete (Grade A+)

### 📋 Day 3 Requirements

- Node.js 18+
- npm 9+
- All Day 2 dependencies installed
- Test suite passing
- MCP servers online (9/9 verified)

---

## Phase 1: Address Day 2 Recommendations

**Priority:** CRITICAL
**Time Estimate:** 1-2 hours
**Effort:** Low-Medium

### 1.1 Fix Test Warnings

**Issue:** act() warnings in App.test.tsx and auth query tests
**Root Cause:** Async state updates not wrapped in act()

**Solution:**

```typescript
// __tests__/App.test.tsx
import { act } from '@testing-library/react-native';

it('should handle async state updates', async () => {
  await act(async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'test@test.com', password: 'pass' });
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});
```

**Files to Update:**

- `__tests__/App.test.tsx` (fix 12+ act warnings)
- `src/api/queries/__tests__/auth.test.tsx` (fix 2+ act warnings)

**Testing:**

```bash
npm test -- --verbose
# Verify no act() warnings appear
```

### 1.2 Fix Memory Leak Warnings

**Issue:** Worker process not exiting gracefully
**Root Cause:** Jest timers and async operations not properly cleaned up

**Solution:**

```typescript
// Add to each test file
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
```

**Files to Update:**

- Add cleanup to all test files
- Configure Jest to handle async cleanup

**Expected Outcome:**

- Clean test output with no warnings
- Faster test execution
- Proper resource cleanup

---

## Phase 2: API Client Comprehensive Testing

**Priority:** HIGH
**Time Estimate:** 4-6 hours
**Effort:** High
**Target Coverage:** 80%+ (currently 31.5%)

### 2.1 Test Plan Overview

**Current Coverage:**

```
src/api/client.ts
  Statements: 31.5%
  Branches: 20%
  Functions: 40%
  Lines: 31.5%
```

**Target Coverage:**

```
src/api/client.ts
  Statements: 80%+
  Branches: 75%+
  Functions: 85%+
  Lines: 80%+
```

### 2.2 Request Interceptors Testing

**Test File:** `src/api/__tests__/client.interceptors.test.ts`

**Test Cases:**

1. **Token Injection**

   ```typescript
   it('should inject access token into requests', async () => {
     await secureStorage.setAccessToken('test-token');
     const request = { headers: {} };

     const result = await requestInterceptor(request);

     expect(result.headers.Authorization).toBe('Bearer test-token');
   });
   ```

2. **Token Refresh on 401**

   ```typescript
   it('should refresh token on 401 response', async () => {
     mockApiClient.post.mockRejectedValueOnce({ status: 401 });
     mockApiClient.post.mockResolvedValueOnce({
       accessToken: 'new-token',
       refreshToken: 'new-refresh',
     });

     await makeRequest();

     expect(secureStorage.setAccessToken).toHaveBeenCalledWith('new-token');
     expect(requestRetry).toHaveBeenCalled();
   });
   ```

3. **Token Refresh Failure**

   ```typescript
   it('should clear auth and redirect on refresh failure', async () => {
     mockApiClient.post.mockRejectedValue({ status: 401 });

     await expect(makeRequest()).rejects.toThrow();

     expect(secureStorage.clearAuthData).toHaveBeenCalled();
     expect(store.dispatch).toHaveBeenCalledWith(clearUser());
   });
   ```

### 2.3 Error Handling Testing

**Test File:** `src/api/__tests__/client.errors.test.ts`

**Test Cases:**

1. **Network Errors**
2. **Timeout Errors**
3. **4xx Client Errors**
4. **5xx Server Errors**
5. **Retry Logic**
6. **Max Retry Exceeded**

### 2.4 Configuration Testing

**Test File:** `src/api/__tests__/client.config.test.ts`

**Test Cases:**

1. **Base URL Configuration**
2. **Timeout Configuration**
3. **Headers Configuration**
4. **Custom Instance Creation**

### 2.5 Implementation Checklist

**Test Files to Create:**

- [ ] `src/api/__tests__/client.interceptors.test.ts`
- [ ] `src/api/__tests__/client.errors.test.ts`
- [ ] `src/api/__tests__/client.config.test.ts`
- [ ] `src/api/__tests__/client.integration.test.ts`

**Total New Tests:** ~40-50 tests
**Coverage Increase:** +48.5% (31.5% → 80%+)

---

## Phase 3: Navigation System Setup

**Priority:** MEDIUM-HIGH
**Time Estimate:** 3-4 hours
**Effort:** Medium

### 3.1 Install Dependencies

```bash
npm install @react-navigation/native@^7.1.19 \
  @react-navigation/native-stack@^7.6.2 \
  @react-navigation/drawer@^7.7.2 \
  react-native-screens@^4.18.0 \
  react-native-safe-area-context@^5.6.2 \
  react-native-gesture-handler@^2.29.1

npm install --save-dev @types/react-navigation
```

### 3.2 Navigation Type Definitions

**File:** `src/navigation/types.ts`

```typescript
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DrawerScreenProps } from '@react-navigation/drawer';

// Root Stack Navigator (Handles Auth vs Main flow)
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Auth Stack Navigator
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Main App Stack Navigator
export type MainStackParamList = {
  Tabs: undefined;
  HorseDetail: { horseId: string };
  BreedingSession: { horseId: string };
};

// Bottom Tabs Navigator
export type TabsParamList = {
  Dashboard: undefined;
  Stables: undefined;
  Breeding: undefined;
  Profile: undefined;
};

// Type-safe navigation props
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainStackScreenProps<T extends keyof MainStackParamList> = NativeStackScreenProps<
  MainStackParamList,
  T
>;

// Declare global navigation types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
```

### 3.3 Navigation Configuration

**File:** `src/navigation/config.ts`

```typescript
import { DefaultTheme, Theme } from '@react-navigation/native';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E40AF',
    background: '#FFFFFF',
    card: '#F9FAFB',
    text: '#111827',
    border: '#E5E7EB',
  },
};

export const screenOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: '#1E40AF',
  },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
};
```

### 3.4 Navigator Structure

**File:** `src/navigation/RootNavigator.tsx`

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '../state/hooks';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from './types';
import { navigationTheme } from './config';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**File:** `src/navigation/AuthNavigator.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { screenOptions } from './config';

// Import screens (to be created in Phase 4)
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={screenOptions}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
```

**File:** `src/navigation/MainNavigator.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import TabNavigator from './TabNavigator';

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {/* Additional screens will be added in Week 2+ */}
    </Stack.Navigator>
  );
}
```

### 3.5 Navigation Testing

**File:** `src/navigation/__tests__/RootNavigator.test.tsx`

```typescript
describe('RootNavigator', () => {
  it('should render Auth navigator when not authenticated', () => {
    // Mock unauthenticated state
    const { getByText } = render(<RootNavigator />);
    expect(getByText(/Welcome/i)).toBeTruthy();
  });

  it('should render Main navigator when authenticated', () => {
    // Mock authenticated state
    const { getByText } = render(<RootNavigator />);
    expect(getByText(/Dashboard/i)).toBeTruthy();
  });

  it('should handle navigation state changes', () => {
    // Test navigation flow
  });
});
```

---

## Phase 4: Screen Templates

**Priority:** MEDIUM
**Time Estimate:** 2-3 hours
**Effort:** Medium

### 4.1 Base Screen Component

**File:** `src/components/common/Screen.tsx`

```typescript
import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: any;
}

export default function Screen({ children, scrollable = false, style }: ScreenProps) {
  const Container = scrollable ? ScrollView : View;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Container style={[styles.container, style]}>
        {children}
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    padding: 16,
  },
});
```

### 4.2 Loading State Component

**File:** `src/components/common/Loading.tsx`

```typescript
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoadingProps {
  message?: string;
}

export default function Loading({ message }: LoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1E40AF" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
});
```

### 4.3 Error State Component

**File:** `src/components/common/ErrorMessage.tsx`

```typescript
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oops! Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Try Again" onPress={onRetry} color="#1E40AF" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
});
```

### 4.4 Placeholder Screens

Create minimal placeholder screens for all navigation routes:

**Auth Screens:**

- `src/screens/auth/WelcomeScreen.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/RegisterScreen.tsx`
- `src/screens/auth/ForgotPasswordScreen.tsx`

**Main Screens:**

- `src/screens/main/DashboardScreen.tsx`
- `src/screens/main/StablesScreen.tsx`
- `src/screens/main/BreedingScreen.tsx`
- `src/screens/main/ProfileScreen.tsx`

**Template Structure:**

```typescript
import React from 'react';
import { View, Text } from 'react-native';
import Screen from '../../components/common/Screen';

export default function WelcomeScreen() {
  return (
    <Screen>
      <Text>Welcome Screen - Coming in Day 4</Text>
    </Screen>
  );
}
```

---

## Phase 5: Integration & Quality Assurance

**Priority:** CRITICAL
**Time Estimate:** 1-2 hours
**Effort:** Low

### 5.1 Update App.tsx

Replace current App.tsx content with navigation:

```typescript
import RootNavigator from './src/navigation/RootNavigator';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { store, persistor } from './src/state/store';
import { queryClient } from './src/state/queryClient';
import Loading from './src/components/common/Loading';

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loading message="Loading app..." />} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}
```

### 5.2 Run Comprehensive Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint
npm run lint
```

### 5.3 Quality Checks

- [ ] All tests passing (target: 160+)
- [ ] Coverage 80%+ overall
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] No console warnings
- [ ] Navigation working in simulator

---

## Success Criteria

### Mandatory (Must Complete)

- [x] All Day 2 test warnings fixed
- [ ] API client test coverage 80%+
- [ ] Token refresh logic fully tested
- [ ] Interceptors comprehensively tested
- [ ] React Navigation v7 installed & configured
- [ ] Navigation types fully defined
- [ ] Auth & Main navigators working
- [ ] Screen templates created
- [ ] All tests passing (160+)
- [ ] Zero TypeScript errors

### Optional (Nice to Have)

- [ ] Navigation DevTools integrated
- [ ] Deep linking configured
- [ ] Navigation performance optimized
- [ ] Additional error boundaries

---

## Risk Mitigation

### Risk 1: API Client Testing Complexity

**Mitigation:**

- Break tests into smaller, focused files
- Use TDD approach (tests first)
- Leverage existing test patterns from Day 2
- Estimated time includes buffer for complexity

### Risk 2: Navigation Type Safety

**Mitigation:**

- Follow React Navigation v7 official TypeScript guide
- Use strict type checking
- Test navigation flows thoroughly
- Add type tests where needed

### Risk 3: Test Coverage Regression

**Mitigation:**

- Run coverage checks frequently
- Don't merge until 80%+ maintained
- Add tests for any uncovered code
- Use coverage reports to guide testing

---

## Timeline

| Phase                 | Duration   | Start | End   |
| --------------------- | ---------- | ----- | ----- |
| Phase 1: Fix Warnings | 1-2h       | T+0h  | T+2h  |
| Phase 2: API Testing  | 4-6h       | T+2h  | T+8h  |
| Phase 3: Navigation   | 3-4h       | T+8h  | T+12h |
| Phase 4: Screens      | 2-3h       | T+12h | T+15h |
| Phase 5: QA           | 1-2h       | T+15h | T+17h |
| **Total**             | **11-17h** |       |       |

---

## Commit Strategy

### Commit 1: Fix Day 2 Warnings

```
fix: Clean up test warnings and improve memory management

- Wrap async state updates in act()
- Add proper test cleanup
- Fix memory leak warnings
- Improve test isolation

Tests: 134/134 passing, no warnings
```

### Commit 2: API Client Comprehensive Testing

```
test: Add comprehensive API client test coverage

- Test request interceptors
- Test token refresh logic
- Test error handling
- Test retry mechanisms
- Achieve 80%+ API client coverage

Tests: 170+/170+ passing
Coverage: API client 80%+
```

### Commit 3: Navigation System Setup

```
feat: Implement React Navigation v7 with type-safe routing

- Install React Navigation dependencies
- Configure navigation types
- Setup Auth and Main navigators
- Create screen templates
- Integrate with App.tsx

Tests: 175+/175+ passing
Coverage: Maintained 80%+
```

---

## Post-Day 3 Checklist

- [ ] All phases complete
- [ ] All tests passing
- [ ] Coverage reports generated
- [ ] Git commits pushed
- [ ] Day 3 technical review requested
- [ ] Day 4 plan initiated

---

**Next:** Day 4 - Authentication Screens Implementation
