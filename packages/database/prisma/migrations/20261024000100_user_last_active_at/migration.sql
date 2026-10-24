-- Equoria-vc5x1 (owner request 2026-10-23): the Need Help? page shows whether
-- each staff member is online. No presence signal existed (RefreshToken
-- lastActivityAt is never written), so the account records when it was last
-- active. authenticateToken stamps it at most once a minute; "online" means
-- active in the last 5 minutes. Existing accounts start with no value (offline).
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
