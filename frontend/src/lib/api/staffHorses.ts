/**
 * Horse lookup in the Steward's Office (Equoria-puj1e.5). Shapes mirror
 * backend/modules/staff/services/horseLookupService.mjs.
 *
 *   GET /api/v1/staff/horses/lookup?q=<number or name> → { horses: StaffHorse[] }
 *
 * The Owner and Admins only. `epigeneticModifiers.hidden` arrives for the Owner
 * alone; everyone else gets the revealed traits and a count.
 */

import { apiClient } from '../http/apiClient.js';

export interface StaffHorsePregnancy {
  since: string;
  /** 00:00 Eastern on the day the foal is due. */
  dueDay: string;
  sireName: string | null;
}

export interface StaffHorse {
  id: number;
  name: string;
  sex: string | null;
  ownerUsername: string | null;
  /** Calendar date, 'YYYY-MM-DD'. */
  dateOfBirth: string | null;
  age: number | null;
  retired: boolean;
  pregnancy: StaffHorsePregnancy | null;
  foalDevelopmentDay: number | null;
  epigeneticModifiers: {
    positive: string[];
    negative: string[];
    hiddenCount: number;
    hidden?: string[];
  };
  traitLabels?: Record<string, string>;
}

export const staffHorsesApi = {
  lookup: (q: string) =>
    apiClient.get<{ horses: StaffHorse[] }>(
      `/api/v1/staff/horses/lookup?q=${encodeURIComponent(q)}`
    ),
};
