import prisma from '../../../../packages/database/prismaClient.mjs';

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
 * Equoria-hjzwt: atomic debit guard. Equoria-kl16c: paired-conservation guard.
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
 * Equoria-kl16c (money conservation): the historical signature debited the
 * user's money WITHOUT crediting any counterparty, so every sink that called
 * it destroyed money invisibly to the conservation invariant
 * (`sum(User.money) + sum(SystemAccount.balance)` constant across a move).
 * The hjtys audit found 13 such unpaired sinks. Rather than ask every caller
 * to remember a separate `creditSystemAccount` (which is exactly what gets
 * forgotten when an 11th sink is added), this function now PAIRS the credit
 * internally and makes `systemAccount` + `category` REQUIRED — an unpaired
 * user-money debit is structurally impossible to express through this helper.
 *
 * The credit runs against the SAME `client`, so when callers pass a `tx`
 * (the required shape — see below) the debit and the SystemAccount credit
 * commit or roll back together. The paired ledger row written by
 * `creditSystemAccount` is attributed to the debited user via `linkedUserId`,
 * so the move shows up in the user's transaction history as well as the
 * SystemAccount.balance mutation.
 *
 * Returns the post-decrement balance for ledger consistency: callers should
 * pass it as `balanceAfter` to `recordTransaction` in the same transaction.
 *
 * @param {object} client - PrismaClient OR an interactive transaction client
 *   (`tx` from `prisma.$transaction(async tx => …)`). Pass `tx` so the user
 *   debit and the paired SystemAccount credit share rollback semantics. A
 *   bare `prisma` works at runtime but splits the two halves of the move into
 *   separate autocommits — callers that have a counterparty credit (i.e. all
 *   of them now) should be inside a transaction.
 * @param {object} params
 * @param {string} params.userId - User row id.
 * @param {number} params.amount - Positive integer, currency minor units.
 * @param {string} params.systemAccount - REQUIRED. One of the
 *   `SYSTEM_ACCOUNT_*` constants naming the counterparty the debited money
 *   moves TO (e.g. `SYSTEM_ACCOUNT_BURN` for a fee/purchase sink). Omitting
 *   it throws — there is no unpaired-debit path.
 * @param {string} params.category - REQUIRED. Ledger category for the paired
 *   credit row (e.g. 'crafting_fee_burn').
 * @param {string} [params.description] - Human-readable ledger description for
 *   the paired credit row.
 * @param {object} [params.metadata] - Extra metadata for the paired credit row.
 * @returns {Promise<number>} the balance AFTER the debit lands.
 * @throws {InsufficientFundsError} when the user row no longer satisfies
 *   `money >= amount` at write time (the user doesn't exist, the column is
 *   too low, or a sibling debit drained it during the race).
 */
export async function debitMoneyOrThrow(
  client,
  { userId, amount, systemAccount, category, description = '', metadata = {} } = {},
) {
  if (!userId) {
    throw new Error('debitMoneyOrThrow: userId is required');
  }
  const normalizedAmount = Math.trunc(Number(amount));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('debitMoneyOrThrow: amount must be a positive integer');
  }
  // Equoria-kl16c: systemAccount + category are required so an unpaired
  // user-money debit (the hjtys defect class) cannot be expressed.
  if (!systemAccount || typeof systemAccount !== 'string') {
    throw new Error(
      'debitMoneyOrThrow: systemAccount is required (the counterparty the money moves to — e.g. SYSTEM_ACCOUNT_BURN). Money conservation: every user debit must pair a SystemAccount credit.',
    );
  }
  if (!category) {
    throw new Error(
      'debitMoneyOrThrow: category is required (ledger audit trail for the paired credit)',
    );
  }

  const claim = await client.user.updateMany({
    where: { id: userId, money: { gte: normalizedAmount } },
    data: { money: { decrement: normalizedAmount } },
  });
  if (claim.count === 0) {
    throw new InsufficientFundsError();
  }

  // Equoria-kl16c: pair the user debit with a SystemAccount credit IN THE
  // SAME client. The money that left the user's wallet now lands in the
  // named SystemAccount, keeping `sum(User.money) + sum(SystemAccount.balance)`
  // invariant across the move. linkedUserId attributes the paired ledger row
  // to the debited user so it appears in their transaction history.
  await creditSystemAccount(client, systemAccount, normalizedAmount, {
    category,
    description,
    linkedUserId: userId,
    metadata,
  });

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
    super(`SystemAccount "${name}" has ${available} but ${requested} was requested`);
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
    // Equoria-jou5c: tx-first ledger writer; skipBalanceRead because the
    // user is the counterparty (attribution) of a system-account move,
    // not the principal whose money column shifted in this tx. Persisting
    // null is the honest sentinel — a real balance snapshot would mislead
    // anyone reading the row as the user's post-move money.
    await recordTransactionTx(client, {
      userId: linkedUserId,
      type: 'credit',
      amount: normalized,
      category,
      description: description || `Credit to system account ${name}`,
      metadata: { ...metadata, systemAccount: name, systemAccountSide: 'credit' },
      skipBalanceRead: true,
    });
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
    // Equoria-jou5c: tx-first ledger writer; skipBalanceRead because the
    // user is the counterparty (attribution) of a system-account move,
    // not the principal whose money column shifted in this tx. See the
    // identical comment in creditSystemAccount above.
    await recordTransactionTx(client, {
      userId: linkedUserId,
      type: 'debit',
      amount: normalized,
      category,
      description: description || `Debit from system account ${name}`,
      metadata: { ...metadata, systemAccount: name, systemAccountSide: 'debit' },
      skipBalanceRead: true,
    });
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

/**
 * BOOTSTRAP-ONLY: ensures the user_transactions table exists.
 *
 * Equoria-kz86s (2026-06-01): this runtime DDL is NO LONGER invoked on any
 * production request path. The `user_transactions` table is migration-owned
 * (`20260414000000_add_user_transactions`) and modelled in schema.prisma
 * (`model UserTransaction`), so the request-path ledger writers
 * (`recordTransaction`, `recordTransactionTx`, `getTransactionsForUser`) no
 * longer call this — they assume the migration ran. A request path must not
 * create schema objects (it masks a missing migration as success, and
 * `CREATE TABLE IF NOT EXISTS` on every write is needless DDL load).
 *
 * The function is retained as an explicit, opt-in bootstrap fallback for the
 * rare path that runs application code before `migrate deploy` (and for the
 * idempotency unit test). Call it deliberately at bootstrap; never on a hot
 * request path.
 *
 * Equoria-z8leh (2026-05-29): the two runtime CREATE INDEX calls that used
 * to live here were the structural source of the qh6jk migration-history
 * drift — they recreated the orphan-named index
 * user_transactions_user_created_idx (and user_transactions_category_idx)
 * after each cleanup migration DROPped them. Both indexes are now declared
 * canonically via Prisma @@index decorators on model UserTransaction
 * (userId+createdAt and category) AND created by the original
 * 20260414000000_add_user_transactions migration.
 *
 * Sentinel test:
 * backend/modules/users/__tests__/financialLedgerService.noRuntimeCreateIndex.sentinel.test.mjs
 */
export async function ensureLedgerTable(client = prisma) {
  await client.$executeRawUnsafe(LEDGER_TABLE_SQL);
}

export async function recordTransaction(
  { userId, type, amount, category, description, balanceAfter = null, metadata = {} },
  client = prisma,
) {
  // Equoria-kz86s: no runtime ensureLedgerTable() on the request path. The
  // user_transactions table is migration-owned; creating schema objects per
  // write is forbidden DDL on a hot path (and masks a missing migration).
  const normalizedAmount = Math.trunc(Number(amount));
  if (!userId || !['credit', 'debit'].includes(type) || normalizedAmount <= 0) {
    throw new Error('Invalid ledger transaction payload');
  }

  // Typed Prisma create (replaces $queryRawUnsafe INSERT — Equoria-3ear).
  // The DB CHECK constraint (`type IN ('credit', 'debit')`, `amount > 0`) is
  // enforced by the migration that owns the table + the JS validation above;
  // Prisma does not add CHECK constraints from the schema.
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

/**
 * Equoria-pqp69: tx-first ledger writer.
 *
 * Why this exists (the defect class the legacy `recordTransaction` invites):
 * the legacy signature `recordTransaction(opts, client)` makes BOTH `tx` and
 * `balanceAfter` caller-supplied conventions. A future caller that omits
 * `client` (defaulting to the autocommit `prisma` singleton) writes the
 * ledger row OUTSIDE the parent's `$transaction`. If the parent then rolls
 * back, the money mutation reverts but the ledger row persists — silent
 * ledger drift. Likewise, a caller that types the wrong `balanceAfter`
 * (stale read, off-by-one decrement) ships an inaccurate audit trail with
 * no DB-level check to catch it.
 *
 * This function fixes both by construction:
 *  - `tx` is a REQUIRED FIRST positional. Forgetting it throws synchronously,
 *    not silently writes to the autocommit client. There is no `= prisma`
 *    default.
 *  - `balanceAfter` is read INTERNALLY via `tx.user.findUnique` immediately
 *    before the create, inside the same transaction. The caller cannot
 *    supply a wrong value because the caller does not supply it at all.
 *
 * Rollback semantics: because both the balance read AND the ledger write
 * use `tx`, a `throw` after this call (anywhere inside the parent's
 * `$transaction` callback) rolls back the ledger row alongside the
 * money mutation — proven by the sentinel test
 * `financialLedgerService.recordTransactionTx.test.mjs`.
 *
 * Migration: existing call sites still use the legacy `recordTransaction`.
 * Per AC + OPTIMAL_FIX_DISCIPLINE §3 (do not bundle), each call-site
 * migration is filed as a separate bd issue and is NOT part of this PR.
 *
 * @param {object} tx - REQUIRED. The `tx` client from
 *   `prisma.$transaction(async tx => …)`. Passing the bare `prisma`
 *   singleton works at runtime but defeats the rollback-safety guarantee;
 *   callers that don't have a transaction context should be writing one,
 *   not calling this fn outside one.
 * @param {object} opts
 * @param {string} opts.userId - User row id. The authoritative `balanceAfter`
 *   is read from `tx.user.findUnique({ where: { id: userId }, ... })`.
 * @param {'credit'|'debit'} opts.type
 * @param {number} opts.amount - Positive integer.
 * @param {string} opts.category - Ledger category.
 * @param {string} opts.description - Human-readable ledger row.
 * @param {object} [opts.metadata] - Extra ledger metadata (JSONB).
 * @param {boolean} [opts.skipBalanceRead=false] - When true, persist
 *   `balanceAfter = null` instead of reading the user's money inside the tx.
 *   Equoria-jou5c: this exists for system-account counterparty ledger rows
 *   (creditSystemAccount / debitSystemAccountOrThrow's `linkedUserId` path).
 *   In those moves the user is an attribution counterparty, not a balance
 *   principal — their money column may not even be mutated by the parent
 *   tx, and reading it would persist a meaningless snapshot that callers
 *   could misread as the post-move balance. `null` is the honest sentinel
 *   for "this ledger row does not represent a change to user.money".
 *   General-purpose call sites should leave this `false` so the structural
 *   guarantee (balanceAfter sourced from the same tx) stays the default.
 * @returns {Promise<object>} the inserted row with balanceAfter set to the
 *   value read from the same tx, or null when skipBalanceRead is true.
 */
export async function recordTransactionTx(
  tx,
  { userId, type, amount, category, description, metadata = {}, skipBalanceRead = false } = {},
) {
  // Fail fast (synchronously) if `tx` is missing. The whole point of this
  // signature is that omitting tx is structurally impossible to do silently.
  if (!tx || typeof tx.userTransaction?.create !== 'function') {
    throw new Error(
      'recordTransactionTx: tx (interactive transaction client) is required as the first argument',
    );
  }

  // Equoria-kz86s: no runtime ensureLedgerTable() inside the tx. The table is
  // migration-owned; issuing CREATE TABLE DDL inside a money transaction is
  // both unnecessary and a needless lock surface on the hot path.
  const normalizedAmount = Math.trunc(Number(amount));
  if (!userId || !['credit', 'debit'].includes(type) || normalizedAmount <= 0) {
    throw new Error('Invalid ledger transaction payload');
  }

  // Authoritative balance read — inside the same tx so it observes the
  // parent's prior money mutation. If the row was hard-deleted (the user
  // was concurrently destroyed mid-transaction), fall back to `null` rather
  // than throwing: the ledger row is still useful for audit, and the parent
  // tx will likely fail elsewhere on the missing FK anyway.
  //
  // Equoria-jou5c: when skipBalanceRead is true (system-account counterparty
  // path), persist balanceAfter = null instead — the user is not a balance
  // principal of this move and reading their money would be a misleading
  // snapshot. The read is skipped entirely so callers don't pay for an
  // extra round-trip just to throw the result away.
  let balanceAfter = null;
  if (!skipBalanceRead) {
    const balanceRow = await tx.user.findUnique({
      where: { id: userId },
      select: { money: true },
    });
    balanceAfter = balanceRow ? Number(balanceRow.money) : null;
  }

  const row = await tx.userTransaction.create({
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
  // Equoria-kz86s: no runtime ensureLedgerTable() on this read path either.
  // The table is migration-owned; a read should never issue DDL.
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
