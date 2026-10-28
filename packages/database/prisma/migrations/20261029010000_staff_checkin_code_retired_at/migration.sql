-- Owner ruling 2026-10-28 (q261, Equoria-8pzlg): any password or email change cancels
-- every staff check-in code sent before it, including one issued in the same
-- millisecond. Until now a cancelled code was only marked expired (expiresAt = the
-- change time), so a server clock set back behind that time would revive it.
-- retiredAt records the cancellation itself; check-in refuses any code that carries
-- it, whatever the clock says. Existing rows stay NULL: every code alive today was
-- issued under its account's current security state.
ALTER TABLE "staff_checkin_codes" ADD COLUMN "retiredAt" TIMESTAMP(3);
