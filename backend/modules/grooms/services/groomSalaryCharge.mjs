/**
 * The weekly groom charge for one player, with its fall-back (Equoria-bgdfb). Split out of
 * groomSalaryService.mjs to keep that file under the size threshold; it runs INSIDE the
 * caller's transaction, under the pay-week lock.
 *
 * EQUORIA-BGDFB, FIX ROUND 1 (REVIEW F2) — THIS WEEK FIRST, THEN THE DEBT. The first
 * implementation charged `week + arrears` as one all-or-nothing amount, so a player who
 * could afford this week but not the debt paid NOTHING, stayed in grace, and lost the groom
 * on the next pass. That is stricter than the ruling, which is "it's owed" and "collected
 * when funds exist" — not "no work until the debt is cleared".
 *
 * So: attempt BOTH in one debit — still the right shape, because one debit cannot
 * half-succeed and leave a week marked settled that was never paid. If the wallet cannot
 * cover both, fall back to THIS WEEK ALONE: the groom keeps working, grace clears, and the
 * arrears stay recorded in the same owed state for a later week when funds allow.
 *
 * The fallback is safe INSIDE the transaction: `debitMoneyOrThrow` throws on
 * `claim.count === 0`, a JS decision after a zero-row `updateMany` — no SQL error, so the
 * transaction is not aborted and a second, smaller attempt is a legal statement on it.
 *
 * @returns {Promise<boolean>} whether the owed earlier weeks were settled by the debit that
 *   succeeded (false when only the current week was affordable, or nothing was owed)
 * @throws {InsufficientFundsError} when even this week alone cannot be paid: the caller's
 *   grace/release path handles it
 */
import { debitMoneyOrThrow, InsufficientFundsError } from '../../economy/index.mjs';

export async function chargeWeekWithArrearsFallback(
  tx,
  { userId, username, groomCount, unpaidTotal, arrearsTotal, payWeekStart, systemAccount },
) {
  const chargeAttempts = [];
  if (unpaidTotal + arrearsTotal > 0) {
    chargeAttempts.push({ amount: unpaidTotal + arrearsTotal, withArrears: true });
  }
  if (arrearsTotal > 0 && unpaidTotal > 0) {
    chargeAttempts.push({ amount: unpaidTotal, withArrears: false });
  }

  let arrearsSettledNow = false;
  for (const [index, attempt] of chargeAttempts.entries()) {
    try {
      await debitMoneyOrThrow(tx, {
        userId,
        amount: attempt.amount,
        systemAccount,
        category: 'groomSalaryBurn',
        description: `Groom salary weekly run — user ${username}`,
        metadata: {
          groomCount,
          totalSalary: unpaidTotal,
          // Equoria-bgdfb: the owed weeks settled by THIS debit — 0 when
          // the wallet only covered the current week.
          arrears: attempt.withArrears ? arrearsTotal : 0,
          paymentType: 'weeklySalary',
          payWeekStart: payWeekStart.toISOString(), // Equoria-icqqm audit key
        },
      });
      arrearsSettledNow = attempt.withArrears;
      break;
    } catch (debitError) {
      const isLastAttempt = index === chargeAttempts.length - 1;
      if (!(debitError instanceof InsufficientFundsError) || isLastAttempt) {
        // Nothing left to fall back to: this week itself is unaffordable.
        throw debitError;
      }
    }
  }
  return arrearsSettledNow;
}
