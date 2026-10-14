# Staff Foundation Contract (the Steward's Office)

- **Status:** Active contract
- **Owner:** Project owner (Stacey)
- **Last verified:** 2026-10-12
- **Load only when:** designing, planning, implementing, or reviewing staff
  roles, the Steward's Office page, staff 2FA, the staff action log, or staff
  tickets
- **Do not load for:** player-facing features, player MFA, or the individual
  moderation tools (conduct, content, identity, time-back) beyond how they plug
  into this foundation
- **Live sources:** `packages/database/prisma/schema.prisma` (`User.role`),
  `backend/app/routers.mjs`, `backend/middleware/`, `backend/modules/admin/`,
  `frontend/src/contexts/AuthContext.tsx`
- **Retire when:** implemented (change status to _Active contract_) or withdrawn

**Build order:** first of five staff-tool projects (epic `Equoria-puj1e`). Player
conduct, content moderation, identity and ban evasion, and outage time-back
(`docs/features/admin-time-back.md`) all depend on it.

## Roles

- `player` (default), `moderator`, `admin`. Moderators are ordinary player
  accounts the admin promotes and revokes from the Steward's Office; both are
  logged with a reason. Revocation takes effect on the moderator's next request.
- Only the admin changes roles.
- Staff tools never act on the acting account itself, on other staff, or on the
  admin. The server enforces this; the panel merely hides it.

## Capabilities

Every staff tool requires a named capability, checked server-side on every
request. The panel shows only tools the account holds.

| Capability                                                     | Moderator | Admin |
| -------------------------------------------------------------- | --------- | ----- |
| `warn`, `freeze`, `ban.account`                                | yes       | yes   |
| `rename` (horse, show, player), `post.moderate`, `post.review` | yes       | yes   |
| `ticket.file`                                                  | yes       | —     |
| `ticket.resolve`, `log.view.all`                               | —         | yes   |
| `ban.ip`, `ban.device`, `view.identity`                        | —         | yes   |
| `roles.manage`, `jobs.hold`, `time-back`, `horse.admin`        | —         | yes   |

Moving a capability between roles is a data change, not a redesign. The exact
moderator scope of IP and device bans is settled in the player-conduct project.

## Staff check-in (2FA)

Owner ruling 2026-10-09: email codes, not text messages; remember the device.

- First use of the Steward's Office on a browser sends a 6-digit code to the
  staff account's verified email through the existing SMTP path (`nodemailer`).
  Codes last 10 minutes, are single-use and rate-limited.
- A verified browser is trusted for 30 days via a signed, httpOnly cookie bound
  to the account. It asks again on a new browser, after 30 days, after a
  password change, or after the account's staff access is revoked.
- A code is bound to the account's security state (STAFF-CR-01). Only the
  newest code counts; requesting a new one retires the old. A code is void
  once the password changes or is reset, the verified email changes, or the
  account is demoted or promoted after it was issued; those paths retire
  outstanding codes in their own transactions. Verification re-reads the
  account under its row lock and creates the device and its log entry together.
- Retention (STAFF-CR-18): a code is deleted 1 day after it was used or
  expired (a retired code counts as expired when retired); a trusted device is
  deleted 30 days after it expired or was revoked. A nightly job at 03:50
  Eastern does this. The permanent record of each check-in is its staff action
  log entry.
- Applying or reversing a time-back always requires a fresh code.
- Staff without a verified email cannot use staff tools; they can still play.
- SMS was considered and declined (paid provider receives phone numbers; weakest
  2FA). It can be added later without changing this design.

## The Steward's Office page

- One hidden route, rendered only for staff; for everyone else it behaves like a
  missing page and nothing in player navigation links to it. Signed out, as a
  player, or while /staff/me has not answered for a steward, /steward leaves the
  same page, address and history as any unknown address, with no login prompt;
  a signed-out visit never asks /staff/me. A steward revoked mid-visit sees the
  office replaced the same way, in place (STAFF-CR-17).
- In-world framing with a plain, legible layout using the existing Celestial
  Night tokens, typography and dialogs; no admin-console shell (`DESIGN.md`).
- Areas appear by capability. Destructive actions go preview → confirm, with a
  required reason for anything punitive.

## Staff action log

A dedicated permanent table, never purged (the general `AuditLog` is purged on
retention and records requests, not outcomes). Each entry records: acting
account and role, time, capability, target (player, horse, show, post, IP or
device), required reason, before/after values where something changed,
outcome, and a link to the entry it reverses. The admin sees and filters every
entry, by any account that has ever written to the log, so a revoked or erased
steward stays choosable (STAFF-CR-16); a moderator sees their own. Every later staff tool writes here; an
action and its log entry commit in one transaction. Ticket replies (without
their text) and successful check-ins are logged too. Erasing an account keeps
its staff log entries under the account ID, and keeps its tickets and replies
with the filer or author shown as a former steward.

## Tickets

- Moderator → admin. A ticket names a target (player, post, horse or show), a
  category and a note; its status is open, in progress, resolved or declined.
  The admin may change any status to any other, including reopening a
  resolved or declined ticket and skipping a step (owner ruling 2026-10-13);
  only a change to the status it already has is refused. Of two simultaneous
  changes exactly one lands, with one log entry and one notification. Both
  sides can reply.
  A player may be named by username or by account ID; the ticket stores the
  account ID and shows the player's current username.
- The ticket list pages newest first and the office offers older tickets on
  request; a thread shows its latest replies and offers earlier ones on
  request. Nothing a steward may see is ever out of reach.
- A ticket about an account names a player only (owner ruling 2026-10-13): the
  filer, another moderator and the admin are refused, by username or by ID
  alike, and a promotion that lands while the ticket is being filed cannot
  slip a staff account through. A post (forum post), horse or show must exist
  when the ticket is filed; a malformed, unknown, deleted or wrong-kind ID
  gets one "not found" answer that does not say which.
- Filing alerts the admin by in-game notification and email. The email is
  queued in an outbox row written in the filing transaction (STAFF-CR-10),
  sent right after commit without holding up the answer, and otherwise sent
  by a job every 5 minutes, so a restart or a mail outage never loses it. A
  failed send becomes due again 1, 5, 15 and 60 minutes after it failed and
  is retried by the next job run after that, so in practice 1–6, 5–10,
  15–20 and 60–65 minutes later; the fifth failure marks the row `failed`,
  logs an error and counts in the job's summary on the cron-health page. An email whose admin has lost the role or a verified
  address by then is cancelled. A crash after the mail service accepted a
  message but before the row is marked sent can send it twice; nothing else
  can. Retention: the nightly 03:50 staff retention job deletes a sent or
  cancelled email 30 days after it settled and a failed one after 90 days.
  Erasing the filing moderator's account replaces their name in any of these
  emails with "A former steward".
- A reply or resolution alerts the filing moderator in game, but only while they are
  still a moderator. Demotion deletes the account's unread staff-ticket
  notifications.
- The player-conduct project adds player appeals as a ticket type.

## Tests the implementation must provide

Real database and real HTTP path (role, 2FA, capability); no mocks.

- Players, revoked moderators and unverified browsers are refused; a moderator
  cannot act on self, staff or admin; only the admin manages roles.
- Codes expire, are single-use and rate-limited; a trusted browser is not asked
  again within 30 days and is asked after password change or revocation.
- Every staff action writes exactly one log entry in the same transaction.
- Tickets alert as specified; moderators see only their own tickets.
- A doctrine check fails on a staff route without a capability guard, proven on
  a planted violation.
