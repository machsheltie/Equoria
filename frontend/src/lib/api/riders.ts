/**
 * Rider API client (Equoria-jog8w, Equoria-aodym slice 2, Epic 9C).
 *
 * Path registry:
 *   GET  /api/v1/riders/user/:userId        → Rider[]
 *   GET  /api/v1/riders/assignments         → RiderAssignment[]
 *   GET  /api/v1/riders/marketplace         → RiderMarketplaceData
 *   POST /api/v1/riders/marketplace/hire    → { success, data: { rider, cost } }
 *   POST /api/v1/riders/marketplace/refresh → RiderMarketplaceData
 *   POST /api/v1/riders/assignments         → { success }
 *   DELETE /api/v1/riders/assignments/:id   → { success }
 *   GET  /api/v1/riders/:id/discovery       → RiderDiscoveryData
 */

import { apiClient } from '../http/apiClient.js';
import type { Rider, RiderAssignment, RiderDiscoveryData, RiderMarketplaceData } from './types.js';

export const ridersApi = {
  getUserRiders: (userId: string | number) =>
    apiClient.get<Rider[]>(`/api/v1/riders/user/${userId}`),
  getAssignments: () => apiClient.get<RiderAssignment[]>('/api/v1/riders/assignments'),
  getMarketplace: () => apiClient.get<RiderMarketplaceData>('/api/v1/riders/marketplace'),
  hireRider: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { rider: Rider; cost: number; remainingMoney: number };
    }>('/api/v1/riders/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<RiderMarketplaceData>('/api/v1/riders/marketplace/refresh', { force }),
  assignRider: (data: { riderId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/v1/riders/assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/riders/assignments/${assignmentId}`),
  getDiscovery: (riderId: number) =>
    apiClient.get<RiderDiscoveryData>(`/api/v1/riders/${riderId}/discovery`),
};
