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
- Applying or reversing a time-back always requires a fresh code.
- Staff without a verified email cannot use staff tools; they can still play.
- SMS was considered and declined (paid provider receives phone numbers; weakest
  2FA). It can be added later without changing this design.

## The Steward's Office page

- One hidden route, rendered only for staff; for everyone else it behaves like a
  missing page and nothing in player navigation links to it.
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
entry; a moderator sees their own. Every later staff tool writes here; an
action and its log entry commit in one transaction. Ticket replies (without
their text) and successful check-ins are logged too. Erasing an account keeps
its staff log entries under the account ID, and keeps its tickets and replies
with the filer or author shown as a former steward.

## Tickets

- Moderator → admin. A ticket names a target (player, post, horse or show), a
  category and a note; status open → in progress → resolved or declined; both
  sides can reply.
  A player may be named by username or by account ID; the ticket stores the
  account ID and shows the player's current username.
- A ticket about an account names a player only (owner ruling 2026-10-13): the
  filer, another moderator and the admin are refused, by username or by ID
  alike, and a promotion that lands while the ticket is being filed cannot
  slip a staff account through. A post (forum post), horse or show must exist
  when the ticket is filed; a malformed, unknown, deleted or wrong-kind ID
  gets one "not found" answer that does not say which.
- Filing alerts the admin by in-game notification and email; a reply or
  resolution alerts the filing moderator in game.
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
