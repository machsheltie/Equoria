-- Equoria-iqzn: COPPA age verification at registration.
-- dateOfBirth is collected at registration; the server computes the real
-- calendar age and rejects under-13 registrations BEFORE the user row is
-- created. Nullable so existing (pre-gate) accounts are unaffected; all
-- NEW rows created after this migration carry a DOB that passed the >=13
-- age gate. Treated as sensitive PII (redacted from audit/request logs).

ALTER TABLE "User" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
