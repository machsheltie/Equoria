# Epic 11: Community Features

**Status:** Complete (Stories 11-1 through 11-7)
**Completed:** 2026-02-23
**Branch:** cleanup-session-2026-01-30

---

## Overview

Seven stories delivering the full community layer of the game UI. Four new standalone pages
(Community Hub, Message Board, Clubs, Messages) plus a MainNavigation update that wires up
the notification bell and adds a Community nav item.

All pages use the **Celestial Night** theme consistent with other standalone pages.

---

## Stories

### 11-1 + 11-2: Message Board — All 5 Sections (`/message-board`)

**File:** `frontend/src/pages/MessageBoardPage.tsx`

- 5 section tabs with post counts:
  - 💬 General Chat — general community discussion
  - 🎨 Art & Photography — player art, photos, and screenshots
  - 🐴 Horse Sales — buy/sell/rehome horses
  - 🛠️ Services — training, grooming, stud, and other services
  - 😤 Venting — celebrations, frustrations, off-topic
- Thread list per section (14 mock threads across all sections)
- Each thread shows: title, author, preview, tags, reply count, view count, last activity
- Pinned threads shown at top with Pin icon
- "New Post" button — disabled, coming soon
- Mock data: `MOCK_THREADS` (labelled for API replacement)
- Theme accent: violet

---

### 11-3 + 11-4 + 11-5: Clubs System (`/clubs`)

**File:** `frontend/src/pages/ClubsPage.tsx`

**Discipline Clubs tab** (`data-testid="tab-discipline"`)

- 5 discipline clubs: Dressage Society, Show Jumping Association, Cross Country Federation,
  Western Riding League, Endurance Riders Guild
- Each card: icon, name, featured badge, rank, founded date, member count, description,
  president, top horse, disabled "Join Club" button

**Breed Clubs tab** (`data-testid="tab-breed"`)

- 8 breed clubs: Thoroughbred, Arabian, Warmblood, Iberian, Quarter Horse, Friesian, Mustang, Paint
- Same card layout as discipline clubs

**My Club tab** (`data-testid="tab-my-club"`, `data-testid="my-club-tab"`)

- Governance section: "Join a Club First" disabled state
- Active Elections: read-only election results with vote percentage bars for 2 mock elections
- Club Leaderboard: top 5 clubs by member count across all types
- Mock data: `MOCK_ELECTIONS` (labelled for replacement)
- All join/vote buttons disabled pending auth wire-up

---

### 11-6: Notifications Bell + Community Nav (`MainNavigation.tsx`)

**File:** `frontend/src/components/MainNavigation.tsx`

- Bell button changed from `<button>` to `<Link to="/messages">` — navigates to Messages inbox
- `aria-label="Messages and notifications"` added to bell link
- "Community" item added to `navigationItems` array: `{ name: 'Community', href: '/community', icon: '💬' }`

---

### 11-7: Messages / Inbox (`/messages`)

**File:** `frontend/src/pages/MessagesPage.tsx`

- Two tabs: Inbox + Sent
- Inbox: 8 mock messages with unread/read state, sender, subject, preview, date, category tag
- Sent: 4 mock sent messages
- Unread badge on Inbox tab shows count (3)
- "Compose" button — disabled, coming soon
- Message rows: avatar, read indicator, sender/recipient, subject, preview, date, tag chip
- Mock data: `MOCK_INBOX`, `MOCK_SENT` (labelled for API replacement)
- Theme accent: emerald

---

### Community Hub (`/community`)

**File:** `frontend/src/pages/CommunityPage.tsx`

- 3 feature cards: Message Board, Clubs, Messages — each with description, stats, arrow link
- Clubs card has "Elections open" badge
- Community stats banner: Members / Active Clubs / Board Posts Today / Messages Sent
- Recent activity feed (5 mock entries) with type-coded icons and colours
- Theme accents: violet / celestial-gold / emerald

---

## Route Registration

`frontend/src/nav-items.tsx` — 4 new routes added under "Epic 11 — Community pages":

- `/community` → `CommunityPage`
- `/message-board` → `MessageBoardPage`
- `/clubs` → `ClubsPage`
- `/messages` → `MessagesPage`

All use `icon: null` (route-only; Community is linked from the main nav via `navigationItems`).

---

## Acceptance Criteria Status

- [x] `/community` hub page with cards linking to all 3 sub-features
- [x] `/message-board` renders with 5 section tabs and mock thread list
- [x] Thread list shows pinned threads, tags, reply/view counts, last activity
- [x] "New Post" button is visible but disabled
- [x] `/clubs` renders with Discipline / Breed / My Club tabs
- [x] Discipline Clubs tab shows 5 clubs with member counts, join buttons disabled
- [x] Breed Clubs tab shows 8 clubs with breed-specific icons
- [x] My Club tab shows active elections with vote bars and governance placeholder
- [x] Bell in MainNavigation navigates to `/messages`
- [x] "Community" item added to main nav (💬)
- [x] `/messages` renders with Inbox / Sent tabs and mock messages
- [x] Unread message badge visible on Inbox tab
- [x] "Compose" button is visible but disabled
- [x] All pages: breadcrumb, page header, Celestial Night theme
- [x] TypeScript: 0 new errors in Epic 11 files
- [x] ESLint: 0 errors/warnings in all Epic 11 files

---

## Notes

- All backend routes are mock-ready (no API calls yet)
- `MOCK_THREADS` in MessageBoardPage labelled for `/api/community/threads` replacement
- `MOCK_DISCIPLINE_CLUBS` / `MOCK_BREED_CLUBS` in ClubsPage labelled for `/api/clubs` replacement
- `MOCK_INBOX` / `MOCK_SENT` in MessagesPage labelled for `/api/messages` replacement
- `MOCK_ELECTIONS` in ClubsPage labelled for `/api/clubs/elections` replacement
- All "Join Club", "New Post", "Compose", and "Vote" buttons disabled pending auth wire-up
- Election vote bars are UI-only (no mutation)
- Celestial Night theme: `celestial-gold`, `bg-white/5`, `border-white/10`, `text-white/70`
