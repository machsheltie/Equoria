/**
 * Need Help? API client (Equoria-vc5x1).
 *
 *   GET /api/v1/help/staff → the team in three sections with online status.
 *
 * Messaging a staff member uses the ordinary messages API (messagesApi).
 */

import { apiClient } from '../http/apiClient.js';

export interface HelpStaffMember {
  id: string;
  username: string;
  online: boolean;
}

export interface HelpStaffSections {
  owner: HelpStaffMember[];
  admin: HelpStaffMember[];
  moderator: HelpStaffMember[];
}

export const helpApi = {
  getStaff: () => apiClient.get<HelpStaffSections>('/api/v1/help/staff'),
};
