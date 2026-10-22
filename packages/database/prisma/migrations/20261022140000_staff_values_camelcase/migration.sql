-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included. Data only; no schema change.
--
-- 1. Staff ticket status in_progress -> inProgress, in the tickets and in the
--    copies the game keeps: the staff action log's before/after for tickets,
--    and the status carried by ticket-update bells.
-- 2. Ticket emails: templateKey staff_ticket -> staffTicket, and the matching
--    idempotency-key prefix ('staff_ticket:<ticketId>:<userId>').
-- 3. Audit log operation classifiers: account_operation, admin_operation,
--    groom_operation, stat_modification -> accountOperation, adminOperation,
--    groomOperation, statModification.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old spelling survives.

BEGIN;

UPDATE "staff_tickets" SET "status" = 'inProgress' WHERE "status" = 'in_progress';

UPDATE "staff_action_log"
SET "before" = jsonb_set("before", '{status}', '"inProgress"')
WHERE "targetType" = 'ticket' AND jsonb_typeof("before") = 'object' AND "before"->>'status' = 'in_progress';

UPDATE "staff_action_log"
SET "after" = jsonb_set("after", '{status}', '"inProgress"')
WHERE "targetType" = 'ticket' AND jsonb_typeof("after") = 'object' AND "after"->>'status' = 'in_progress';

UPDATE "Notification"
SET "payload" = jsonb_set("payload", '{status}', '"inProgress"')
WHERE "type" = 'staff_ticket_update' AND jsonb_typeof("payload") = 'object' AND "payload"->>'status' = 'in_progress';

UPDATE "email_outbox" SET "templateKey" = 'staffTicket' WHERE "templateKey" = 'staff_ticket';

UPDATE "email_outbox"
SET "idempotencyKey" = 'staffTicket:' || substr("idempotencyKey", length('staff_ticket:') + 1)
WHERE "idempotencyKey" LIKE 'staff\_ticket:%';

UPDATE "audit_logs" SET "action" = 'accountOperation' WHERE "action" = 'account_operation';
UPDATE "audit_logs" SET "action" = 'adminOperation' WHERE "action" = 'admin_operation';
UPDATE "audit_logs" SET "action" = 'groomOperation' WHERE "action" = 'groom_operation';
UPDATE "audit_logs" SET "action" = 'statModification' WHERE "action" = 'stat_modification';

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "staff_tickets" WHERE "status" = 'in_progress')
    + (SELECT COUNT(*) FROM "staff_action_log"
       WHERE "targetType" = 'ticket'
         AND ((jsonb_typeof("before") = 'object' AND "before"->>'status' = 'in_progress')
           OR (jsonb_typeof("after") = 'object' AND "after"->>'status' = 'in_progress')))
    + (SELECT COUNT(*) FROM "Notification"
       WHERE "type" = 'staff_ticket_update' AND jsonb_typeof("payload") = 'object'
         AND "payload"->>'status' = 'in_progress')
    + (SELECT COUNT(*) FROM "email_outbox"
       WHERE "templateKey" = 'staff_ticket' OR "idempotencyKey" LIKE 'staff\_ticket:%')
    + (SELECT COUNT(*) FROM "audit_logs"
       WHERE "action" IN ('account_operation', 'admin_operation', 'groom_operation', 'stat_modification'))
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'staff_values_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
