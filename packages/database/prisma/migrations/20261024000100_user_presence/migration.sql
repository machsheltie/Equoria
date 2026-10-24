-- Equoria-vc5x1 (owner request 2026-10-23): the Need Help? page shows whether
-- each staff member is online, so the game records when an account was last
-- active. It lives in its OWN table, not on "User": a write to the User row
-- from every authenticated request interferes with the User-row locks and the
-- settings compare-and-swap that player-state transactions rely on.
--
-- Deliberately NO foreign key to "User". An FK insert takes FOR KEY SHARE on
-- the parent row, which waits behind (and can be blocked by) another
-- transaction's FOR UPDATE on that user. The presence stamp is best-effort
-- and must never wait for, or disturb, a player-state transaction.
--
-- An earlier unmerged draft put "lastActiveAt" on "User"; drop it if present
-- so databases that applied the draft and fresh databases end up identical.
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastActiveAt";

CREATE TABLE "user_presence" (
    "userId" TEXT NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_presence_pkey" PRIMARY KEY ("userId")
);
