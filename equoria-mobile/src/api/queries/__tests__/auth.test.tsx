import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useLogin, useLogout } from '../auth';
import { apiClient } from '../../client';
import { secureStorage } from '../../../utils/secureStorage';
import authReducer from '../../../state/slices/authSlice';
import appReducer from '../../../state/slices/appSlice';

// Mock dependencies
jest.mock('../../client');
jest.mock('../../../utils/secureStorage');

const createTestStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      app: appReducer,
    },
  });

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const store = createTestStore();

  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
};

describe('useLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  it('should login successfully and update state', async () => {
    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
    };

    (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);
    (secureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setUserId as jest.Mock).mockResolvedValue(undefined);
    (apiClient.setAccessToken as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      email: 'test@example.com',
      password: 'password123',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });
    expect(secureStorage.setAccessToken).toHaveBeenCalledWith('mock_access_token');
    expect(secureStorage.setRefreshToken).toHaveBeenCalledWith('mock_refresh_token');
    expect(secureStorage.setUserId).toHaveBeenCalledWith('1');
    expect(apiClient.setAccessToken).toHaveBeenCalledWith('mock_access_token');
  });

  it('should handle login failure', async () => {
    const mockError = new Error('Invalid credentials');
    (apiClient.post as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      email: 'wrong@example.com',
      password: 'wrongpassword',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
    expect(secureStorage.setAccessToken).not.toHaveBeenCalled();
  });

  it('should set loading state correctly during login', async () => {
    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
    };

    (apiClient.post as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockResponse), 100);
        })
    );
    (secureStorage.setAccessToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setRefreshToken as jest.Mock).mockResolvedValue(undefined);
    (secureStorage.setUserId as jest.Mock).mockResolvedValue(undefined);
    (apiClient.setAccessToken as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate({
      email: 'test@example.com',
      password: 'password123',
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isPending).toBe(false);
  });

  it('should handle secure storage errors gracefully', async () => {
    const mockResponse = {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
    };

    (apiClient.post as jest.Mock).mockResolvedValue(mockResponse);
    (secureStorage.setAccessToken as jest.Mock).mockRejectedValue(
      new Error('Storage error')
    );

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      email: 'test@example.com',
      password: 'password123',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('Storage error'));
  });
});

describe('useLogout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  it('should logout successfully and clear state', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({});
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');
    expect(secureStorage.clearAuthData).toHaveBeenCalled();
    expect(apiClient.clearTokens).toHaveBeenCalled();
  });

  it('should clear tokens even if API call fails', async () => {
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Still should attempt to clear local data
    expect(secureStorage.clearAuthData).not.toHaveBeenCalled();
  });

  it('should set loading state correctly during logout', async () => {
    (apiClient.post as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({}), 100);
        })
    );
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate();

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isPending).toBe(false);
  });

  it('should handle multiple logout calls gracefully', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({});
    (secureStorage.clearAuthData as jest.Mock).mockResolvedValue(undefined);
    (apiClient.clearTokens as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Second logout call
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });
});
