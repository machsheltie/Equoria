import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { useAppDispatch } from '../../state/hooks';
import { setUser, clearUser } from '../../state/slices/authSlice';
import { secureStorage } from '../../utils/secureStorage';

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Custom hook for user login
 * Handles authentication, token storage, and Redux state updates
 */
export const useLogin = () => {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      return response;
    },
    onSuccess: async (data) => {
      // Store tokens securely
      await secureStorage.setAccessToken(data.accessToken);
      await secureStorage.setRefreshToken(data.refreshToken);
      await secureStorage.setUserId(data.user.id);

      // Set access token on API client for subsequent requests
      await apiClient.setAccessToken(data.accessToken);

      // Update Redux state
      dispatch(setUser(data.user));
    },
  });
};

/**
 * Custom hook for user logout
 * Handles server logout, token clearing, and Redux state cleanup
 */
export const useLogout = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: async () => {
      // Clear all auth data from secure storage
      await secureStorage.clearAuthData();

      // Clear tokens from API client
      await apiClient.clearTokens();

      // Clear Redux state
      dispatch(clearUser());

      // Clear all cached queries
      queryClient.clear();
    },
  });
};
