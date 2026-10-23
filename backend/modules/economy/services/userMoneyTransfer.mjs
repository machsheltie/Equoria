/**
 * Player-to-player money moves (Equoria-e7tgc.3).
 *
 * Why this exists: every payment from one player to another (the stud fee at a
 * public booking and at a private-request approval; buyHorse still carries its
 * own copy, Equoria-t8v8t) used to repeat "guarded debit, credit, two ledger
 * rows" inline. Copies drift — a credit without its guarded debit, a ledger
 * row on the wrong side, a flipped lock order — and each drift mints or burns
 * coin. `debitMoneyOrThrow` cannot serve here: it pairs every debit with a
 * SystemAccount credit (Equoria-kl16c), and a player-to-player payment has a
 * player on both sides.
 *
 * `transferUserMoneyOrThrow` makes an unpaired or double-booked transfer
 * impossible to express: one call moves the money from one player to the
 * other and writes both ledger rows, all on the caller's transaction, so
 * sum(User.money) is unchanged across the call and a later throw in the
 * caller's transaction rolls every part of it back.
 */
import { InsufficientFundsError, recordTransactionTx } from './financialLedgerService.mjs';

/** The payee's User row did not exist when the transfer tried to credit it. */
export class TransferPayeeNotFoundError extends Error {
  constructor(toUserId) {
    super(`transferUserMoneyOrThrow: payee ${toUserId} not found`);
    this.name = 'TransferPayeeNotFoundError';
    this.statusCode = 409;
  }
}

function isInteractiveTransaction(tx) {
  // The root PrismaClient has `$transaction`; an interactive transaction
  // client does not (Prisma denies it inside a transaction). Passing the root
  // client would split the move into separate autocommits.
  return Boolean(tx) && typeof tx.user?.updateMany === 'function' && tx.$transaction === undefined;
}

/**
 * Move `amount` coins from one player to another inside the caller's
 * transaction, and write the paired debit and credit ledger rows.
 *
 * Lock order (the repository ruling, txUserBeforeHorseLockOrder.sentinel):
 * the two User rows are locked in ascending id order, before the caller
 * touches any Horse row. No coin is credited before the guarded debit has
 * succeeded: when the payee's id sorts first, its row is locked with a no-op
 * update, then the payer is debited, then the payee is credited. A shortfall
 * therefore leaves both balances exactly as they were, even for a caller that
 * catches the error and commits.
 *
 * Callers must not catch `TransferPayeeNotFoundError` and commit: when the
 * payer's id sorts first the debit has already landed and only the
 * transaction's rollback restores it.
 *
 * @param {object} tx - REQUIRED interactive transaction client
 *   (`prisma.$transaction(async tx => …)`); the root client is refused.
 * @param {object} params
 * @param {string} params.fromUserId - the payer
 * @param {string} params.toUserId - the payee (never the payer)
 * @param {number} params.amount - a positive integer number of coins
 * @param {string} params.debitCategory - ledger category of the payer's row
 * @param {string} params.creditCategory - ledger category of the payee's row
 * @param {string} [params.debitDescription] - ledger text of the payer's row
 * @param {string} [params.creditDescription] - ledger text of the payee's row
 * @param {object} [params.metadata] - shared ledger metadata; each row also
 *   records the other player as `counterpartyId`
 * @returns {Promise<{ fromBalanceAfter: number, toBalanceAfter: number }>}
 * @throws {InsufficientFundsError} the payer's balance is below `amount` at
 *   write time
 * @throws {TransferPayeeNotFoundError} the payee's User row does not exist
 */
export async function transferUserMoneyOrThrow(
  tx,
  {
    fromUserId,
    toUserId,
    amount,
    debitCategory,
    creditCategory,
    debitDescription = '',
    creditDescription = '',
    metadata = {},
  } = {},
) {
  if (!isInteractiveTransaction(tx)) {
    throw new Error(
      'transferUserMoneyOrThrow: an interactive transaction client is required as the first argument',
    );
  }
  if (!fromUserId || !toUserId) {
    throw new Error('transferUserMoneyOrThrow: fromUserId and toUserId are required');
  }
  if (fromUserId === toUserId) {
    throw new Error('transferUserMoneyOrThrow: a player cannot pay themselves');
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('transferUserMoneyOrThrow: amount must be a positive integer');
  }
  if (!debitCategory) {
    throw new Error('transferUserMoneyOrThrow: debitCategory is required');
  }
  if (!creditCategory) {
    throw new Error('transferUserMoneyOrThrow: creditCategory is required');
  }

  const lockPayee = async increment => {
    const credit = await tx.user.updateMany({
      where: { id: toUserId },
      data: { money: { increment } },
    });
    if (credit.count !== 1) {
      throw new TransferPayeeNotFoundError(toUserId);
    }
  };

  if (toUserId < fromUserId) {
    await lockPayee(0);
  }
  const debit = await tx.user.updateMany({
    where: { id: fromUserId, money: { gte: amount } },
    data: { money: { decrement: amount } },
  });
  if (debit.count !== 1) {
    throw new InsufficientFundsError();
  }
  await lockPayee(amount);

  const paid = await recordTransactionTx(tx, {
    userId: fromUserId,
    type: 'debit',
    amount,
    category: debitCategory,
    description: debitDescription,
    metadata: { ...metadata, counterpartyId: toUserId },
  });
  const received = await recordTransactionTx(tx, {
    userId: toUserId,
    type: 'credit',
    amount,
    category: creditCategory,
    description: creditDescription,
    metadata: { ...metadata, counterpartyId: fromUserId },
  });

  return { fromBalanceAfter: paid.balanceAfter, toBalanceAfter: received.balanceAfter };
}
