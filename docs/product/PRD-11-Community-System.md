# PRD-11: Community System

**Version:** 1.0.0
**Last Updated:** 2026-05-15
**Status:** Backend ✅ Complete (Epic 19B) | Frontend ✅ Complete | PRD ⚠️ Authored after implementation (Equoria-56uu)
**Owner:** Equoria Product
**Source Integration:** `backend/modules/community/`, `packages/database/prisma/schema.prisma:1221-1338`, frontend `MessageBoardPage` / `ClubsPage` / `MessagesPage`

---

## 1. Overview

The Community System covers the player-to-player social surfaces of Equoria: a sectioned forum (message board), governed clubs with elections, and private direct messages. It is the canonical specification for **FR81 (Community — active user-generated content and social features)**, which until now existed only as a single line in `PRD-01-Overview.md` §"Community". The backend shipped via Epic 19B; this PRD documents the requirements that already exist in code so future stories, AC validation, and edge-case audits have a spec to drift from rather than reverse-engineering from the schema.

Three independent sub-systems, one PRD:

| Sub-system          | Surface          | Backend module file                                           | Mount prefix       |
| ------------------- | ---------------- | ------------------------------------------------------------- | ------------------ |
| **Forum / Boards**  | MessageBoardPage | `backend/modules/community/controllers/forumController.mjs`   | `/api/v1/forum`    |
| **Clubs**           | ClubsPage        | `backend/modules/community/controllers/clubController.mjs`    | `/api/v1/clubs`    |
| **Direct Messages** | MessagesPage     | `backend/modules/community/controllers/messageController.mjs` | `/api/v1/messages` |

All community routes are mounted under the authenticated router (`authRouter`, `backend/app.mjs:201-203`) and therefore require a valid session. They are also covered by the global prototype-pollution body/query guards (see `.claude/rules/SECURITY.md` CWE-1321).

---

## 2. Functional Requirements

### 2.1 Forum Threads (FR81-FORUM-1)

A forum thread is a titled discussion in one of five fixed board sections.

| Field            | Type                | Range / Values                                           | Default | Purpose                          |
| ---------------- | ------------------- | -------------------------------------------------------- | ------- | -------------------------------- |
| `section`        | enum `BoardSection` | `general` \| `art` \| `sales` \| `services` \| `venting` | —       | Fixed top-level board categories |
| `title`          | string              | non-empty                                                | —       | Thread display title             |
| `authorId`       | string (User FK)    | —                                                        | —       | Thread creator                   |
| `tags`           | string[]            | —                                                        | `[]`    | Free-form thread tags            |
| `isPinned`       | boolean             | —                                                        | `false` | Admin-pinned to top of section   |
| `viewCount`      | int                 | ≥ 0                                                      | `0`     | Incremented per view event       |
| `lastActivityAt` | DateTime            | —                                                        | `now()` | Sort key for "recent activity"   |

**Behavioral requirements:**

- The five `BoardSection` values are a closed enum. Adding a section is a schema migration + PRD revision, not a runtime config.
- Listing threads supports filtering by `section` and is ordered with pinned threads first, then by `lastActivityAt` descending.
- `incrementView` (POST `/forum/threads/:id/view`) bumps `viewCount`; it is not idempotent per user (raw view counter, not unique-viewers).
- Pinning a thread (PATCH `/forum/threads/:id/pin`) requires the `admin` role (`requireRole('admin')`).

### 2.2 Forum Posts / Threading (FR81-FORUM-2)

A forum post is a reply within a thread.

| Field       | Type                 | Range / Values | Default | Purpose           |
| ----------- | -------------------- | -------------- | ------- | ----------------- |
| `threadId`  | int (ForumThread FK) | —              | —       | Owning thread     |
| `authorId`  | string (User FK)     | —              | —       | Post author       |
| `content`   | string               | non-empty      | —       | Post body         |
| `createdAt` | DateTime             | —              | `now()` | Post ordering key |

**Behavioral requirements:**

- Posts are a flat list per thread (no nested reply trees in the current model). Threading is one level: Thread → Post.
- Deleting a thread cascades to its posts (`onDelete: Cascade`).
- Creating a post should update the parent thread's `lastActivityAt` so the thread re-sorts to the top of its section.

### 2.3 Club Lifecycle & Membership (FR81-CLUB-1)

A club is a named player group of one of two types.

| Field         | Type             | Range / Values             | Default | Purpose                       |
| ------------- | ---------------- | -------------------------- | ------- | ----------------------------- |
| `name`        | string (unique)  | non-empty, globally unique | —       | Club display name             |
| `type`        | enum `ClubType`  | `discipline` \| `breed`    | —       | Club category family          |
| `category`    | string           | discipline or breed name   | —       | The specific discipline/breed |
| `description` | string           | —                          | —       | Club blurb                    |
| `leaderId`    | string (User FK) | —                          | —       | Current club leader           |

Membership (`ClubMembership`):

| Field    | Type             | Range / Values                       | Default  | Purpose                 |
| -------- | ---------------- | ------------------------------------ | -------- | ----------------------- |
| `clubId` | int (Club FK)    | —                                    | —        | Owning club             |
| `userId` | string (User FK) | —                                    | —        | Member                  |
| `role`   | enum `ClubRole`  | `member` \| `officer` \| `president` | `member` | In-club permission tier |

**Behavioral requirements:**

- `(clubId, userId)` is unique — a user holds at most one membership row per club.
- Join (POST `/clubs/:id/join`) creates a `member` row; leave (DELETE `/clubs/:id/leave`) removes it. Deleting a club cascades memberships.
- Role changes (PATCH `/clubs/:id/role`) move a member between `member` / `officer` / `president`. The exact authorization matrix (who may promote/demote whom) is documented as an open question (§6) — the current code path enforces it; the **canonical rule** must be ratified by Product so future edge-case audits have a spec.
- `GET /clubs/mine` returns the requesting user's clubs; `GET /clubs/:id` returns one club; the list endpoint supports `type`/`category` filtering.

### 2.4 Club Elections (FR81-CLUB-2)

Clubs hold elections for positions.

| Model           | Key fields                                                                          | Purpose                               |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| `ClubElection`  | `clubId`, `position`, `status` (`upcoming`\|`open`\|`closed`), `startsAt`, `endsAt` | An election for a named club position |
| `ClubCandidate` | `electionId`, `userId`, `statement`; unique `(electionId, userId)`                  | A member standing for the position    |
| `ClubBallot`    | `candidateId`, `voterId`, `electionId`, `createdAt`                                 | A single cast vote                    |

**Behavioral requirements:**

- Election status transitions `upcoming → open → closed`. The transition trigger (cron vs. on-read vs. manual) is an **open question** (§6) — there is a cron observability layer (`CronRunLog`, Equoria-9wby) that opens/closes elections (`electionsOpened` / `electionsClosed` counters in `backend/services/cronJobs.mjs`).
- A candidate is unique per `(electionId, userId)` — a member cannot stand twice in the same election.
- `ClubBallot` carries both `candidateId` and `electionId`. The one-ballot-per-voter-per-election invariant is a **required rule** that Product must ratify and a future story must lock with a uniqueness constraint or service-level guard (currently no DB-level `@@unique([electionId, voterId])` — flagged in §6 as a spec-vs-schema gap to resolve, not silently accepted).
- `GET /clubs/elections/:id/results` returns tallied results; `GET /clubs/:id/elections` lists a club's elections.

### 2.5 Direct Messages (FR81-DM-1)

A direct message is a private subject+body between two users.

| Field         | Type             | Range / Values | Default | Purpose                       |
| ------------- | ---------------- | -------------- | ------- | ----------------------------- |
| `senderId`    | string (User FK) | —              | —       | Message author                |
| `recipientId` | string (User FK) | —              | —       | Message recipient             |
| `subject`     | string           | non-empty      | —       | Message subject line          |
| `content`     | string           | non-empty      | —       | Message body                  |
| `tag`         | string?          | —              | `null`  | Optional sender-applied label |
| `isRead`      | boolean          | —              | `false` | Recipient-side read flag      |

**Behavioral requirements:**

- `GET /messages/inbox` returns messages where the requester is `recipientId`; `GET /messages/sent` returns messages where the requester is `senderId`.
- `GET /messages/unread-count` returns the count of inbox messages with `isRead = false` (drives the navbar bell badge).
- `PATCH /messages/:id/read` sets `isRead = true`; only the recipient may mark a message read (authorization enforced in controller; the **canonical rule** is documented here so it cannot silently regress).
- There is no conversation-threading model — messages are independent rows. "Conversation threading" is explicitly **out of scope** (§4) until a future PRD revision adds a thread/parent linkage.

### 2.6 Moderation & Reporting Hooks (FR81-MOD-1)

The current shipped scope has **one** moderation primitive: admin thread-pinning (`requireRole('admin')` on `PATCH /forum/threads/:id/pin`). There is **no** user-facing report/flag endpoint, no content takedown workflow, and no automated moderation. This is recorded here as an explicit scope boundary (not a hidden gap): any reporting/moderation feature is a **new** requirement requiring its own story and a PRD revision — it must not be retro-fitted as an undocumented behavior.

---

## 3. Authentication, Authorization & Security

- All community routes are under `authRouter` (`backend/app.mjs:201-203`) — unauthenticated requests are rejected before the controller runs.
- Prototype-pollution body/query guards apply globally (see `.claude/rules/SECURITY.md` CWE-1321) — community routes inherit them automatically.
- Role-gated actions today: admin thread-pin. The club role authorization matrix (who may change another member's `ClubRole`, who may open/close an election) is enforced in controllers but **not yet ratified in this PRD** — see §6.
- Ownership-style checks (only the recipient may mark a DM read; only members may vote) are controller-enforced and are stated as canonical rules in §2 so audits have a baseline.

---

## 4. Out of Scope (For Future PRD Revisions)

The following are deliberately **not** in the shipped FR81 scope. Each requires a new story and a PRD revision before implementation — they must not be added as undocumented behavior:

- Conversation threading / message replies (DMs are flat independent rows today).
- Nested forum reply trees (forum threading is one level: Thread → Post).
- User-facing report/flag/moderation workflow and content takedown.
- Message archival / retention policy and bulk message operations.
- Club governance edge cases beyond the shipped election model (recall votes, term limits, impeachment, multi-seat positions).
- Real-time push for new posts / messages (current delivery is React Query polling — see `Equoria-rgyv` ADR for the push-vs-poll decision).
- Block / mute / friend lists.
- Rich text / attachments in posts or messages (plain string `content` only today).

---

## 5. Traceability — Spec → Code

| Requirement    | Schema (`schema.prisma`)                                             | Controller / Routes                                                   |
| -------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| FR81-FORUM-1/2 | `ForumThread`, `ForumPost`, enum `BoardSection`                      | `forumController.mjs`, `modules/community/routes/forumRoutes.mjs`     |
| FR81-CLUB-1    | `Club`, `ClubMembership`, enums `ClubType`/`ClubRole`                | `clubController.mjs`, `modules/community/routes/clubRoutes.mjs`       |
| FR81-CLUB-2    | `ClubElection`, `ClubCandidate`, `ClubBallot`, enum `ElectionStatus` | `clubController.mjs`, `cronJobs.mjs` (open/close)                     |
| FR81-DM-1      | `DirectMessage`                                                      | `messageController.mjs`, `modules/community/routes/messageRoutes.mjs` |
| FR81-MOD-1     | (role on `ClubMembership`; admin via auth)                           | `requireRole('admin')` on `PATCH /forum/threads/:id/pin`              |

Frontend surfaces: `frontend/src/pages/MessageBoardPage.tsx`, `ClubsPage.tsx`, `MessagesPage.tsx` (wired live, see `CLAUDE.md` Epic 11 deliverables; backend wired in Epic 19B).

---

## 6. Open Questions for Product

These are spec gaps where the code enforces _a_ rule but the _canonical_ rule has not been ratified. Each should become its own story (do not resolve by reading current code as authoritative — the code may itself be wrong):

1. **Club role authorization matrix.** Who may promote/demote a member's `ClubRole`? Leader only? Officers? Self-service downgrade? The controller enforces something today; Product must ratify the intended matrix.
2. **Election lifecycle trigger.** `upcoming → open → closed` is moved by cron (`electionsOpened`/`electionsClosed`). Confirm the cadence (cron vs. exact `startsAt`/`endsAt` boundary) and the timezone (project canonical is UTC — see `.claude/rules/PATTERN_LIBRARY.md` Horse Age convention; elections should follow the same UTC-date discipline).
3. **One-ballot-per-voter-per-election.** There is no `@@unique([electionId, voterId])` on `ClubBallot`. Is double-voting prevented at the service layer only? This is a spec-vs-schema gap to close with either a constraint or a documented+tested guard — not to silently accept.
4. **Forum section evolution.** Are the five `BoardSection` values final, or is a sixth (e.g. `events`, `help`) anticipated? Affects whether section should stay a DB enum or move to config.
5. **DM size / rate limits.** Is there a per-user DM send-rate cap to prevent spam? (Global rate limiter applies, but no community-specific cap is documented — cross-reference `Equoria-c9y4` non-auth limiter drift.)

---

## 7. Version History

| Version | Date       | Change                                                                                                                                                                                                      |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-05-15 | Initial canonical PRD authored post-implementation for FR81 (Equoria-56uu). Documents shipped Epic 19B backend: forum, clubs+elections, DMs. Records 5 open questions and explicit out-of-scope boundaries. |
