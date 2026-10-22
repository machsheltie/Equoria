-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included. Data only; no schema change.
--
-- Notification.type: every snake_case notification type the game has written
-- becomes its camelCase spelling (stat_gain -> statGain, staff_ticket_update ->
-- staffTicketUpdate, ...). The same strings are the live event-stream names,
-- which are not stored.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old spelling survives.

BEGIN;

CREATE TEMP TABLE "notification_type_rename" ("old" TEXT PRIMARY KEY, "new" TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO "notification_type_rename" ("old", "new") VALUES
  ('stat_gain', 'statGain'),
  ('foal_born', 'foalBorn'),
  ('competition_placement', 'competitionPlacement'),
  ('competition_stat_gain', 'competitionStatGain'),
  ('horse_purchased', 'horsePurchased'),
  ('horse_sold', 'horseSold'),
  ('forum_reply', 'forumReply'),
  ('club_leadership_transferred', 'clubLeadershipTransferred'),
  ('groom_retired', 'groomRetired'),
  ('groom_fee_unpaid', 'groomFeeUnpaid'),
  ('groom_released', 'groomReleased'),
  ('trait_discovery', 'traitDiscovery'),
  ('stud_booked', 'studBooked'),
  ('stud_request_received', 'studRequestReceived'),
  ('stud_request_approved', 'studRequestApproved'),
  ('stud_request_declined', 'studRequestDeclined'),
  ('stud_request_cancelled', 'studRequestCancelled'),
  ('staff_ticket', 'staffTicket'),
  ('staff_ticket_update', 'staffTicketUpdate');

UPDATE "Notification" n
SET "type" = r."new"
FROM "notification_type_rename" r
WHERE n."type" = r."old";

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT COUNT(*) INTO leftover
  FROM "Notification" n
  JOIN "notification_type_rename" r ON n."type" = r."old";
  IF leftover > 0 THEN
    RAISE EXCEPTION 'notification_types_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
