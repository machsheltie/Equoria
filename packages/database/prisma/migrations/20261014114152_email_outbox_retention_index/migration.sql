-- CreateIndex
CREATE INDEX "email_outbox_status_updatedAt_idx" ON "email_outbox"("status", "updatedAt");
