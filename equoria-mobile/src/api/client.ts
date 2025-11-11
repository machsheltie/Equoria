import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { env } from '../config/env';
import { secureStorage } from '../utils/secureStorage';

class ApiClient {
  private instance: AxiosInstance;
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: env.apiBaseUrl,
      timeout: env.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.initializeToken();
    this.setupInterceptors();
  }

  /**
   * Load token from SecureStore on app start
   */
  private async initializeToken(): Promise<void> {
    try {
      this.accessToken = await secureStorage.getAccessToken();
    } catch (error) {
      console.error('Error initializing token:', error);
    }
  }

  /**
   * Set access token (called after login)
   */
  public async setAccessToken(token: string): Promise<void> {
    this.accessToken = token;
    await secureStorage.setAccessToken(token);
  }

  /**
   * Clear tokens (called on logout)
   */
  public async clearTokens(): Promise<void> {
    this.accessToken = null;
    await secureStorage.clearAuthData();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        if (!this.accessToken) {
          this.accessToken = await secureStorage.getAccessToken();
        }

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
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
        const originalRequest = error.config;

        if (env.enableLogging) {
          console.error('API Response Error:', error.response?.status, error.config?.url);
        }

        // Handle 401 Unauthorized - Token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Queue this request to retry after token refresh
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.instance(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            if (newToken) {
              this.accessToken = newToken;
              await secureStorage.setAccessToken(newToken);

              // Retry all queued requests
              this.refreshSubscribers.forEach((callback) => callback(newToken));
              this.refreshSubscribers = [];

              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed - clear tokens and redirect to login
            await this.clearTokens();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      // Call refresh endpoint
      const response = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${env.apiBaseUrl}/auth/refresh`,
        { refreshToken },
        { timeout: env.apiTimeout }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Store new tokens
      await secureStorage.setAccessToken(accessToken);
      await secureStorage.setRefreshToken(newRefreshToken);

      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  // Generic request methods
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.get(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.post(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.put(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.instance.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
