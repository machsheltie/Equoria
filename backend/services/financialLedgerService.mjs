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

  const rows = await client.$queryRawUnsafe(
    `INSERT INTO user_transactions
       ("userId", type, amount, category, description, "balanceAfter", metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, type, amount, category, description, "balanceAfter", "createdAt"`,
    userId,
    type,
    normalizedAmount,
    category,
    description,
    balanceAfter,
    JSON.stringify(metadata ?? {}),
  );

  return rows[0];
}

export async function getTransactionsForUser(userId, { page = 1, pageSize = 20 } = {}) {
  await ensureLedgerTable();
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number.parseInt(pageSize, 10) || 20));
  const offset = (safePage - 1) * safePageSize;

  const totalRows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS total FROM user_transactions WHERE "userId" = $1',
    userId,
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, type, amount, category, description, "balanceAfter", metadata, "createdAt"
     FROM user_transactions
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC, id DESC
     LIMIT $2 OFFSET $3`,
    userId,
    safePageSize,
    offset,
  );

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
    total: totalRows[0]?.total ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}
