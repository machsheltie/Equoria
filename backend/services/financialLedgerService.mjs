import prisma from '../../packages/database/prismaClient.mjs';

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
