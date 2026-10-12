-- CreateTable
CREATE TABLE "staff_action_log" (
    "id" SERIAL NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    "reversesId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_checkin_codes" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_checkin_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_trusted_devices" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_tickets" (
    "id" SERIAL NOT NULL,
    "filedById" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_ticket_replies" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_ticket_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_action_log_reversesId_key" ON "staff_action_log"("reversesId");

-- CreateIndex
CREATE INDEX "staff_action_log_actorId_createdAt_idx" ON "staff_action_log"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "staff_action_log_targetType_targetId_idx" ON "staff_action_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "staff_action_log_capability_idx" ON "staff_action_log"("capability");

-- CreateIndex
CREATE INDEX "staff_checkin_codes_userId_createdAt_idx" ON "staff_checkin_codes"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "staff_trusted_devices_tokenHash_key" ON "staff_trusted_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "staff_trusted_devices_userId_idx" ON "staff_trusted_devices"("userId");

-- CreateIndex
CREATE INDEX "staff_tickets_status_createdAt_idx" ON "staff_tickets"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "staff_tickets_filedById_idx" ON "staff_tickets"("filedById");

-- CreateIndex
CREATE INDEX "staff_ticket_replies_ticketId_createdAt_idx" ON "staff_ticket_replies"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "staff_action_log" ADD CONSTRAINT "staff_action_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_action_log" ADD CONSTRAINT "staff_action_log_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "staff_action_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_checkin_codes" ADD CONSTRAINT "staff_checkin_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_trusted_devices" ADD CONSTRAINT "staff_trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_tickets" ADD CONSTRAINT "staff_tickets_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ticket_replies" ADD CONSTRAINT "staff_ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "staff_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ticket_replies" ADD CONSTRAINT "staff_ticket_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
