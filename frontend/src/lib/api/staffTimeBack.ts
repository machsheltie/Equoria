/**
 * The Owner's outage tools — Steward's Office (Equoria-puj1e.5, owner rulings
 * q377/q378). Shapes mirror backend/modules/staff/controllers/staffTimeBackController.mjs.
 *
 *   GET  /api/v1/staff/jobs/hold                 → JobHold
 *   POST /api/v1/staff/jobs/hold { reason? }     → JobHold
 *   POST /api/v1/staff/jobs/release              → JobHold
 *   GET  /api/v1/staff/time-back                 → TimeBackRecord[]
 *   GET  /api/v1/staff/time-back/preview?start&end → TimeBackPreview
 *   POST /api/v1/staff/time-back/code { purpose } → 202
 *   POST /api/v1/staff/time-back/apply { start, end, code } → TimeBackRecord
 *   POST /api/v1/staff/time-back/:id/undo { code } → TimeBackRecord
 *
 * `start` and `end` are Eastern wall-clock times, 'YYYY-MM-DDTHH:mm'. A time
 * the clocks repeat (1:xx a.m. the night they go back) also needs
 * `startOccurrence` / `endOccurrence` ('first' | 'second'), on preview and apply.
 * POST /api/v1/admin/foaling/trigger → { foalsBorn } delivers overdue foals now.
 */

import { apiClient } from '../http/apiClient.js';

const BASE = '/api/v1/staff';

export interface JobHold {
  held: boolean;
  heldAt: string | null;
  heldById: string | null;
  reason: string | null;
}

export interface TimeBackJobRun {
  jobName: string;
  startedAt: string;
  status: string;
  effect: string;
}

export interface TimeBackPreview {
  windowStart: string;
  windowEnd: string;
  pauseSeconds: number;
  pauseDays: number;
  fields: Record<string, number>;
  horsesUnretired: number;
  jobRuns: TimeBackJobRun[];
  unruledFields: string[];
  /** Career counts left alone: the record of which staff aged does not cover the window. */
  unprovableCounters: string[];
  overlapsTimeBackId: number | null;
}

export interface TimeBackRecord {
  id: number;
  windowStart: string;
  windowEnd: string;
  pauseSeconds: number;
  appliedAt: string;
  summary: {
    fields?: Record<string, number>;
    horsesUnretired?: number;
    unprovableCounters?: string[];
  } | null;
  reversedAt: string | null;
  reverseSummary: { restored?: Record<string, number>; skipped?: Record<string, number> } | null;
}

export type TimeBackCodePurpose = 'timeBackApply' | 'timeBackUndo';

/** Which of a time that happens twice: before or after the clocks went back. */
export type WallTimeOccurrence = 'first' | 'second';

export interface TimeBackWindow {
  start: string;
  end: string;
  startOccurrence?: WallTimeOccurrence;
  endOccurrence?: WallTimeOccurrence;
}

export const staffTimeBackApi = {
  jobHold: () => apiClient.get<JobHold>(`${BASE}/jobs/hold`),
  holdJobs: (reason: string) => apiClient.post<JobHold>(`${BASE}/jobs/hold`, { reason }),
  releaseJobs: () => apiClient.post<JobHold>(`${BASE}/jobs/release`, {}),
  timeBacks: () => apiClient.get<TimeBackRecord[]>(`${BASE}/time-back`),
  preview: (outage: TimeBackWindow) => {
    const given = Object.entries(outage).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    );
    return apiClient.get<TimeBackPreview>(
      `${BASE}/time-back/preview?${new URLSearchParams(given).toString()}`
    );
  },
  sendCode: (purpose: TimeBackCodePurpose) =>
    apiClient.post<{ success: boolean }>(`${BASE}/time-back/code`, { purpose }),
  apply: (outage: TimeBackWindow, code: string) =>
    apiClient.post<TimeBackRecord>(`${BASE}/time-back/apply`, { ...outage, code }),
  undo: (id: number, code: string) =>
    apiClient.post<TimeBackRecord>(`${BASE}/time-back/${id}/undo`, { code }),
  deliverOverdueFoals: () =>
    apiClient.post<{ foalsBorn: number }>('/api/v1/admin/foaling/trigger', {}),
};
