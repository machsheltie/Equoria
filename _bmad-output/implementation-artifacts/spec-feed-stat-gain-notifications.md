---
title: 'Feed Stat Gain Notifications — on-screen toast + in-app notification'
type: 'feature'
created: '2026-05-07'
status: 'done'
baseline_commit: '9eadc4ed23d6f39fdf34333fffdca2e3a77c2ddf'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When feeding a horse with a stat-boosting feed tier and a stat is gained, the player sees two disjointed toasts ("Fed X with Y. N units left." then "+1 stat!") and has no persistent record of the gain they can check later in notifications.

**Approach:** Merge the two toasts into one informative message; simultaneously write a game notification (stored in `User.settings.gameNotifications` JSONB, no schema migration) that increments the bell unread count and appears in a new Notifications tab in MessagesPage.

## Boundaries & Constraints

**Always:**
- Only tiers with `statRollPct > 0` can produce a stat boost (performance, performancePlus, highPerformance, elite). The basic tier never can.
- The game notification write (`User.settings.gameNotifications` append) must happen OUTSIDE the Prisma `$transaction` block in `feedHorse()`, performed by the controller after the service returns a non-null `statBoost`. Keeping it outside the transaction avoids bloating the hot-path transaction and prevents a notification-write failure from rolling back the feed.
- `gameNotifications` array is stored on `User.settings.gameNotifications: GameNotif[]`. Structure per item: `{ id: string (uuid), type: 'stat_gain', isRead: boolean, createdAt: ISO-string, payload: { horseName, stat, amount, feedName } }`.
- Bell unread count must reflect unread game notifications via a new lightweight endpoint that returns `{ unreadCount: number }`.
- Mark-all-read fires when user opens the Notifications tab.

**Ask First:**
- If `User.settings` is found to be null for a user at notification-write time, initialize it to `{}` before appending — do NOT error out.

**Never:**
- Do not add a schema migration or new Prisma model for notifications.
- Do not send a DirectMessage or use the existing messages system.
- Do not show the notifications in the existing Inbox/Sent tabs.
- Do not change the `feedHorse()` service signature or its transaction scope.
- Do not cap the stored game notification array in this spec (future concern).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stat boost fires | Feed succeeds, `statBoost = { stat: 'speed', amount: 1 }` | Single toast: "Fed Blaze with Performance Feed. 4 units left. +1 Speed!" | N/A |
| No stat boost | Feed succeeds, `statBoost = null` | Toast: "Fed Blaze with Performance Feed. 4 units left." (no stat suffix) | N/A |
| Basic feed | `equippedFeedType = 'basic'` | Feed succeeds, no stat roll, toast shows no stat suffix | N/A |
| Notification persists | Stat boost fired, user navigates to Messages → Notifications tab | Entry shows: "Blaze gained +1 Speed from Performance Feed" with timestamp | N/A |
| Bell unread dot | Stat boost notification is unread | Bell shows dot indicator | N/A |
| Mark read | User opens Notifications tab | All unread game notifications set `isRead: true` via PATCH endpoint; bell dot clears | PATCH failure: tab still renders, badge resets on next poll |
| Feed mutation query invalidation | `useFeedHorse.onSuccess` fires after stat boost | `['game-notifications']` query key invalidated so bell re-fetches immediately | N/A |

</frozen-after-approval>

## Code Map

- `backend/modules/horses/controllers/horseFeedController.mjs:208-235` — `feedHorseHandler`; write game notification here AFTER service returns `statBoost`
- `backend/modules/users/controllers/userController.mjs` — add `getGameNotifications` and `markGameNotificationsRead` handlers
- `backend/modules/users/routes/userRoutes.mjs` — add `GET /api/v1/users/me/game-notifications` and `PATCH /api/v1/users/me/game-notifications/read-all`
- `frontend/src/lib/api-client.ts` — add `gameNotificationsApi` with `getAll()` and `markAllRead()`
- `frontend/src/hooks/api/useGameNotifications.ts` — new file; `useGameNotifications()` + `useMarkGameNotificationsRead()`
- `frontend/src/hooks/api/useFeedHorse.ts` — add invalidation of `['game-notifications']` in `onSuccess` when `statBoost` is non-null (or unconditionally in onSettled)
- `frontend/src/components/MainNavigation.tsx:31-34` — `useUnreadCount`; add `useGameNotifications` unread count to the badge total
- `frontend/src/pages/HorseDetailPage.tsx:738-744` — `handleFeed` toast logic; merge two toasts into one
- `frontend/src/pages/MessagesPage.tsx:25-34` — add `'Notifications'` tab type and rendering panel

## Tasks & Acceptance

**Execution:**
- [x] `backend/modules/users/controllers/userController.mjs` -- Add `getGameNotifications(req, res)`: reads `user.settings.gameNotifications ?? []`, returns `{ success: true, data: { notifications, unreadCount } }`. Add `markGameNotificationsRead(req, res)`: sets all items' `isRead: true` in the array and writes back via Prisma update, returns `{ success: true }` -- provides the read/mark-read API surface for game notifications
- [x] `backend/modules/users/routes/userRoutes.mjs` -- Wire `GET /me/game-notifications → getGameNotifications` and `PATCH /me/game-notifications/read-all → markGameNotificationsRead` (both protected by existing auth middleware) -- exposes notification endpoints
- [x] `backend/modules/horses/controllers/horseFeedController.mjs` -- In `feedHorseHandler`, after `feedHorse()` returns and `result.statBoost` is non-null: append a `GameNotif` object to `user.settings.gameNotifications` via Prisma User.update outside the service transaction. Include `id: crypto.randomUUID()`, `type: 'stat_gain'`, `isRead: false`, `createdAt: new Date().toISOString()`, `payload: { horseName: result.horse.name, stat: result.statBoost.stat, amount: result.statBoost.amount, feedName: result.feed.name }` -- persists the stat gain event for in-app notification display
- [x] `frontend/src/lib/api-client.ts` -- Add `gameNotificationsApi.getAll()` → `GET /api/v1/users/me/game-notifications` and `gameNotificationsApi.markAllRead()` → `PATCH /api/v1/users/me/game-notifications/read-all`. Export `GameNotification` type -- client API surface for game notifications
- [x] `frontend/src/hooks/api/useGameNotifications.ts` -- New file. `useGameNotifications()`: query key `['game-notifications']`, staleTime 30s, returns notifications array + unreadCount. `useMarkGameNotificationsRead()`: mutation calling `markAllRead()`, on success invalidates `['game-notifications']` and `['messages', 'unread-count']` -- React Query layer for game notifications
- [x] `frontend/src/hooks/api/useFeedHorse.ts` -- In `onSettled`, add `queryClient.invalidateQueries({ queryKey: ['game-notifications'], refetchType: 'none' })` alongside existing invalidations -- ensures bell re-fetches after a feed
- [x] `frontend/src/components/MainNavigation.tsx` -- Import `useGameNotifications`; add its `unreadCount` to the bell display count (combined `dmUnread + gameNotifUnread`). Preserve existing `data-testid="notification-dot"` and `data-testid="notification-indicator"` -- bell reflects unread game notifications
- [x] `frontend/src/pages/HorseDetailPage.tsx` -- In `handleFeed` onSuccess, replace the two-toast pattern with a single `toast.success(...)` that appends ` +1 ${capitalize(result.statBoost.stat)}!` to the feed message when `statBoost` is non-null. Remove the second standalone `toast.success` -- single coherent feed confirmation message
- [x] `frontend/src/pages/MessagesPage.tsx` -- Add `'notifications'` to `MessageTab` type. Add Notifications tab button in the tab row. When tab active, fetch via `useGameNotifications()`, call `markAllRead()` on mount, render each item as: horse name + stat gained + feed name + relative timestamp. Style similar to existing inbox rows -- players can review past stat gains from feeding

**Acceptance Criteria:**
- Given a horse fed with performance+ feed and `statBoost` fires, when feed completes, then a single toast reads "Fed [Name] with [Feed]. [N] units left. +1 [Stat]!"
- Given a horse fed with basic feed, when feed completes, then toast reads "Fed [Name] with [Feed]. [N] units left." with no stat suffix
- Given a stat boost fired, when user navigates to Messages → Notifications tab, then entry shows horse name, stat gained, feed name, and relative time
- Given an unread game notification exists, when user views the top nav bell, then the red dot is visible
- Given user opens the Notifications tab, when the component mounts, then PATCH mark-all-read fires and bell dot clears on next refresh

## Design Notes

**Toast merge pattern (HorseDetailPage):**
```tsx
const statSuffix = result.statBoost
  ? ` +1 ${result.statBoost.stat.charAt(0).toUpperCase() + result.statBoost.stat.slice(1)}!`
  : '';
toast.success(`Fed ${result.horse.name} with ${feedName}. ${remaining} units left.${statSuffix}`);
```

**Bell count merge (MainNavigation):**
```tsx
const { data: gameNotifsData } = useGameNotifications();
const gameUnread = gameNotifsData?.unreadCount ?? 0;
const totalUnread = unreadCount + gameUnread;
// Replace `unreadCount > 0` checks with `totalUnread > 0`
```

## Verification

**Commands:**
- `cd backend && npm test -- horseFeed` -- expected: existing feed tests still pass
- `cd frontend && npx tsc --noEmit` -- expected: zero type errors
- `cd frontend && npm run build` -- expected: build succeeds

**Manual checks:**
- Feed a horse with Performance Feed: single toast shows stat suffix when stat gained, no suffix when not
- Open Messages → Notifications tab: stat gain entries appear; bell dot clears after opening tab
- Feed with Basic feed: toast has no stat suffix, no notification entry created

## Suggested Review Order

**Entry point — the notification write (controller, backend)**

- Notification appended OUTSIDE service transaction; 100-item rolling cap prevents unbounded growth
  [`horseFeedController.mjs:227`](../../backend/modules/horses/controllers/horseFeedController.mjs#L227)

**Backend API surface**

- `getGameNotifications` reads JSONB, returns notifications + unreadCount
  [`userController.mjs:738`](../../backend/modules/users/controllers/userController.mjs#L738)

- `markGameNotificationsRead` sets all isRead:true, writes back
  [`userController.mjs:763`](../../backend/modules/users/controllers/userController.mjs#L763)

- Routes registered before `/:id` to prevent param shadowing
  [`userRoutes.mjs:140`](../../backend/modules/users/routes/userRoutes.mjs#L140)

**Client types & API layer**

- `GameNotification` interface + `gameNotificationsApi` with `getAll` / `markAllRead`
  [`api-client.ts:2265`](../../frontend/src/lib/api-client.ts#L2265)

**React Query hooks**

- `useGameNotifications` (30s staleTime) + `useMarkGameNotificationsRead`
  [`useGameNotifications.ts:6`](../../frontend/src/hooks/api/useGameNotifications.ts#L6)

- `game-notifications` invalidated without `refetchType:'none'` so mounted bell updates immediately
  [`useFeedHorse.ts:44`](../../frontend/src/hooks/api/useFeedHorse.ts#L44)

**UI — bell unread aggregation**

- Bell combines DM unread + game notification unread into `totalUnread`
  [`MainNavigation.tsx:38`](../../frontend/src/components/MainNavigation.tsx#L38)

**UI — merged toast**

- Single toast appends ` +1 Stat!` suffix; 5 s when stat fires, 3 s otherwise
  [`HorseDetailPage.tsx:740`](../../frontend/src/pages/HorseDetailPage.tsx#L740)

**UI — Notifications tab**

- `useEffect` fires mark-all-read on tab open and whenever new unreads arrive while tab is active
  [`MessagesPage.tsx:70`](../../frontend/src/pages/MessagesPage.tsx#L70)

- Notifications tab button with blue unread badge
  [`MessagesPage.tsx:165`](../../frontend/src/pages/MessagesPage.tsx#L165)

- `GameNotifRow` component: horse name, stat gained, feed name, relative timestamp
  [`MessagesPage.tsx:532`](../../frontend/src/pages/MessagesPage.tsx#L532)
