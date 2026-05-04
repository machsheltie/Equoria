-- CWE-613 mitigation: track last password rotation time so the JWT-verify
-- middleware can reject access tokens whose `iat` predates the rotation.
-- Nullable: existing rows have no constraint (users who have never rotated
-- their password retain valid pre-existing sessions until natural expiry).

ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
