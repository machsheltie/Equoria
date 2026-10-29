/**
 * Records a rider payroll failure for the owner's payroll diagnostics
 * (Equoria-brh8c, owner ruling q158): which rider, which player, the weekly
 * settlement, which pay week, and the error with its stack. The log itself is
 * the staff module's; writing is fail-soft.
 */

import { recordPayrollFailure } from '../../staff/index.mjs';
import { riderPayWeekKey } from './riderPayWeek.mjs';

/**
 * @param {'weeklySettlement'} source
 * @param {Date} payWeekStart - the pay week the pass was settling
 * @returns {(rider: {id: number, userId?: string|null}, error: unknown, userId?: string) => Promise<void>}
 */
export function riderPayrollFailureRecorder(source, payWeekStart) {
  return (rider, error, userId) =>
    recordPayrollFailure({
      staffType: 'rider',
      staffId: rider.id,
      userId: userId ?? rider.userId ?? null,
      source,
      weekStart: payWeekStart,
      weekKey: riderPayWeekKey(payWeekStart),
      error,
    });
}
