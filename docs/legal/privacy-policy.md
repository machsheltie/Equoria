# Equoria Privacy Policy

**Last updated:** 2026-05-18
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

- **Account & game data:** retained for as long as your account exists.
  When you delete your account (Section 5), this data is **permanently
  erased**, not soft-deleted.
- **Security audit trail (`AuditLog`):** retained for a rolling window
  (default **90 days**, minimum 7 days) and then automatically purged by a
  nightly job (`backend/services/auditLogRetentionService.mjs`). Audit
  rows use a **soft user reference with no foreign key** by design, so a
  short post-erasure forensic record of _security-relevant actions_ (e.g.
  the deletion event itself) may persist until the retention window
  expires. This is a deliberate, time-bounded legitimate-interest
  exception to erasure and is documented here for transparency.
- **Bilateral records (horse sales):** a horse sale has two parties. When
  you delete your account, sale rows where you were a party are removed;
  records that also belong to the other party are not retained in a form
  that identifies you.
- **Shows you hosted/created:** the show itself (and other players'
  results in it) survives, but the link identifying you as
  host/creator is removed (set to null) so other players' game history is
  not destroyed by your erasure.

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

## 5. Your right to erasure ("delete my account / right to be forgotten")

You can permanently delete your account and the personal data tied to it.

- **How:** authenticated request to `POST /api/v1/account/delete` with
  your current password in the request body. The password re-confirmation
  is a safety check against accidental or hijacked-session deletion.
- **What happens:** in a single database transaction we delete, in
  dependency order, all data scoped to your user id — profile, horses
  (and their cascade-linked competition results, training logs, foal
  development, trait history, etc.), grooms, riders, trainers,
  facilities, transactions, notifications, XP events, rank snapshots,
  forum content, direct messages, club memberships and election ballots,
  horse-sale records you were a party to, and your authentication tokens.
  The deletion is **scoped strictly to your own user id** — never a broad
  query.
- **Anonymisation where integrity requires it:** where deleting a row
  would destroy _other players'_ game history, we remove the identifying
  link to you rather than delete the shared record. Two cases:
  (a) shows you hosted/created — the show survives, your link is removed;
  (b) a horse you own that is a **breeding ancestor** of another player's
  horse — the horse row is kept so their descendant's lineage stays
  intact, but it is detached from you (ownership removed) and its name and
  commercial/stud attribution are scrubbed to a generic placeholder. Your
  horses that are NOT ancestors of any other player's horse are fully
  deleted. See Section 3.
- **After deletion:** you can no longer log in; the account no longer
  exists. The action is idempotent (a repeat request returns "not found",
  not an error) and fail-closed (if the transaction cannot complete, no
  partial deletion occurs).
- **Implementation:** `gdprAccountService.mjs` (`eraseUserAccount`,
  `verifyAccountPassword`).
- **Audit:** the export and deletion actions are themselves recorded in
  the security audit trail (action `account_operation`) for abuse
  detection; that audit row is subject to the retention window in
  Section 3 and contains no game data.

---

## 6. How we protect your data

- Passwords are hashed with bcrypt (12+ rounds); never stored or exported
  in plaintext.
- TOTP MFA secrets are encrypted at rest (AES-256-GCM).
- All traffic is expected to be served over HTTPS in production.
- Access to your data through the API is gated by JWT authentication,
  CSRF protection, rate limiting, and strict per-user ownership checks.
- A server-side audit trail records sensitive actions for security
  monitoring.

Full technical detail is in `.claude/rules/SECURITY.md` and
`docs/SECURITY_ASSESSMENT_REPORT.md`.

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
