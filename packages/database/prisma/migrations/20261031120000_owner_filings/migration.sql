-- Equoria-brh8c (owner rulings q158, q234): the owner's "File for Claude Code".
--
-- From the Steward's Office the owner files a Diagnose report (a held show, a groom's or
-- rider's payroll failure, the server's memory and speed). The redacted report is kept
-- here; a Claude Code session runs scripts/import-owner-filings.mjs, which turns each
-- unimported row into an issue in the game's issue list (beads) and records its id.
--
-- No existing table fits: staff_tickets are moderator-to-admin notes that every admin
-- reads, and these reports are the owner's alone.
--
-- "filingKey" makes filing idempotent: the same failure filed twice is one row.
-- "filedById" is the owner's account id, kept without a foreign key (accounts are never
-- deleted, and a filing must outlive any change to the account row).
-- Additive only: backward compatible with the previous application release.

CREATE TABLE "owner_filings" (
    "id" SERIAL NOT NULL,
    "filingKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "filedById" TEXT,
    "beadId" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_filings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "owner_filings_filingKey_key" ON "owner_filings"("filingKey");

CREATE INDEX "owner_filings_importedAt_id_idx" ON "owner_filings"("importedAt", "id");
