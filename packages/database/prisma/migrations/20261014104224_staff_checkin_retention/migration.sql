-- CreateIndex
CREATE INDEX "staff_checkin_codes_usedAt_idx" ON "staff_checkin_codes"("usedAt");

-- CreateIndex
CREATE INDEX "staff_checkin_codes_expiresAt_idx" ON "staff_checkin_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "staff_trusted_devices_revokedAt_idx" ON "staff_trusted_devices"("revokedAt");

-- CreateIndex
CREATE INDEX "staff_trusted_devices_expiresAt_idx" ON "staff_trusted_devices"("expiresAt");
