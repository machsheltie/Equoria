# ADR-011: Real-Time Event Transport — Server-Sent Events (SSE)

**Status:** Accepted
**Date:** 2026-05-18
**Deciders:** Backend + Frontend Team
**Epic:** Community / Notifications (FR-CN6, FR-CN8, FR-CN9)
**Implementation:** `backend/services/eventBus.mjs`, `backend/modules/events/` (controller + routes), `frontend/src/hooks/api/useEventStream.ts`
**Tracking:** bd `Equoria-rgyv`
**Supersedes the implicit assumption** recorded in the original `Equoria-rgyv` description that "polling with tuned staleTime" was the likely outcome. The user directive was explicit: _"Whichever is going to be most correct and robust is what we should do."_ This ADR records the analysis that led to SSE instead of documenting polling.

---

## Context

PRD functional requirements imply real-time or near-real-time delivery of server-originated events to the player's browser:

- **FR-CN6 — "Watch Your Adventure Go":** the player should see game events (stat gains from feeding, foal births, competition placements) surface live without a manual refresh.
- **FR-CN8 — competition results push:** when a competition the player entered resolves, the result should appear promptly.
- **FR-CN9 — foal development lifecycle events:** trait discovery, milestone, and birth events during the foal lifecycle.

The pre-existing transport for all three is React Query polling. `useGameNotifications` polls `GET /api/v1/users/me/game-notifications` with `staleTime: 5_000` — effectively a 5-second poll whenever the component is mounted and the window is focused. There was no WebSocket, SSE, or socket.io infrastructure in the codebase.

The notification write path already exists and is the canonical event source: `backend/utils/notificationService.mjs#createNotification(userId, type, payload)` inserts a `Notification` row (with a fire-and-forget retention prune — see ADR-007). Producers today: `horseFeedController` (`stat_gain`), `foalingService` (`foal_born`), `competitionController`, `marketplaceController`. These are exactly the FR-CN6/8/9 event surfaces.

### Requirement analysis (the actual shape of the problem)

The three FRs are **predominantly one-way, server→client streams**:

- Notifications, competition results, and foal lifecycle events originate on the server (a cron, a controller mutation, a breeding resolution). The client never needs to push anything back over the same channel — actions like "mark read" are ordinary authenticated `PATCH` requests.
- Messaging (community DMs) _could_ want bidirectionality, but for beta the product is request/reply send + a live "you have a new message" receipt — which is still a server→client signal, not a bidirectional low-latency channel.
- There is no sub-100ms latency requirement, no client→server streaming, no presence/typing-indicator requirement, and no binary framing requirement.

A transport chosen for this shape should optimize for: correctness of delivery, robust auto-reconnect, working through reverse proxies (Railway sits behind one), minimal new infrastructure/auth surface, and graceful degradation. Bidirectional low-latency capability is _not_ a requirement and paying its complexity cost would be over-engineering.

---

## Decision

**Adopt Server-Sent Events (SSE) as the real-time event transport.** A single authenticated endpoint `GET /api/v1/events/stream` holds an open `text/event-stream` response per connected client, scoped to the authenticated user, fed by an in-process event bus that `createNotification` publishes to. The frontend consumes it with the native `EventSource` API via a `useEventStream` hook.

Polling remains in place as the **fallback and the durable source of truth** — SSE delivers the _live signal_, and the existing `useGameNotifications` query is invalidated/refetched on signal so the rendered list always comes from the authoritative DB read. SSE is an accelerator over polling, not a replacement of the persistence path. This is deliberate: the DB `Notification` table (bounded by ADR-007) is the system of record; the stream is a low-latency nudge.

### Why SSE is the correct-and-robust choice here

| Property                                   | SSE                                                              | WebSocket                                            | Polling                         |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------- |
| Direction needed (server→client)           | native fit                                                       | bidirectional (more than needed)                     | server→client via repeated pull |
| Auto-reconnect                             | **built into the protocol/`EventSource`** (with `Last-Event-ID`) | must be hand-rolled                                  | trivial (next poll)             |
| Works through Railway's HTTP reverse proxy | yes — plain HTTP/1.1 chunked response                            | needs proxy `Upgrade` support + sticky routing       | yes                             |
| New auth surface                           | **none** — reuses existing httpOnly-cookie `authenticateToken`   | typically a separate handshake/token path            | none                            |
| Infrastructure footprint                   | one Express route, no new dependency                             | socket.io / ws dependency, separate server lifecycle | none                            |
| Latency for these FRs                      | seconds → immediate                                              | immediate                                            | bounded by poll interval (5 s)  |
| Graceful degradation                       | falls back to existing polling cleanly                           | failure is harder to reason about                    | n/a (is the fallback)           |
| Multi-instance scaling story               | needs a cross-process bus (Redis pub/sub) when >1 instance       | same                                                 | none                            |

SSE wins on every axis that matters for this requirement and loses only on axes that are not requirements (full duplex, binary frames). It is the textbook-correct transport for authenticated one-way server push over plain HTTP.

### Authentication (security — no bypass)

The browser `EventSource` API **cannot set request headers**, so the common-but-wrong shortcut is to put the JWT in the query string (`?token=...`). That is rejected: tokens in URLs leak into access logs, the Referer header, and browser history. Instead, Equoria's `authenticateToken` middleware already reads the access token from the **httpOnly `accessToken` cookie** as its primary path. `EventSource(url, { withCredentials: true })` sends that cookie automatically on a same-origin request. The SSE route is mounted on the existing `authRouter`, so it passes through the **unmodified real `authenticateToken` middleware** — same auth as every other authenticated route, no token-in-query, no bypass header. An unauthenticated connection receives `401` before the stream opens. Per-user scoping is enforced from `req.user.id` (the token subject), never from a client-supplied parameter, so a user can only ever receive their own events.

---

## Alternatives Considered

### A. Keep polling, just document it (the original issue's expected outcome)

Rejected against the explicit user directive ("most correct and robust"). Polling at 5 s is functional but: (1) every mounted consumer issues a request every 5 s per user regardless of whether anything changed — wasted load that grows linearly with concurrent users; (2) worst-case latency is the full poll interval; (3) "real-time" in the PRD is poorly served by a fixed 5 s pull. Polling is the correct _fallback_, not the correct _primary_ transport for a live-UX requirement. It is retained as the fallback and source of truth, which captures its genuine strengths without making it the live path.

### B. WebSocket (ws / socket.io)

Rejected as over-engineering for these FRs. WebSocket is the right call when you need true bidirectional low-latency framing (multiplayer game state, collaborative editing, presence). None of FR-CN6/8/9 need client→server streaming. WebSocket would add: a new dependency, a separate connection-upgrade auth path (the cookie story is messier over `Upgrade`), proxy `Upgrade` configuration on Railway, and sticky-session requirements once there is >1 instance. It buys capability we do not need at a real complexity and operational cost. **The WebSocket-upgrade trigger condition is recorded below** — this decision is revisited if those requirements actually appear.

### C. Long-polling

Rejected. Long-polling approximates push by holding a request open until an event or timeout, then the client immediately re-requests. SSE is strictly better: it is long-polling's benefit (held connection) without the reconnect-storm and without re-sending headers per event. `EventSource` also gives free reconnect + `Last-Event-ID` resumption. Long-polling would be hand-built worse-SSE.

### D. Third-party push (Pusher / Ably / Firebase)

Rejected for beta. Adds an external dependency, a vendor account, a separate credential to manage, and egress/data-residency considerations — all to solve a problem one Express route solves. Revisit only if multi-region fan-out becomes a requirement.

---

## Implementation

**Event bus** (`backend/services/eventBus.mjs`):

- A process-local `EventEmitter` wrapper. `publishUserEvent(userId, type, payload)` emits on a per-user channel; `subscribeUserEvents(userId, listener)` returns an unsubscribe function. No global broadcast — a listener only ever receives events for the `userId` it subscribed with, which is the SSE per-user isolation boundary.
- `createNotification` (`notificationService.mjs`) calls `publishUserEvent` **after** the DB insert succeeds and is fire-and-forget (a bus failure must never fail the notification write — same discipline as the ADR-007 prune). The DB row is still the source of truth; the bus is the nudge.

**SSE endpoint** (`backend/modules/events/`):

- `GET /api/v1/events/stream`, mounted on `authRouter` so it inherits the real `authenticateToken` + the global security pipeline (prototype-pollution guards, audit trail). CSRF's `ignoredMethods` includes `GET`, so the safe-method stream is not blocked.
- Sets `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform` (the `no-transform` deterministically opts the response out of the compression middleware so events are not buffered), `Connection: keep-alive`, `X-Accel-Buffering: no` (defeats reverse-proxy response buffering), and calls `res.flushHeaders()` immediately so a client `onopen` fires before any event.
- Subscribes to `subscribeUserEvents(req.user.id, …)` and writes each event as a framed `event:`/`data:` SSE message.
- **Heartbeat:** a comment-line keepalive (`: ping`) every 25 s prevents idle-connection reaping by proxies and lets the client/server notice a dead peer. `requestTimeoutMiddleware`'s 408 path is inert here because it only fires when `!res.headersSent`, and SSE flushes headers immediately.
- **Disconnect cleanup:** on `req.on('close')` the bus listener is removed and the heartbeat interval is cleared — no listener or timer leak when a client navigates away or drops.

**Frontend** (`frontend/src/hooks/api/useEventStream.ts`):

- Opens an `EventSource('/api/v1/events/stream', { withCredentials: true })` (cookie auth, relative URL so it works on Railway's single-origin deploy).
- On each event, invalidates the `['game-notifications']` React Query key so the existing authoritative `useGameNotifications` read refetches — the rendered surface still comes from the real DB endpoint; SSE only collapses the latency from "up to 5 s" to "immediate". The hook is wired into `MainNavigation` (the notification bell), the surface common to FR-CN6/8/9.
- `EventSource` auto-reconnects natively on transient drop. If SSE never connects (proxy strips it, corporate network), the underlying `useGameNotifications` polling is untouched and the feature still works — graceful degradation with no code path change.

**Tests:**

- Backend integration (`backend/modules/events/__tests__/eventStream.integration.test.mjs`, real DB, no mocks): (1) `401` with no token; (2) authed connection opens with `text/event-stream`; (3) a `createNotification` for the connected user is received on the stream; (4) a `createNotification` for a _different_ user is **not** received (per-user isolation); (5) heartbeat comment observed; (6) listener/interval cleaned up on disconnect.
- Frontend unit (`frontend/src/hooks/api/__tests__/useEventStream.test.tsx`, Vitest, mocked `EventSource` — acceptable for a unit test of the hook's lifecycle): opens with `withCredentials`, invalidates the query on message, closes on unmount.

---

## Consequences

**Positive:**

- Live UX for FR-CN6/8/9 with seconds→immediate latency, no new dependency, no new auth surface, no infra beyond one route.
- DB remains the source of truth; SSE is an accelerator, so a missed event self-heals on the next poll/refetch — no correctness risk from a dropped stream.
- Reuses the exact existing auth middleware — the stream is exactly as secure as every other authenticated route.
- Graceful degradation: SSE failure silently falls back to the untouched polling path.

**Negative / accepted limitations:**

- **Single-instance only.** The event bus is process-local. With >1 backend instance, a user connected to instance A will not receive an event produced on instance B. This is acceptable for the current single-instance Railway beta deploy. The fallback polling still delivers the event from the DB regardless of instance, so this degrades latency, not correctness. **Cross-process fan-out (Redis pub/sub) is the documented next step when horizontal scaling lands** — filed as a follow-up, not pre-built (avoids speculative complexity per OPTIMAL_FIX_DISCIPLINE §5).
- Each connected client holds one open socket. At beta concurrency this is negligible; Node handles thousands of idle SSE connections. Connection-count monitoring is a future concern, not a beta blocker.
- Browsers cap ~6 SSE connections per origin under HTTP/1.1. We open exactly one per tab, so this is not hit in practice; documented for awareness.

**Reversible:** SSE is additive. Removing the `eventBus` publish call and the route reverts to pure polling with zero behavior change to the persistence path.

---

## WebSocket-Upgrade Trigger Condition

This decision is **re-evaluated and ADR-011 superseded by a WebSocket ADR** if and only if a _requirement_ (not a nice-to-have) appears for any of:

1. **Client→server streaming** over the live channel (e.g. real-time multiplayer competition spectating where the client sends input, live collaborative stable management, typing indicators in DMs).
2. **Sub-second bidirectional latency** as an explicit product requirement (current FRs have no quantified latency target; SSE's seconds-to-immediate satisfies them).
3. **High-frequency binary framing** (SSE is UTF-8 text only; if we need to push binary game-state diffs at high rate).

Until one of those is a real requirement, adding WebSocket is over-engineering and is explicitly out of scope.

## Multi-Instance Scaling Trigger Condition

Replace the process-local `EventEmitter` bus with a cross-process pub/sub (Redis) when the backend runs more than one instance/replica. Until then the process-local bus is correct and the polling fallback covers the cross-instance gap at a latency (not correctness) cost.

---

## Related Decisions

- ADR-007 (Notification retention) — the `Notification` table this stream observes is bounded by that policy; the bus publish follows the same fire-and-forget, never-fail-the-write discipline.
- `useGameNotifications` polling — retained as fallback + source of truth, not removed.
