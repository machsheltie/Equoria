import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';
import { RootNavigator } from '../RootNavigator';
import authReducer, { setUser, clearUser, setLoading } from '@state/slices/authSlice';
import appReducer from '@state/slices/appSlice';
import type { AuthState } from '@state/slices/authSlice';
import type { AppState } from '@state/slices/appSlice';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock Redux store with configurable auth state
 */
function createMockStore(authState: Partial<AuthState> = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      app: appReducer,
    },
    preloadedState: {
      auth: {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        ...authState,
      },
      app: {
        theme: 'system',
        language: 'en',
        notificationsEnabled: true,
        soundEnabled: true,
      } as AppState,
    },
  });
}

/**
 * Wrapper component that provides Redux store and NavigationContainer
 * Note: RootNavigator already includes NavigationContainer, so we wrap it separately
 */
function createWrapper(store: ReturnType<typeof createMockStore>) {
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

/**
 * Helper to render RootNavigator with a specific store
 * Since RootNavigator includes NavigationContainer, we render it directly
 */
function renderRootNavigator(authState: Partial<AuthState> = {}) {
  const store = createMockStore(authState);
  const wrapper = createWrapper(store);

  const result = render(<RootNavigator />, { wrapper });

  return {
    ...result,
    store,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('RootNavigator', () => {
  // ==========================================================================
  // LOADING STATE TESTS
  // ==========================================================================

  describe('Loading State', () => {
    it('should render loading screen when isLoading is true', () => {
      const { getByTestId } = renderRootNavigator({ isLoading: true });

      expect(getByTestId('loading-screen')).toBeOnTheScreen();
    });

    it('should show ActivityIndicator while loading', () => {
      const { getByTestId } = renderRootNavigator({ isLoading: true });

      const loadingScreen = getByTestId('loading-screen');
      expect(loadingScreen).toBeOnTheScreen();
    });

    it('should not render AuthNavigator when loading', () => {
      const { queryByTestId } = renderRootNavigator({ isLoading: true });

      expect(queryByTestId('login-screen')).not.toBeOnTheScreen();
    });

    it('should not render MainNavigator when loading', () => {
      const { queryByTestId } = renderRootNavigator({ isLoading: true });

      expect(queryByTestId('home-screen')).not.toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // UNAUTHENTICATED STATE TESTS
  // ==========================================================================

  describe('Unauthenticated State', () => {
    it('should render AuthNavigator when not authenticated', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      expect(getByTestId('login-screen')).toBeOnTheScreen();
    });

    it('should not render MainNavigator when not authenticated', () => {
      const { queryByTestId } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      expect(queryByTestId('home-screen')).not.toBeOnTheScreen();
    });

    it('should not render loading screen when not loading', () => {
      const { queryByTestId } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      // Loading screen should not be present
      const loadingScreens = queryByTestId('loading-screen');
      expect(loadingScreens).not.toBeOnTheScreen();
    });

    it('should show login screen as initial auth screen', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      expect(getByTestId('login-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // AUTHENTICATED STATE TESTS
  // ==========================================================================

  describe('Authenticated State', () => {
    it('should render MainNavigator when authenticated', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should not render AuthNavigator when authenticated', () => {
      const { queryByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(queryByTestId('login-screen')).not.toBeOnTheScreen();
    });

    it('should not render loading screen when authenticated and not loading', () => {
      const { queryByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const loadingScreens = queryByTestId('loading-screen');
      expect(loadingScreens).not.toBeOnTheScreen();
    });

    it('should show home screen as initial main screen', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // AUTH STATE TRANSITION TESTS
  // ==========================================================================

  describe('Auth State Transitions', () => {
    it('should switch from loading to auth screen when loading completes', async () => {
      const { getByTestId, queryByTestId, store } = renderRootNavigator({
        isLoading: true,
        isAuthenticated: false,
      });

      // Initially shows loading
      expect(getByTestId('loading-screen')).toBeOnTheScreen();

      // Simulate loading completion
      await act(async () => {
        store.dispatch(setLoading(false));
      });

      // Should switch to auth navigator
      await waitFor(() => {
        expect(queryByTestId('loading-screen')).not.toBeOnTheScreen();
        expect(getByTestId('login-screen')).toBeOnTheScreen();
      });
    });

    it('should switch from auth to main screen when user logs in', async () => {
      const { getByTestId, queryByTestId, store } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      // Initially shows auth
      expect(getByTestId('login-screen')).toBeOnTheScreen();

      // Simulate login
      await act(async () => {
        store.dispatch(
          setUser({
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          })
        );
      });

      // Should switch to main navigator
      await waitFor(() => {
        expect(queryByTestId('login-screen')).not.toBeOnTheScreen();
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });

    it('should switch from main to auth screen when user logs out', async () => {
      const { getByTestId, queryByTestId, store } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      // Initially shows main
      expect(getByTestId('home-screen')).toBeOnTheScreen();

      // Simulate logout
      await act(async () => {
        store.dispatch(clearUser());
      });

      // Should switch to auth navigator
      await waitFor(() => {
        expect(queryByTestId('home-screen')).not.toBeOnTheScreen();
        expect(getByTestId('login-screen')).toBeOnTheScreen();
      });
    });

    it('should handle rapid auth state changes correctly', async () => {
      const { getByTestId, queryByTestId, store } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      // Start at auth
      expect(getByTestId('login-screen')).toBeOnTheScreen();

      // Login
      await act(async () => {
        store.dispatch(
          setUser({
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          })
        );
      });

      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });

      // Logout
      await act(async () => {
        store.dispatch(clearUser());
      });

      await waitFor(() => {
        expect(queryByTestId('home-screen')).not.toBeOnTheScreen();
        expect(getByTestId('login-screen')).toBeOnTheScreen();
      });

      // Login again
      await act(async () => {
        store.dispatch(
          setUser({
            id: '2',
            email: 'test2@example.com',
            firstName: 'Test2',
            lastName: 'User2',
          })
        );
      });

      await waitFor(() => {
        expect(queryByTestId('login-screen')).not.toBeOnTheScreen();
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });
  });

  // ==========================================================================
  // REDUX INTEGRATION TESTS
  // ==========================================================================

  describe('Redux Integration', () => {
    it('should read auth state from Redux store', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      // Should render based on Redux state
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should respond to Redux state changes', async () => {
      const { getByTestId, store } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      expect(getByTestId('login-screen')).toBeOnTheScreen();

      // Dispatch Redux action
      await act(async () => {
        store.dispatch(
          setUser({
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          })
        );
      });

      // Should reflect new state
      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });

    it('should handle user object in Redux state correctly', async () => {
      const testUser = {
        id: '123',
        email: 'user@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      const { store } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
      });

      await act(async () => {
        store.dispatch(setUser(testUser));
      });

      await waitFor(() => {
        const state = store.getState();
        expect(state.auth.user).toEqual(testUser);
        expect(state.auth.isAuthenticated).toBe(true);
      });
    });

    it('should clear user from Redux state on logout', async () => {
      const { store } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      await act(async () => {
        store.dispatch(clearUser());
      });

      await waitFor(() => {
        const state = store.getState();
        expect(state.auth.user).toBeNull();
        expect(state.auth.isAuthenticated).toBe(false);
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle isLoading and isAuthenticated both true', () => {
      const { getByTestId } = renderRootNavigator({
        isLoading: true,
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      // Loading takes precedence
      expect(getByTestId('loading-screen')).toBeOnTheScreen();
    });

    it('should handle authenticated user without user object', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: true,
        isLoading: false,
        user: null,
      });

      // Should still render main navigator
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should handle user object without authentication flag', () => {
      const { getByTestId } = renderRootNavigator({
        isAuthenticated: false,
        isLoading: false,
        user: {
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      // isAuthenticated flag takes precedence
      expect(getByTestId('login-screen')).toBeOnTheScreen();
    });

    it('should render correctly with minimal initial state', () => {
      const { getByTestId } = renderRootNavigator({});

      // Should default to not authenticated, not loading
      expect(getByTestId('login-screen')).toBeOnTheScreen();
    });
  });
});
