import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Equoria-hjzwt: thrown by `debitMoneyOrThrow` when the conditional debit
 * predicate (`money >= amount`) fails. Carries `statusCode: 400` so controllers
 * can let the error propagate and the route's error pipeline maps it to a
 * client-facing 400 response without an inner-try-catch tree.
 *
 * Callers that want to expose a different envelope (e.g. concurrent-race
 * messaging) can do `instanceof InsufficientFundsError` and shape their own
 * response.
 */
export class InsufficientFundsError extends Error {
  constructor(message = 'Insufficient funds') {
    super(message);
    this.name = 'InsufficientFundsError';
    this.statusCode = 400;
  }
}

/**
 * Equoria-hjzwt: atomic debit guard.
 *
 * The historical money pattern across this codebase was
 *   const u = await client.user.findUnique({ where: { id }, select: { money: true } });
 *   if (u.money < cost) return 400;
 *   await client.user.update({ where: { id }, data: { money: { decrement: cost } } });
 * which is a TOCTOU race — two concurrent requests both pass the pre-check
 * and both decrement, taking the wallet negative. This helper replaces that
 * pattern with the only correct shape:
 *   const claim = await client.user.updateMany({
 *     where: { id, money: { gte: cost } },
 *     data: { money: { decrement: cost } },
 *   });
 *   if (claim.count === 0) throw new InsufficientFundsError(...)
 * count===0 means another concurrent debit already drained the balance below
 * `amount` — we surface that as a typed exception, NOT a partial state.
 *
 * Returns the post-decrement balance for ledger consistency: callers should
 * pass it as `balanceAfter` to `recordTransaction` in the same transaction.
 *
 * @param {object} client - PrismaClient OR an interactive transaction client
 *   (`tx` from `prisma.$transaction(async tx => …)`). Always pass `tx` if the
 *   caller wraps the debit + downstream writes in a transaction.
 * @param {object} params
 * @param {string} params.userId - User row id.
 * @param {number} params.amount - Positive integer, currency minor units.
 * @returns {Promise<number>} the balance AFTER the debit lands.
 * @throws {InsufficientFundsError} when the user row no longer satisfies
 *   `money >= amount` at write time (the user doesn't exist, the column is
 *   too low, or a sibling debit drained it during the race).
 */
export async function debitMoneyOrThrow(client, { userId, amount }) {
  if (!userId) {
    throw new Error('debitMoneyOrThrow: userId is required');
  }
  const normalizedAmount = Math.trunc(Number(amount));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('debitMoneyOrThrow: amount must be a positive integer');
  }

  const claim = await client.user.updateMany({
    where: { id: userId, money: { gte: normalizedAmount } },
    data: { money: { decrement: normalizedAmount } },
  });
  if (claim.count === 0) {
    throw new InsufficientFundsError();
  }
  const after = await client.user.findUnique({
    where: { id: userId },
    select: { money: true },
  });
  // Cannot be null in practice: updateMany matched id therefore the row
  // existed at the predicate moment. findUnique race after that would only
  // ever happen on hard-delete, in which case returning 0 is safer than
  // throwing — the debit succeeded and the row was concurrently destroyed.
  return Number(after?.money ?? 0);
}

const LEDGER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS user_transactions (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    "balanceAfter" INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

export async function ensureLedgerTable(client = prisma) {
  await client.$executeRawUnsafe(LEDGER_TABLE_SQL);
  await client.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS user_transactions_user_created_idx ON user_transactions ("userId", "createdAt" DESC)',
  );
  await client.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS user_transactions_category_idx ON user_transactions (category)',
  );
}

export async function recordTransaction(
  { userId, type, amount, category, description, balanceAfter = null, metadata = {} },
  client = prisma,
) {
  await ensureLedgerTable(client);
  const normalizedAmount = Math.trunc(Number(amount));
  if (!userId || !['credit', 'debit'].includes(type) || normalizedAmount <= 0) {
    throw new Error('Invalid ledger transaction payload');
  }

  // Typed Prisma create (replaces $queryRawUnsafe INSERT — Equoria-3ear).
  // The DB CHECK constraint (`type IN ('credit', 'debit')`, `amount > 0`) is
  // preserved by the runtime DDL in ensureLedgerTable + the JS validation
  // above; Prisma does not add CHECK constraints from the schema.
  const row = await client.userTransaction.create({
    data: {
      userId,
      type,
      amount: normalizedAmount,
      category,
      description,
      balanceAfter,
      metadata: metadata ?? {},
    },
    select: {
      id: true,
      type: true,
      amount: true,
      category: true,
      description: true,
      balanceAfter: true,
      createdAt: true,
    },
  });

  return row;
}

export async function getTransactionsForUser(userId, { page = 1, pageSize = 20 } = {}) {
  await ensureLedgerTable();
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
  const skip = (safePage - 1) * safePageSize;

  // Typed Prisma findMany + count (replaces $queryRawUnsafe SELECT — Equoria-3ear).
  // Order matches the prior SQL: createdAt DESC, id DESC for stable pagination
  // when many rows share a timestamp.
  const [rows, total] = await Promise.all([
    prisma.userTransaction.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: safePageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        category: true,
        description: true,
        balanceAfter: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.userTransaction.count({ where: { userId } }),
  ]);

  return {
    transactions: rows.map(row => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      category: row.category,
      description: row.description,
      balanceAfter: row.balanceAfter,
      metadata: row.metadata ?? {},
      timestamp: row.createdAt,
    })),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}
