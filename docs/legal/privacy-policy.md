# Equoria Privacy Policy

**Last updated:** 2026-09-25
**Applies to:** the Equoria horse breeding & competition simulation game (web).

This policy describes what personal data Equoria collects, why we collect
it, how long we keep it, and the rights you have over it. It is written to
honestly reflect the **actual data model and code** in this repository —
not an aspirational template. Where a data-handling behaviour is
implemented, the implementing module is named so the policy can be
audited against the code.

---

## 1. Who we are

Equoria is an online game. The account you create to play is the basis of
all data we hold about you. For privacy questions or to exercise any of
the rights below, contact **privacy@equoria.com** (also reachable via the
security contact in `SECURITY.md`).

---

## 2. What data we collect, and why

We only collect data that is necessary to operate the game. There is **no
advertising, no third-party analytics SDK, and no sale of personal data**.

| Category                | Specific data                                                                                                                                              | Why we collect it (lawful basis: performance of the game contract you enter by registering) |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Account / identity      | username, email address, first name, last name, hashed password (`User`)                                                                                   | To create and secure your account and let you log in                                        |
| Authentication security | password-change timestamp, email-verification status, refresh tokens, password-reset tokens, optional TOTP MFA secret (encrypted at rest) & recovery codes | To keep your account secure and support login/MFA/password reset                            |
| Game progression        | in-game currency, level, XP, XP events, rank snapshots (`User`, `XpEvent`, `UserRankSnapshot`)                                                             | To run game progression and leaderboards                                                    |
| Preferences             | settings JSON (theme, UI preferences) (`User.settings`)                                                                                                    | To remember how you like the game configured                                                |
| Game assets you own     | horses, grooms, riders, trainers, facilities and their full state                                                                                          | These are the objects you play with — the game cannot function without them                 |
| Game activity           | competition results, training logs, transactions, horse sales, notifications                                                                               | To run competitions, the economy, and show you your history                                 |
| Social activity         | forum threads/posts, direct messages, club memberships, election ballots                                                                                   | To provide community features you opt into by using them                                    |
| Operational security    | a server-side audit trail of sensitive actions (login, financial, breeding, training, admin, account, groom)                                               | Fraud/abuse prevention and security forensics (lawful basis: legitimate interest)           |

We do **not** intentionally collect special-category data. Please do not
put sensitive personal information into free-text fields (horse names,
forum posts, messages, settings).

---

## 3. How long we keep it (retention)

- **Account & game data:** kept for as long as Equoria operates. Accounts
  are not deleted, including when you stop playing (see Section 5).
- **Security audit trail (`AuditLog`):** retained for a rolling window
  (default **90 days**, minimum 7 days) and then automatically purged by a
  nightly job (`backend/services/auditLogRetentionService.mjs`).

---

## 4. Your right to access your data (data export / portability)

You can download a **complete, machine-readable (JSON) copy** of the
personal data we hold about you at any time.

- **How:** authenticated request to `GET /api/v1/account/export`.
- **What you get:** your profile (excluding the password hash), settings,
  horses, competition history, transactions, notifications, grooms,
  riders, trainers, sent/received messages, forum threads/posts, club
  memberships, XP events, and horse-sale records — everything keyed to
  your account.
- **Scope guarantee:** the export is strictly scoped to your own user id.
  It is structurally impossible to export another user's data through
  this endpoint (there is no user-id parameter; the endpoint only ever
  reads `req.user.id`).
- **Implementation:** `backend/modules/users/services/gdprAccountService.mjs`
  (`buildUserDataExport`) /
  `backend/modules/users/controllers/gdprAccountController.mjs`.

---

## 5. Account deletion

**Equoria does not delete player accounts** — not from inside the game,
and not on request. Your horses, their lineage, competition results and
club history are part of a shared world: other players' horses descend
from yours, and their records name your horses. Removing an account would
break their pedigrees and histories, so accounts stay.

- **If you stop playing,** your account simply stays as it is, and you can
  log in again whenever you like.
- **What you can still do:** download a full copy of your data at any
  time (Section 4), and change your username, password and recovery
  email address in Settings.
- **Implementation:** the game offers no deletion control, and the server
  routes that once allowed self-service deletion
  (`POST /api/v1/account/delete`, `DELETE /api/v1/users/:id`) refuse every
  request.
- **Audit:** data-export requests are recorded in the security audit trail
  (action `account_operation`) for abuse detection; that audit row is
  subject to the retention window in Section 3 and contains no game data.

---

## 6. How we protect your data

- Passwords are hashed with bcrypt (12+ rounds); never stored or exported
  in plaintext.
- TOTP MFA secrets are encrypted at rest (AES-256-GCM).
- All traffic is expected to be served over HTTPS in production.
- Access to your data through the API is gated by JWT authentication,
  CSRF protection, rate limiting, and strict per-user ownership checks.
- Server-side security logging records selected sensitive actions; its coverage
  and retention are implementation-specific.

Current technical detail is in `.claude/rules/SECURITY.md`, live security
source/tests, and `docs/SECURITY_TESTING.md`.

---

## 7. Data sharing

We do not sell your personal data and do not share it with advertisers.
Data is processed only to operate the game. Some data is visible to other
players **by the nature of the game** (e.g. your username on
leaderboards, forum posts you make, messages you send) — that visibility
is the feature, not a separate disclosure.

---

## 8. Changes to this policy

Material changes will be reflected in this document with an updated "Last
updated" date and, where appropriate, an in-game notice.

---

## 9. Contact

- **Privacy / data requests:** privacy@equoria.com
- **Security issues:** see `SECURITY.md` (security@equoria.com)
