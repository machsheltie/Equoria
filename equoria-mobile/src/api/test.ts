import { apiClient } from './client';

interface HealthResponse {
  status: string;
  timestamp?: string;
}

export const testApiConnection = async (): Promise<boolean> => {
  try {
    const response = await apiClient.get<HealthResponse>('/health');
    console.log('API Health Check:', response);
    return response.status === 'ok';
  } catch (error) {
    console.error('API Connection Failed:', error);
    return false;
  }
};
