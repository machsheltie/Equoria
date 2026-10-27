/**
 * Stud breeding from the stallion's page (Equoria-q4uem.9).
 *
 * Owner rulings 2026-10-26/27 (q89-q95, q104-q110): no Breeding Hall. A
 * stallion's page carries "Breed to <name> (<fee>)" and a mare picker; her own
 * stallion breeds free at once, a Public Stud breeds at once for the fee, a
 * Private Stud receives a request. Another player's horse is the same horse
 * page in visitor mode.
 *
 *   GET    /api/v1/horses/:id/visit           — any horse as a visitor sees it
 *   POST   /api/v1/horses/:id/stud-listing    — stand a stallion at stud { studFee, mode }
 *   DELETE /api/v1/horses/:id/stud-listing    — take him off stud
 *   POST   /api/v1/horses/foals               — breed her own pair { sireId, damId }
 *   POST   /api/v1/studs/:sireId/bookings     — Public Stud { damId, expectedStudFee }
 *   POST   /api/v1/studs/:sireId/requests     — Private Stud { damId, expectedStudFee }
 *   GET    /api/v1/studs/requests             — ?role=incoming|outgoing&sireId=&damId=
 *   POST   /api/v1/studs/requests/:id/(approve|reject|cancel)
 */

import { apiClient } from '../http/apiClient.js';

export type StudMode = 'public' | 'private';

/** A horse as any player may see it (backend app/queries/horseVisitQuery.mjs). */
export interface HorseVisit {
  id: number;
  name: string;
  breed: string | null;
  sex: string;
  age: number | null;
  colorName: string | null;
  imageUrl: string | null;
  stats: Record<string, number>;
  revealedTraits: { positive: string[]; negative: string[] };
  displayedHealth: string | null;
  sire: { id: number; name: string } | null;
  dam: { id: number; name: string } | null;
  owner: { username: string } | null;
  isOwn: boolean;
  stud: { mode: StudMode; fee: number } | null;
  forSale: boolean;
  salePrice: number | null;
}

export type StudRequestStatus = 'PENDING' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';

export interface StudRequest {
  id: number;
  status: StudRequestStatus;
  fee: number;
  createdAt: string;
  resolvedAt: string | null;
  declineReason: string | null;
  sire: { id: number | null; name: string };
  dam: { id: number | null; name: string };
  counterparty: { username: string };
}

export interface StudRequestList {
  requests: StudRequest[];
}

export interface StudRequestQuery {
  role: 'incoming' | 'outgoing';
  sireId?: number;
  damId?: number;
}

function requestQuery({ role, sireId, damId }: StudRequestQuery): string {
  const params = new URLSearchParams({ role, limit: '100' });
  if (sireId) params.set('sireId', String(sireId));
  if (damId) params.set('damId', String(damId));
  return params.toString();
}

export const studsApi = {
  visit: (horseId: number) => apiClient.get<HorseVisit>(`/api/v1/horses/${horseId}/visit`),

  standAtStud: (horseId: number, studFee: number, mode: StudMode) =>
    apiClient.post<{ studStatus: string; studFee: number }>(
      `/api/v1/horses/${horseId}/stud-listing`,
      { studFee, mode }
    ),

  takeOffStud: (horseId: number) =>
    apiClient.delete<{ studStatus: string; studFee: number }>(
      `/api/v1/horses/${horseId}/stud-listing`
    ),

  breedOwnPair: (sireId: number, damId: number) =>
    apiClient.post<{ foalDueDate?: string }>('/api/v1/horses/foals', { sireId, damId }),

  bookPublicStud: (sireId: number, damId: number, expectedStudFee: number) =>
    apiClient.post<{ foalDueDate?: string }>(`/api/v1/studs/${sireId}/bookings`, {
      damId,
      expectedStudFee,
    }),

  requestPrivateStud: (sireId: number, damId: number, expectedStudFee: number) =>
    apiClient.post<{ requestId: number }>(`/api/v1/studs/${sireId}/requests`, {
      damId,
      expectedStudFee,
    }),

  listRequests: (query: StudRequestQuery) =>
    apiClient.get<StudRequestList>(`/api/v1/studs/requests?${requestQuery(query)}`),

  answerRequest: (requestId: number, answer: 'approve' | 'reject' | 'cancel') =>
    apiClient.post<{ requestId: number }>(`/api/v1/studs/requests/${requestId}/${answer}`, {}),
};
