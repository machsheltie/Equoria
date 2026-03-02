# Epic 19B — Social Features Design

**Date:** 2026-03-02
**Status:** Approved
**Scope:** Message Board + Direct Messages + Clubs with Elections

---

## Overview

Three community/social features built sequentially (feature-by-feature migrations). All
frontend pages already exist with mock data — the work is building the backend and wiring
live data in.

No real-time/WebSockets. All REST + React Query. Direct Messages uses a simple email-style
inbox (not chat).

---

## Architecture

Three sequential phases, each with its own Prisma migration, backend (controller + routes +
tests), and frontend wire-up. Pre-push hook must pass before advancing to the next phase.

| Phase | Feature           | New Models                                                                                                            | Routes prefix   |
| ----- | ----------------- | --------------------------------------------------------------------------------------------------------------------- | --------------- |
| 19B-1 | Message Board     | `ForumThread`, `ForumPost`, `BoardSection` enum                                                                       | `/api/forum`    |
| 19B-2 | Direct Messages   | `DirectMessage`                                                                                                       | `/api/messages` |
| 19B-3 | Clubs + Elections | `Club`, `ClubMembership`, `ClubElection`, `ClubCandidate`, `ClubBallot`, `ClubType`/`ClubRole`/`ElectionStatus` enums | `/api/clubs`    |

---

## Schema

### Phase 1 — Message Board

```prisma
enum BoardSection { general art sales services venting }

model ForumThread {
  id             Int          @id @default(autoincrement())
  section        BoardSection
  title          String
  authorId       String
  author         User         @relation("ForumThreads", fields: [authorId], references: [id])
  tags           String[]
  isPinned       Boolean      @default(false)
  viewCount      Int          @default(0)
  lastActivityAt DateTime     @default(now())
  createdAt      DateTime     @default(now())
  posts          ForumPost[]
}

model ForumPost {
  id        Int         @id @default(autoincrement())
  threadId  Int
  thread    ForumThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  authorId  String
  author    User        @relation("ForumPosts", fields: [authorId], references: [id])
  content   String
  createdAt DateTime    @default(now())
}
```

### Phase 2 — Direct Messages

```prisma
model DirectMessage {
  id          Int      @id @default(autoincrement())
  senderId    String
  sender      User     @relation("SentMessages", fields: [senderId], references: [id])
  recipientId String
  recipient   User     @relation("ReceivedMessages", fields: [recipientId], references: [id])
  subject     String
  content     String
  tag         String?
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

### Phase 3 — Clubs + Elections

```prisma
enum ClubType      { discipline breed }
enum ClubRole      { member officer president }
enum ElectionStatus { upcoming open closed }

model Club {
  id          Int              @id @default(autoincrement())
  name        String           @unique
  type        ClubType
  category    String
  description String
  leaderId    String
  leader      User             @relation("ClubsLed", fields: [leaderId], references: [id])
  createdAt   DateTime         @default(now())
  members     ClubMembership[]
  elections   ClubElection[]
}

model ClubMembership {
  id       Int      @id @default(autoincrement())
  clubId   Int
  club     Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)
  userId   String
  user     User     @relation("ClubMemberships", fields: [userId], references: [id])
  role     ClubRole @default(member)
  joinedAt DateTime @default(now())
  @@unique([clubId, userId])
}

model ClubElection {
  id         Int               @id @default(autoincrement())
  clubId     Int
  club       Club              @relation(fields: [clubId], references: [id])
  position   String
  status     ElectionStatus    @default(upcoming)
  startsAt   DateTime
  endsAt     DateTime
  candidates ClubCandidate[]
}

model ClubCandidate {
  id         Int          @id @default(autoincrement())
  electionId Int
  election   ClubElection @relation(fields: [electionId], references: [id])
  userId     String
  user       User         @relation("ElectionCandidacies", fields: [userId], references: [id])
  statement  String
  ballots    ClubBallot[]
  @@unique([electionId, userId])
}

model ClubBallot {
  id          Int           @id @default(autoincrement())
  candidateId Int
  candidate   ClubCandidate @relation(fields: [candidateId], references: [id])
  voterId     String
  voter       User          @relation("CastBallots", fields: [voterId], references: [id])
  electionId  Int
  createdAt   DateTime      @default(now())
  @@unique([electionId, voterId])
}
```

---

## API Endpoints

### Phase 1 — Message Board

| Method | Path                           | Auth     | Notes                                     |
| ------ | ------------------------------ | -------- | ----------------------------------------- |
| GET    | `/api/forum/threads`           | no       | `?section=&page=&limit=20` — pinned first |
| GET    | `/api/forum/threads/:id`       | no       | thread + posts                            |
| POST   | `/api/forum/threads`           | required | create thread                             |
| POST   | `/api/forum/threads/:id/posts` | required | reply                                     |
| POST   | `/api/forum/threads/:id/view`  | no       | increment viewCount                       |
| PATCH  | `/api/forum/threads/:id/pin`   | admin    | toggle isPinned                           |

### Phase 2 — Direct Messages

| Method | Path                         | Auth     | Notes                 |
| ------ | ---------------------------- | -------- | --------------------- |
| GET    | `/api/messages/inbox`        | required | current user received |
| GET    | `/api/messages/sent`         | required | current user sent     |
| GET    | `/api/messages/unread-count` | required | badge number          |
| GET    | `/api/messages/:id`          | required | marks read on fetch   |
| POST   | `/api/messages`              | required | compose + send        |
| PATCH  | `/api/messages/:id/read`     | required | explicit mark-read    |

### Phase 3 — Clubs

| Method | Path                                | Auth     | Notes                 |
| ------ | ----------------------------------- | -------- | --------------------- |
| GET    | `/api/clubs`                        | no       | `?type=&category=`    |
| GET    | `/api/clubs/mine`                   | required | clubs I belong to     |
| GET    | `/api/clubs/:id`                    | no       | club + members        |
| POST   | `/api/clubs`                        | required | create club           |
| POST   | `/api/clubs/:id/join`               | required |                       |
| DELETE | `/api/clubs/:id/leave`              | required |                       |
| GET    | `/api/clubs/:id/elections`          | no       |                       |
| POST   | `/api/clubs/:id/elections`          | officer+ | create election       |
| POST   | `/api/clubs/elections/:id/nominate` | member   | self-nominate         |
| POST   | `/api/clubs/elections/:id/vote`     | member   | one vote per election |
| GET    | `/api/clubs/elections/:id/results`  | no       |                       |

---

## Frontend Hooks & Wiring

### Phase 1 — `frontend/src/hooks/api/useForum.ts`

```typescript
useForumThreads(section, page); // staleTime: 1min
useForumThread(id); // staleTime: 2min
useCreateThread(); // invalidates threads list
useCreatePost(); // invalidates thread
```

`MessageBoardPage.tsx` — replace `MOCK_THREADS` with `useForumThreads(activeSection)`.
Enable "New Post" button → modal with title + content fields.

### Phase 2 — `frontend/src/hooks/api/useMessages.ts`

```typescript
useInbox(); // staleTime: 30s
useSentMessages(); // staleTime: 30s
useUnreadCount(); // staleTime: 30s
useMessage(id);
useSendMessage(); // invalidates inbox + sent
useMarkRead(); // invalidates inbox + unread-count
```

`MessagesPage.tsx` — replace `MOCK_INBOX`/`MOCK_SENT`. Enable "Compose" button → modal.
`MainNavigation.tsx` — bell icon badge wired to `useUnreadCount()`.

### Phase 3 — `frontend/src/hooks/api/useClubs.ts`

```typescript
useClubs(type, category); // staleTime: 5min
useClub(id);
useMyClubs();
useJoinClub();
useLeaveClub();
useCreateClub();
useClubElections(clubId);
useNominate();
useVote();
useElectionResults(id);
```

`ClubsPage.tsx` — replace mock club cards. Enable join/leave. Elections tab live.
`CommunityPage.tsx` — wire stats (thread count, unread count, club count).

---

## Testing Strategy

Pattern: balanced mocking (external deps only — DB + logger). Real business logic tested.

**Per phase:**

- Controller unit tests (~15 tests): mock `prisma.*`, test validation + auth + ownership
- Integration tests (~10 tests): real DB, full request → response
- Frontend: MSW handlers for each endpoint, hook tests, page smoke tests

**Key edge cases:**

- Forum: pinned threads sort first; section filter works; viewCount increments
- Messages: sender ≠ recipient enforced; unread count accurate; mark-read on GET /:id
- Clubs: `@@unique([electionId, voterId])` enforces one vote; officer-only election creation;
  leader auto-gets `president` role on club creation

**Target:** ~25–35 backend tests per phase. Pre-push hook passes before next phase starts.

---

## Delivery Order

```
19B-1  Message Board   schema → backend → frontend wire → tests pass → push
19B-2  Direct Messages schema → backend → frontend wire → tests pass → push
19B-3  Clubs           schema → backend → frontend wire → tests pass → push
```
