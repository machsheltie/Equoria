/**
 * Staff API client — the Steward's Office (Equoria-puj1e.1).
 *
 * Shapes mirror backend/modules/staff/controllers/*.mjs. Every request goes
 * through apiClient, which sends credentials (so the httpOnly, path-scoped
 * `staff_device` cookie travels with each call) and the CSRF token on writes.
 *
 *   GET  /api/v1/staff/me                 → { role, capabilities, trusted }   (404 for non-staff)
 *   POST /api/v1/staff/checkin/request    → 202 { sent: true }
 *   POST /api/v1/staff/checkin/verify     → 200 { trusted: true }
 *   GET  /api/v1/staff/log?cursor         → { entries, nextCursor }
 *   GET  /api/v1/staff/roles              → { staff: StaffMember[] }
 *   POST /api/v1/staff/roles/lookup       → StaffMember
 *   POST /api/v1/staff/roles/:userId      → StaffMember (with the new role)
 *   POST /api/v1/staff/tickets            → 201 { ticket }
 *   GET  /api/v1/staff/tickets?status     → { tickets }
 *   GET  /api/v1/staff/tickets/:id        → { ticket (with replies) }
 *   POST /api/v1/staff/tickets/:id/replies → 201 { reply }
 *   POST /api/v1/staff/tickets/:id/status → { ticket }
 */

import { apiClient } from '../http/apiClient.js';

export type StaffRole = 'moderator' | 'admin';
/** A role an account can hold; `user` is a plain player. */
export type AccountRole = 'user' | StaffRole;

export interface StaffMe {
  role: StaffRole;
  capabilities: string[];
  trusted: boolean;
}

export interface StaffLogEntry {
  id: number;
  actorId: string;
  actorRole: string;
  capability: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  outcome: 'succeeded' | 'failed' | string;
  error: string | null;
  reversesId: number | null;
  createdAt: string;
}

export interface StaffLogPage {
  entries: StaffLogEntry[];
  nextCursor: number | null;
}

/** Ledger filters; only an account holding log.view.all may widen past itself. */
export interface StaffLogFilter {
  actorId?: string;
  capability?: string;
}

export interface StaffMember {
  id: string;
  username: string;
  role: AccountRole;
}

export type TicketTargetType = 'user' | 'post' | 'horse' | 'show';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'declined';

export interface StaffTicket {
  id: number;
  /** Null once the filing account is erased (Equoria-2yugk): a former steward. */
  filedById: string | null;
  filedBy?: { id: string; username: string } | null;
  targetType: TicketTargetType;
  targetId: string;
  /** Player targets only: their current username, or null when the account is gone. */
  targetUsername?: string | null;
  category: string;
  note: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTicketReply {
  id: number;
  ticketId: number;
  /** Null once the author's account is erased (Equoria-2yugk): a former steward. */
  authorId: string | null;
  author: { id: string; username: string } | null;
  body: string;
  createdAt: string;
}

export interface StaffTicketWithReplies extends StaffTicket {
  replies: StaffTicketReply[];
}

/** A player is named by `targetUsername` or by `targetId`; every other target by `targetId`. */
export interface FileTicketPayload {
  targetType: TicketTargetType;
  targetId?: string;
  targetUsername?: string;
  category: string;
  note: string;
}

const BASE = '/api/v1/staff';

export const staffApi = {
  me: () => apiClient.get<StaffMe>(`${BASE}/me`),
  requestCheckin: () => apiClient.post<{ sent: true }>(`${BASE}/checkin/request`, {}),
  verifyCheckin: (code: string) =>
    apiClient.post<{ trusted: true }>(`${BASE}/checkin/verify`, { code }),

  log: (filter: StaffLogFilter = {}, cursor?: number) => {
    const params = new URLSearchParams();
    if (filter.actorId) params.set('actorId', filter.actorId);
    if (filter.capability) params.set('capability', filter.capability);
    if (cursor !== undefined) params.set('cursor', String(cursor));
    const qs = params.toString();
    return apiClient.get<StaffLogPage>(`${BASE}/log${qs ? `?${qs}` : ''}`);
  },

  listStaff: () => apiClient.get<{ staff: StaffMember[] }>(`${BASE}/roles`),
  lookupUser: (username: string) =>
    apiClient.post<StaffMember>(`${BASE}/roles/lookup`, { username }),
  setRole: (userId: string, role: 'moderator' | 'user', reason: string) =>
    apiClient.post<StaffMember>(`${BASE}/roles/${encodeURIComponent(userId)}`, { role, reason }),

  listTickets: () => apiClient.get<{ tickets: StaffTicket[] }>(`${BASE}/tickets`),
  getTicket: (id: number) =>
    apiClient.get<{ ticket: StaffTicketWithReplies }>(`${BASE}/tickets/${id}`),
  fileTicket: (payload: FileTicketPayload) =>
    apiClient.post<{ ticket: StaffTicket }>(`${BASE}/tickets`, payload),
  replyToTicket: (id: number, body: string) =>
    apiClient.post<{ reply: StaffTicketReply }>(`${BASE}/tickets/${id}/replies`, { body }),
  setTicketStatus: (id: number, status: TicketStatus) =>
    apiClient.post<{ ticket: StaffTicket }>(`${BASE}/tickets/${id}/status`, { status }),
};
