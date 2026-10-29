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
 *   GET  /api/v1/staff/log/actors         → { actors: StaffLogActor[] }   (admin only)
 *   GET  /api/v1/staff/roles              → { staff: StaffMember[] }
 *   POST /api/v1/staff/roles/lookup       → StaffMember
 *   POST /api/v1/staff/roles/:userId      → StaffMember (with the new role)
 *   POST /api/v1/staff/tickets            → 201 { ticket }
 *   GET  /api/v1/staff/tickets?status&cursor → { tickets, nextCursor }
 *   GET  /api/v1/staff/tickets/:id?before → { ticket (with a page of replies), olderRepliesCursor }
 *   POST /api/v1/staff/tickets/:id/replies → 201 { reply }
 *   POST /api/v1/staff/tickets/:id/status → { ticket }
 *   GET  /api/v1/staff/shows/quarantined  → { shows }                         (owner only)
 *   GET  /api/v1/staff/shows/quarantined/:id/diagnose → { diagnosis }         (owner only)
 *   POST /api/v1/staff/shows/quarantined/:id/test-run → { testRun }           (owner only)
 *   POST /api/v1/staff/shows/quarantined/:id/run      → { result }            (owner only)
 *   GET  /api/v1/staff/payroll/staff?type&q           → { staff }             (owner only)
 *   GET  /api/v1/staff/payroll/:type/:id/failures     → PayrollFailures       (owner only)
 *   GET  /api/v1/staff/payroll/:type/:id/diagnose     → { diagnosis }         (owner only)
 *   POST /api/v1/staff/payroll/:type/:id/failures/:fid/test-run → { testRun } (owner only)
 *   POST /api/v1/staff/payroll/:type/:id/failures/:fid/rerun    → { result }  (owner only)
 *   GET  /api/v1/staff/server-health                  → { health }            (owner only)
 */

import { apiClient } from '../http/apiClient.js';

/** Owner ruling 2026-10-23 (Equoria-4tleh): three staff levels. */
export type StaffRole = 'moderator' | 'admin' | 'owner';
/** A role an account can hold; `user` is a plain player. */
export type AccountRole = 'user' | StaffRole;

export interface StaffMe {
  role: StaffRole;
  capabilities: string[];
  trusted: boolean;
}

/** Equoria-w47x7: a player's conduct standing and record (Steward's Office). */
export type ConductAction =
  | 'warn'
  | 'freeze'
  | 'ban/account'
  | 'ban/ip'
  | 'ban/device'
  | 'lift/account'
  | 'lift/ip'
  | 'lift/device';

export interface ConductEntry {
  id: number;
  kind: 'warning' | 'freeze' | 'ban' | 'lift';
  reason: string;
  issuedByRole: string;
  freezeDays: number | null;
  endsAt: string | null;
  createdAt: string;
}

export interface ConductRecordView {
  player: StaffMember;
  standing: { state: 'good' | 'frozen' | 'banned'; endsAt?: string };
  records: ConductEntry[];
}

/** Equoria-x5n89: another account seen on a device this player used. */
export interface LinkedAccount {
  id: string;
  username: string;
  role: AccountRole;
  sharedDevices: number;
  lastSeenAt: string;
}

export interface LinkedAccountsView {
  player: StaffMember;
  accounts: LinkedAccount[];
}

/** An internet address seen with more than four accounts; a flag, never a block. */
export interface FlaggedAddress {
  ipAddress: string;
  accountCount: number;
  accounts: Array<{ id: string; username: string; role: AccountRole }>;
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

/** Someone who has written to the ledger; username is null once the account is erased. */
export interface StaffLogActor {
  id: string;
  username: string | null;
}

export interface StaffMember {
  id: string;
  username: string;
  role: AccountRole;
}

export type TicketTargetType = 'user' | 'post' | 'horse' | 'show';
export type TicketStatus = 'open' | 'inProgress' | 'resolved' | 'declined';

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
  /** One page of replies, oldest first: the latest page unless `before` was given. */
  replies: StaffTicketReply[];
}

/** One page of the ticket list, newest first; nextCursor is null on the last page. */
export interface StaffTicketPage {
  tickets: StaffTicket[];
  nextCursor: string | null;
}

/** A ticket with one page of replies; olderRepliesCursor is null when none are earlier. */
export interface StaffTicketThreadPage {
  ticket: StaffTicketWithReplies;
  olderRepliesCursor: string | null;
}

/** A player is named by `targetUsername` or by `targetId`; every other target by `targetId`. */
export interface FileTicketPayload {
  targetType: TicketTargetType;
  targetId?: string;
  targetUsername?: string;
  category: string;
  note: string;
}

/** A show held back after three failed runs (Equoria-ehlbj). */
export interface QuarantinedShow {
  id: number;
  name: string;
  discipline: string;
  showType: string;
  closeDate: string | null;
  executionAttempts: number;
  prizeEscrow: number;
  feeEscrow: number;
  entryCount: number;
  updatedAt: string;
  /** The newest test run, when the newest tool use was one (Equoria-yqi49). */
  lastTestRun: { testedAt: string; passed: boolean; sameCommit: boolean } | null;
  /** A passed test run on the code running now unlocks Run Show. */
  runShowReady: boolean;
}

/** A test run: the real settlement, rolled back; nothing moved (Equoria-yqi49). */
export type QuarantinedShowTestRun =
  | {
      showId: number;
      passed: true;
      testedAt: string;
      commitSha: string | null;
      name: string;
      kind: 'unexecuted' | 'halfSettled';
      attempts: number;
      entryCount: number;
      placements: Array<{
        placement: number;
        horseId: number;
        horseName: string | null;
        ownerName: string | null;
        score: number;
        prize: number;
      }>;
      prizeToPlacings: number;
      unpaidPrizeShareToHost: number;
      entryFeesToHost: number;
      coinsIn: number;
      coinsOut: number;
    }
  | { showId: number; passed: false; error: string; commitSha: string | null };

/** The report handed to Claude Code or Codex (Markdown text). */
export interface QuarantinedShowDiagnosis {
  showId: number;
  commitSha: string | null;
  report: string;
}

/** Equoria-brh8c: the owner's payroll diagnostics pick a groom or a rider. */
export type PayrollStaffType = 'groom' | 'rider';

/** What a payroll replay did, or would do. The page puts each in words. */
export type PayrollOutcome =
  | 'paid'
  | 'alreadyPaid'
  | 'notEnoughCoins'
  | 'weekEnded'
  | 'alreadySettled'
  | 'cannotWork'
  | 'leftForHirePool'
  | 'cannotRide'
  | 'leftRoster'
  | 'noLongerOnStaff'
  | 'hiredThatWeek'
  | 'nothingToReplay';

export interface PayrollStaffMember {
  staffType: PayrollStaffType;
  id: number;
  name: string;
  starLevel: string;
  employerId: string | null;
  employerName: string | null;
  onStaff: boolean;
  unpaidSince: string | null;
  failureCount?: number;
  lastFailureAt?: string | null;
}

export interface PayrollFailure {
  id: number;
  at: string;
  source: 'weeklySettlement' | 'manualPayroll' | 'testRun' | 'rerun' | null;
  weekKey: string | null;
  message: string | null;
  replayable: boolean;
}

export interface PayrollFailures {
  staffMember: PayrollStaffMember;
  failures: PayrollFailure[];
  lastTestRun: {
    failureId: number | null;
    testedAt: string;
    passed: boolean;
    sameCommit: boolean;
    outcome: PayrollOutcome | null;
  } | null;
  /** The failure a passed test run on the code running now has unlocked. */
  rerunReadyFailureId: number | null;
}

export type PayrollTestRun =
  | {
      failureId: number;
      passed: true;
      testedAt: string;
      commitSha: string | null;
      outcome: PayrollOutcome;
      amount: number;
    }
  | { failureId: number; passed: false; error: string; commitSha: string | null };

export interface PayrollDiagnosis {
  staffType: PayrollStaffType;
  staffId: number;
  commitSha: string | null;
  report: string;
}

/** Equoria-brh8c: the server's memory and speed, as the owner's panel shows them. */
export interface ServerHealth {
  commitSha: string | null;
  uptime: string;
  memory: {
    totalMb: number;
    usedMb: number;
    reservedMb: number;
    percentUsed: number;
    outsideMb: number;
    growing: boolean | null;
    watching: boolean;
    warnings: Array<{ at: string; serious: boolean; what: string }>;
    openTimers: number;
  };
  speed: {
    since: string;
    requests: number;
    overOneSecond: number;
    slowestRoutes: Array<{
      route: string;
      requests: number;
      averageMs: number;
      slowestMs: number;
      overOneSecond: number;
    }>;
    cachedAnswersPercent: number;
    averagePackingMs: number | null;
  };
  report: string;
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

  logActors: () => apiClient.get<{ actors: StaffLogActor[] }>(`${BASE}/log/actors`),

  listStaff: () => apiClient.get<{ staff: StaffMember[] }>(`${BASE}/roles`),
  lookupUser: (username: string) =>
    apiClient.post<StaffMember>(`${BASE}/roles/lookup`, { username }),
  setRole: (userId: string, role: 'moderator' | 'admin' | 'user', reason: string) =>
    apiClient.post<StaffMember>(`${BASE}/roles/${encodeURIComponent(userId)}`, { role, reason }),

  lookupConductPlayer: (username: string) =>
    apiClient.post<StaffMember>(`${BASE}/conduct/lookup`, { username }),
  conductRecord: (userId: string) =>
    apiClient.get<ConductRecordView>(`${BASE}/conduct/${encodeURIComponent(userId)}`),
  linkedAccounts: (userId: string) =>
    apiClient.get<LinkedAccountsView>(
      `${BASE}/conduct/${encodeURIComponent(userId)}/linked-accounts`
    ),
  flaggedAddresses: () =>
    apiClient.get<{ addresses: FlaggedAddress[] }>(`${BASE}/flagged-addresses`),
  conductAct: (userId: string, action: ConductAction, reason: string, days?: 1 | 3 | 7) =>
    apiClient.post<{ id: string }>(`${BASE}/conduct/${encodeURIComponent(userId)}/${action}`, {
      reason,
      ...(action === 'freeze' ? { days } : {}),
    }),

  listTickets: (cursor?: string) =>
    apiClient.get<StaffTicketPage>(
      `${BASE}/tickets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    ),
  getTicket: (id: number, before?: string) =>
    apiClient.get<StaffTicketThreadPage>(
      `${BASE}/tickets/${id}${before ? `?before=${encodeURIComponent(before)}` : ''}`
    ),
  fileTicket: (payload: FileTicketPayload) =>
    apiClient.post<{ ticket: StaffTicket }>(`${BASE}/tickets`, payload),
  replyToTicket: (id: number, body: string) =>
    apiClient.post<{ reply: StaffTicketReply }>(`${BASE}/tickets/${id}/replies`, { body }),
  setTicketStatus: (id: number, status: TicketStatus) =>
    apiClient.post<{ ticket: StaffTicket }>(`${BASE}/tickets/${id}/status`, { status }),

  listQuarantinedShows: () =>
    apiClient.get<{ shows: QuarantinedShow[] }>(`${BASE}/shows/quarantined`),
  diagnoseQuarantinedShow: (showId: number) =>
    apiClient.get<{ diagnosis: QuarantinedShowDiagnosis }>(
      `${BASE}/shows/quarantined/${showId}/diagnose`
    ),
  testRunQuarantinedShow: (showId: number) =>
    apiClient.post<{ testRun: QuarantinedShowTestRun }>(
      `${BASE}/shows/quarantined/${showId}/test-run`,
      {}
    ),
  searchPayrollStaff: (staffType: PayrollStaffType, query: string) =>
    apiClient.get<{ staff: PayrollStaffMember[] }>(
      `${BASE}/payroll/staff?type=${staffType}&q=${encodeURIComponent(query)}`
    ),
  payrollFailures: (staffType: PayrollStaffType, staffId: number) =>
    apiClient.get<PayrollFailures>(`${BASE}/payroll/${staffType}/${staffId}/failures`),
  diagnosePayroll: (staffType: PayrollStaffType, staffId: number) =>
    apiClient.get<{ diagnosis: PayrollDiagnosis }>(
      `${BASE}/payroll/${staffType}/${staffId}/diagnose`
    ),
  testRunPayroll: (staffType: PayrollStaffType, staffId: number, failureId: number) =>
    apiClient.post<{ testRun: PayrollTestRun }>(
      `${BASE}/payroll/${staffType}/${staffId}/failures/${failureId}/test-run`,
      {}
    ),
  rerunPayroll: (staffType: PayrollStaffType, staffId: number, failureId: number) =>
    apiClient.post<{ result: { failureId: number; outcome: PayrollOutcome; amount: number } }>(
      `${BASE}/payroll/${staffType}/${staffId}/failures/${failureId}/rerun`,
      {}
    ),
  serverHealth: () => apiClient.get<{ health: ServerHealth }>(`${BASE}/server-health`),
  runQuarantinedShow: (showId: number) =>
    apiClient.post<{ result: { showId: number; status: 'completed'; settled: number } }>(
      `${BASE}/shows/quarantined/${showId}/run`,
      {}
    ),
};
