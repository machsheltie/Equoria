/**
 * Records a groom payroll failure for the owner's payroll diagnostics
 * (Equoria-brh8c, owner ruling q158): which groom, which player, which pass
 * (the weekly settlement or the owner's manual payday), which pay week, and the
 * error with its stack. The log itself is the staff module's; writing is fail-soft.
 */

import { gameDateKey } from '../../../utils/gameTime.mjs';
import { recordPayrollFailure } from '../../staff/index.mjs';

/**
 * @param {'weeklySettlement'|'manualPayroll'} source
 * @param {Date} payWeekStart - the pay week the pass was settling or collecting
 * @returns {(groom: {id: number, userId?: string|null}, error: unknown, userId?: string) => Promise<void>}
 */
export function groomPayrollFailureRecorder(source, payWeekStart) {
  return (groom, error, userId) =>
    recordPayrollFailure({
      staffType: 'groom',
      staffId: groom.id,
      userId: userId ?? groom.userId ?? null,
      source,
      weekStart: payWeekStart,
      weekKey: gameDateKey(payWeekStart),
      error,
    });
}
