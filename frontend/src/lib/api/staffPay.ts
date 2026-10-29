/**
 * Pay Groom / Pay Rider API client (Equoria-hc96y).
 *
 * Owner rulings 2026-10-28 and 2026-10-29 (q268): payday is a player action. The
 * player pays each groom and rider any time during the week; the week ends Sunday
 * midnight Eastern, then the unpaid rules apply.
 *
 * Path registry:
 *   GET  /api/v1/groom-salaries/pay-status          → GroomPayStatus
 *   POST /api/v1/groom-salaries/grooms/:groomId/pay → GroomPayStatus (refreshed)
 *   GET  /api/v1/riders/pay-status                  → RiderPayStatus
 *   POST /api/v1/riders/:riderId/pay                → RiderPayStatus (refreshed)
 */

import { apiClient } from '../http/apiClient.js';

/** One staff member's pay for this week. */
export interface StaffPayLine {
  weeklyFee: number;
  /** Earlier weeks still owed, paid with this week. */
  owed: number;
  /** What one press of the Pay button takes (the weekly fee once paid, for the label). */
  amountDue: number;
  paidThisWeek: boolean;
  canAfford: boolean;
  /** Unpaid from an earlier week: cannot work or ride until paid. */
  feeUnpaid: boolean;
}

export interface GroomPayLine extends StaffPayLine {
  groomId: number;
}

export interface RiderPayLine extends StaffPayLine {
  riderId: number;
}

export interface GroomPayStatus {
  /** ISO instant the pay week ends: Sunday midnight Eastern. */
  weekEndsAt: string;
  money: number;
  grooms: GroomPayLine[];
}

export interface RiderPayStatus {
  weekEndsAt: string;
  money: number;
  riders: RiderPayLine[];
}

export const staffPayApi = {
  getGroomPay: () => apiClient.get<GroomPayStatus>('/api/v1/groom-salaries/pay-status'),
  payGroom: (groomId: number) =>
    apiClient.post<GroomPayStatus>(`/api/v1/groom-salaries/grooms/${groomId}/pay`, {}),
  getRiderPay: () => apiClient.get<RiderPayStatus>('/api/v1/riders/pay-status'),
  payRider: (riderId: number) =>
    apiClient.post<RiderPayStatus>(`/api/v1/riders/${riderId}/pay`, {}),
};
