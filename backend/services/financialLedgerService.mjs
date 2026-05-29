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

/**
 * Equoria-si69u: named system-money account constants.
 *
 * The migration `20260529120000_si69u_add_show_escrow_columns_and_system_accounts`
 * seeds these rows in the `system_accounts` table. Application code references
 * them only through these constants so a typo at a call site is a compile-time
 * error, not a silent miss.
 */
export const SYSTEM_ACCOUNT_SHOW_ESCROW = 'show_escrow';
export const SYSTEM_ACCOUNT_BURN = 'burn';

/**
 * Equoria-si69u: thrown when a debit against a SystemAccount would drive its
 * balance negative. Symmetric with `InsufficientFundsError` for user-money so
 * call sites can `instanceof` discriminate either type from the same try/catch.
 */
export class InsufficientSystemAccountBalanceError extends Error {
  constructor(name, requested, available) {
    super(
      `SystemAccount "${name}" has ${available} but ${requested} was requested`,
    );
    this.name = 'InsufficientSystemAccountBalanceError';
    this.statusCode = 500;
    this.accountName = name;
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Equoria-si69u: credit a named SystemAccount by `amount` and write a paired
 * row to the user_transactions ledger.
 *
 * The system_accounts row is mutated through `prisma.systemAccount.update`
 * (NOT updateMany) because credits cannot fail on a balance predicate — they
 * always succeed unless the row is missing, in which case the function throws
 * loudly because that means the migration seed never ran (a hard environmental
 * misconfiguration the operator must fix, not a silently-skippable case).
 *
 * The paired ledger row is written via `recordTransaction` with `userId =
 * null` is NOT possible (the column is NOT NULL); instead we encode the
 * counterparty in `metadata.systemAccount` and use `userId` = the "owner of
 * the move" if known. The optional `linkedUserId` arg lets callers attribute
 * the ledger row (e.g. for a show-creator's prize debit, linkedUserId = the
 * creator's id so their transaction history shows the move).
 *
 * @param {object} client - Prisma client OR an interactive transaction `tx`.
 * @param {string} name - One of `SYSTEM_ACCOUNT_*` constants.
 * @param {number} amount - Positive integer.
 * @param {object} opts
 * @param {string} opts.category - Ledger category (e.g. 'show_create_prize_escrow').
 * @param {string} [opts.description] - Human-readable ledger row.
 * @param {string} [opts.linkedUserId] - Attribute the paired ledger row to this user.
 * @param {object} [opts.metadata] - Extra ledger metadata.
 * @returns {Promise<number>} the post-credit balance.
 */
export async function creditSystemAccount(
  client,
  name,
  amount,
  { category, description = '', linkedUserId = null, metadata = {} } = {},
) {
  const normalized = Math.trunc(Number(amount));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('creditSystemAccount: amount must be a positive integer');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('creditSystemAccount: name is required');
  }
  if (!category) {
    throw new Error('creditSystemAccount: category is required (ledger audit trail)');
  }

  const updated = await client.systemAccount.update({
    where: { name },
    data: { balance: { increment: normalized } },
    select: { balance: true },
  });

  // Only write a ledger row if we have a user counterparty to attribute it
  // to. The user_transactions table has a NOT NULL userId; system-to-system
  // moves (escrow → burn) don't fit that schema and the migration explicitly
  // does not extend it — they are audited via the SystemAccount.balance
  // mutations alone, paired in the same transaction.
  if (linkedUserId) {
    await recordTransaction(
      {
        userId: linkedUserId,
        type: 'credit',
        amount: normalized,
        category,
        description: description || `Credit to system account ${name}`,
        balanceAfter: null,
        metadata: { ...metadata, systemAccount: name, systemAccountSide: 'credit' },
      },
      client,
    );
  }

  return Number(updated.balance);
}

/**
 * Equoria-si69u: debit a named SystemAccount by `amount` and write a paired
 * ledger row. Atomic predicate: `balance >= amount`; on count===0 throws
 * `InsufficientSystemAccountBalanceError`.
 *
 * Same shape as `debitMoneyOrThrow` so call sites mirror each other.
 *
 * @returns {Promise<number>} the post-debit balance.
 */
export async function debitSystemAccountOrThrow(
  client,
  name,
  amount,
  { category, description = '', linkedUserId = null, metadata = {} } = {},
) {
  const normalized = Math.trunc(Number(amount));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('debitSystemAccountOrThrow: amount must be a positive integer');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('debitSystemAccountOrThrow: name is required');
  }
  if (!category) {
    throw new Error('debitSystemAccountOrThrow: category is required (ledger audit trail)');
  }

  const claim = await client.systemAccount.updateMany({
    where: { name, balance: { gte: normalized } },
    data: { balance: { decrement: normalized } },
  });
  if (claim.count === 0) {
    const row = await client.systemAccount.findUnique({
      where: { name },
      select: { balance: true },
    });
    throw new InsufficientSystemAccountBalanceError(
      name,
      normalized,
      row ? Number(row.balance) : 0,
    );
  }

  const after = await client.systemAccount.findUnique({
    where: { name },
    select: { balance: true },
  });

  if (linkedUserId) {
    await recordTransaction(
      {
        userId: linkedUserId,
        type: 'debit',
        amount: normalized,
        category,
        description: description || `Debit from system account ${name}`,
        balanceAfter: null,
        metadata: { ...metadata, systemAccount: name, systemAccountSide: 'debit' },
      },
      client,
    );
  }

  return Number(after?.balance ?? 0);
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
