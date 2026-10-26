-- Equoria-w47x7 / Equoria-puj1e.2 (owner ruling q77, 2026-10-26): player conduct.
-- Warnings, freezes of 1, 3 or 7 days, account bans, and IP and device bans.
--
-- Additive only: three new tables.
--   conduct_records  one row per steward action on an account (warning, freeze,
--                    ban); removed with the account.
--   login_sightings  where an account has signed in from (request IP and the
--                    SHA-256 of the game's own device cookie), so an IP or device
--                    ban can name the connection; removed with the account.
--   conduct_blocks   an IP or device ban. No foreign key to "User": a ban must
--                    outlive the account it was issued through.

-- CreateTable
CREATE TABLE "conduct_records" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedByRole" TEXT NOT NULL,
    "freezeDays" INTEGER,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conduct_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_sightings" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "deviceHash" VARCHAR(64) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_sightings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conduct_blocks" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "value" VARCHAR(64) NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedByRole" TEXT NOT NULL,
    "sourceUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conduct_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conduct_records_userId_createdAt_idx" ON "conduct_records"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "conduct_records_userId_kind_idx" ON "conduct_records"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "login_sightings_userId_ipAddress_deviceHash_key" ON "login_sightings"("userId", "ipAddress", "deviceHash");

-- CreateIndex
CREATE INDEX "login_sightings_userId_lastSeenAt_idx" ON "login_sightings"("userId", "lastSeenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conduct_blocks_kind_value_key" ON "conduct_blocks"("kind", "value");

-- AddForeignKey
ALTER TABLE "conduct_records" ADD CONSTRAINT "conduct_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sightings" ADD CONSTRAINT "login_sightings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
